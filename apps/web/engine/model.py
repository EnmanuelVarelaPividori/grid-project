"""GridShare local demonstrator: trained, held-out backtested 15-minute energy models.

All load, generation, costs and feeders are synthetic and are NOT claims about
real Groningen residents, suppliers, or actual Enexis grid capacity.
No third-party dependencies; can always run with Python 3.10+.
"""
from __future__ import annotations
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
import csv, json, math, random, statistics

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
START = date(2026, 1, 1)
END = date(2026, 12, 31)
HELD_OUT = [('2026-10-12','2026-10-18'), ('2026-10-26','2026-11-01')]
DEMO_DAY = '2026-11-12'
DT = 0.25  # hours, exact 15 minute resolution
FEEDER_LIMIT_KW = 325.0  # fictional illustrative cluster constraint
SOLAR_EXPORT_PRICE = 0.045  # illustrative EUR/kWh
BATTERY_CAPACITY_KWH = 230
BATTERY_POWER_KW = 72
BATTERY_ROUND_TRIP = 0.90

ASSETS = [
    {'id':'solar_hub','name':'Solar warehouse','sector':'Solar + warehouse','group':'GRN-DEMO-EAST','solar_kwp':110,'lat':53.2160,'lon':6.6078},
    {'id':'bakery','name':'Bakery & kitchens','sector':'Food production','group':'GRN-DEMO-EAST','solar_kwp':12,'lat':53.2150,'lon':6.6149},
    {'id':'ev_depot','name':'E-mobility depot','sector':'Electric vehicle charging','group':'GRN-DEMO-EAST','solar_kwp':0,'lat':53.2177,'lon':6.6201},
    {'id':'cold_storage','name':'Cold storage','sector':'Refrigeration','group':'GRN-DEMO-EAST','solar_kwp':35,'lat':53.2140,'lon':6.6003},
    {'id':'factory','name':'Flexible workshop','sector':'Light industry','group':'GRN-DEMO-EAST','solar_kwp':24,'lat':53.2149,'lon':6.6252},
    {'id':'offices','name':'Campus offices','sector':'Offices','group':'GRN-DEMO-EAST','solar_kwp':18,'lat':53.2220,'lon':6.6112},
]

def is_held_out(d):
    return any(a <= d <= b for a,b in HELD_OUT)

def daylight(hour, day_of_year):
    length = 12 + 4.5*math.sin(2*math.pi*(day_of_year-80)/365)
    sunrise = 12 - length/2
    return max(0., math.sin(math.pi * (hour - sunrise) / length)) if sunrise < hour < sunrise + length else 0.

def price_per_kwh(hour):
    # Demo all-in variable-energy price; NOT a Dutch supplier quote.
    return round(0.26 + (0.125 if 17<=hour<21 else 0.035 if 7<=hour<10 else -0.045 if 11<=hour<16 else 0.0), 3)

def make_dataset():
    """Create repeatable 365-day synthetic 15-minute load/weather dataset.

    We consciously avoid using synthetic values as a real map of grid loads.
    """
    DATA.mkdir(parents=True, exist_ok=True)
    path = DATA / 'cluster_2026_synthetic_15min.csv'
    weather_path = DATA / 'weather_2026_synthetic_15min.csv'
    if path.exists() and weather_path.exists():
        return path
    rng = random.Random(260911)
    with path.open('w',newline='',encoding='utf-8') as f, weather_path.open('w',newline='',encoding='utf-8') as w:
        writer=csv.writer(f)
        writer.writerow(['date','slot','asset_id','demand_kw','solar_kw','flexible_kw','temperature_c','cloud_fraction','sun_index','eur_per_kwh'])
        ww=csv.writer(w)
        ww.writerow(['date','slot','temperature_c','cloud_fraction','sun_index','source'])
        d=START
        while d<=END:
            doy=d.timetuple().tm_yday
            day_cloud=max(.06,min(.98,rng.uniform(.08,.92)))
            day_temp = 11+10*math.sin(2*math.pi*(doy-100)/365)+rng.uniform(-3,3)
            weekend=d.weekday()>=5
            for slot in range(96):
                hr=slot/4
                cloud=min(.99,max(.02,day_cloud+.17*math.sin(hr*.83+doy)+rng.uniform(-.07,.07)))
                temp=day_temp+2.6*math.sin(2*math.pi*(hr-7)/24)
                sun=daylight(hr,doy)*(1-.83*cloud)
                p=price_per_kwh(hr)
                ww.writerow([d.isoformat(),slot,round(temp,3),round(cloud,3),round(sun,4),'synthetic; not actual weather'])
                day_shift = 1. if not weekend else .60
                for a in ASSETS:
                    n=a['id']; noise=rng.uniform(.96,1.04)
                    if n=='solar_hub':
                        load=15+36*day_shift*(8<=hr<18)+8*(hr>=18 or hr<6)
                        flexible=5*(9<=hr<=17)
                    elif n=='bakery':
                        load=11+38*(4<=hr<12)+14*(12<=hr<18)
                        flexible=12*(5<=hr<15)
                    elif n=='ev_depot':
                        load=9+42*(8<=hr<17)+85*(17<=hr<22)+11*(22<=hr or hr<6)
                        flexible=53*(17<=hr<22)+10*(8<=hr<17)
                    elif n=='cold_storage':
                        load=24+max(0,temp-12)*1.10+9*(8<=hr<18)
                        flexible=13
                    elif n=='factory':
                        load=18+82*day_shift*(7<=hr<17)+15*(17<=hr<20)
                        flexible=28*day_shift*(7<=hr<17)
                    else: # office
                        load=9+62*day_shift*(8<=hr<18)+15*day_shift*(18<=hr<20)
                        flexible=12*day_shift*(8<=hr<18)
                    generation=a['solar_kwp']*sun*(.92+rng.uniform(-.025,.025))
                    writer.writerow([d.isoformat(),slot,n,round(load*noise,3),round(generation,3),round(flexible,3),round(temp,3),round(cloud,3),round(sun,4),p])
            d+=timedelta(days=1)
    profiles={a['id']:{'name':a['name'],'sector':a['sector'],'solar_kwp':a['solar_kwp'],'grid_segment':'GRN-DEMO-EAST (fictional)'} for a in ASSETS}
    (DATA/'standard_profiles_synthetic.json').write_text(json.dumps(profiles,indent=2),encoding='utf-8')
    return path

class EnergyEngine:
    def __init__(self):
        make_dataset()
        self.records={}
        self.weather={}
        self.bin_stats=defaultdict(lambda:[0.,0.,0.,0.,0.,0.,0])
        self.models={}
        self.mae={}
        self.read_training_data()
        self.cached_backtest=None

    def read_training_data(self):
        src=DATA/'cluster_2026_synthetic_15min.csv'
        with src.open(encoding='utf-8',newline='') as f:
            reader=csv.DictReader(f)
            for r in reader:
                d=r['date']; slot=int(r['slot']); key=(d,slot)
                entry={'load':float(r['demand_kw']),'solar':float(r['solar_kw']),'flex':float(r['flexible_kw']), 'sun':float(r['sun_index']),'temp':float(r['temperature_c']),'price':float(r['eur_per_kwh'])}
                self.records.setdefault(key,{})[r['asset_id']]=entry
                if r['asset_id']==ASSETS[0]['id']:
                    self.weather[key]={'temp':entry['temp'],'sun':entry['sun'],'price':entry['price']}
                if not is_held_out(d):
                    date_obj=date.fromisoformat(d)
                    weekday=0 if date_obj.weekday()<5 else 1
                    bucket=(r['asset_id'],date_obj.month,weekday,slot)
                    s=self.bin_stats[bucket]
                    s[0]+=entry['load'];s[1]+=entry['solar'];s[2]+=entry['flex'];s[3]+=entry['temp'];s[4]+=entry['sun'];s[5]+=1
        # Group bins and simple historical temperature/sun corrections.
        # This is a trained seasonal/weather model, not an external AI API.
        for k,s in self.bin_stats.items():
            n=s[5]
            self.models[k]={'load':s[0]/n,'solar':s[1]/n,'flex':s[2]/n,'temp':s[3]/n,'sun':s[4]/n}
        errors=defaultdict(list)
        for d0,d1 in HELD_OUT:
            d=date.fromisoformat(d0)
            while d<=date.fromisoformat(d1):
                for slot in range(96):
                    for a in ASSETS:
                        actual=self.records[(d.isoformat(),slot)][a['id']]
                        pred=self.forecast_one(d.isoformat(),slot,a['id'])
                        errors['load'].append(abs(pred['load']-actual['load']))
                        errors['solar'].append(abs(pred['solar']-actual['solar']))
                d+=timedelta(days=1)
        self.mae={k:round(sum(v)/len(v),2) for k,v in errors.items()}

    def forecast_one(self,d,slot,asset_id):
        day=date.fromisoformat(d);kind=0 if day.weekday()<5 else 1
        mean=self.models.get((asset_id,day.month,kind,slot))
        actual_weather=self.weather.get((d,slot)) or {'temp':12,'sun':.4,'price':price_per_kwh(slot/4)}
        if mean is None:
            # Supports running a later year, using the demo-year seasonal shape.
            mean=self.models.get((asset_id,day.month,kind,slot), {'load':20,'solar':0,'flex':4,'temp':12,'sun':.3})
        temperature_shift=actual_weather['temp']-mean['temp']
        load=mean['load']+ (1.05*temperature_shift if asset_id=='cold_storage' else .20*max(0,temperature_shift))
        solar=max(0,mean['solar']*(actual_weather['sun']/max(.015,mean['sun']))) if mean['solar']>0 else 0
        return {'load':max(0,load),'solar':solar,'flex':max(0,mean['flex']),'price':actual_weather['price']}

    def forecast_day(self,d):
        if not (START.isoformat()<=d<=END.isoformat()):
            d=DEMO_DAY
        series=[]
        for slot in range(96):
            predicts={a['id']:self.forecast_one(d,slot,a['id']) for a in ASSETS}
            load=sum(p['load'] for p in predicts.values())
            solar=sum(p['solar'] for p in predicts.values())
            flex=sum(p['flex'] for p in predicts.values())
            ev=predicts['ev_depot']
            series.append({'slot':slot,'time':f'{slot//4:02d}:{(slot%4)*15:02d}', 'load':round(load,3),'solar':round(solar,3), 'net':round(load-solar,3),'flexible':round(flex,3),'ev_flex':round(ev['flex'],3),'ev_load':round(ev['load'],3),'industrial_flex':round(predicts['factory']['flex'],3),'price':ev['price']})
        return series

    def actual_day(self,d):
        result=[]
        for slot in range(96):
            entries=self.records.get((d,slot),{})
            result.append(sum(x['load']-x['solar'] for x in entries.values()))
        return result

    @staticmethod
    def shift_flexible(series, fraction, mode='smart'):
        """Reschedule flexible EV and industrial loads, conserving daily kWh.

        A source interval must have self-declared flexibility. We never infer that
        ordinary building load can simply disappear. This is a *demo* energy hub.
        """
        vals=[r['net'] for r in series]
        if fraction<=0:return vals
        # EVs can move charging out of the 17:00–22:00 peak.
        # Industrial workshop can move an explicitly flexible process from
        # morning or end of shift into the center of the day.
        sources=list(range(31,38))+list(range(63,68))+list(range(68,89))
        dest=list(range(42,60))
        if mode=='smart':
            sources.sort(key=lambda i:(vals[i]+250*series[i]['price']),reverse=True)
            dest.sort(key=lambda i:series[i]['price'] + .002*max(0,vals[i]) - .0006*series[i]['solar'])
        else:
            sources.sort()
            dest.sort()
        cap={i:70.0 for i in dest}
        for i in sources:
            if 31<=i<38 or 63<=i<68:
                # Industrial load with user-declared shiftability.
                remaining=series[i]['industrial_flex'] * (0.91 if mode=='smart' else fraction*.6)
            else:
                remaining=series[i]['ev_flex']*fraction
            for j in dest:
                if remaining<=.001:break
                if j==i or (mode=='smart' and series[j]['price']>series[i]['price']+.02):continue
                room=cap[j]
                if mode=='smart':room=min(room,max(0,FEEDER_LIMIT_KW-vals[j]-8))
                amount=min(room,remaining)
                if amount<=0:continue
                vals[i]-=amount;vals[j]+=amount;cap[j]-=amount;remaining-=amount
        return vals

    @staticmethod
    def battery_schedule(series,net,mode):
        """Constrained fictional battery with charging losses and retained SOC.

        Battery starts and finishes at a reference SOC, so we don't grant free
        energy to every daily replay or count batteries as a generator.
        """
        out=list(net)
        if mode=='no_coord' or mode=='best_solo':return out,0,0
        capacity=BATTERY_CAPACITY_KWH if mode=='gridshare_ai' else 130
        power=BATTERY_POWER_KW if mode=='gridshare_ai' else 28
        eff=math.sqrt(BATTERY_ROUND_TRIP)
        initial_soc=110 if mode=='gridshare_ai' else 65
        soc=float(initial_soc)
        charged=0.
        discharged=0.
        # Only permit morning discharge when forecast daytime solar offers a
        # credible recharge path; otherwise we could cheat by emptying the battery.
        solar_recharge_budget=sum(min(power,max(0,FEEDER_LIMIT_KW-out[i]-12))*DT for i in range(43,63) if series[i]['solar']>15)
        morning_budget=min(38., max(0,solar_recharge_budget*.52*BATTERY_ROUND_TRIP))
        morning=[i for i in range(28,44) if out[i]>FEEDER_LIMIT_KW-18]
        morning.sort(key=lambda i:out[i],reverse=True)
        for i in morning:
            if morning_budget<=.001:break
            available=max(0,(soc-40)*eff/DT)
            kw=min(power,max(0,out[i]-(FEEDER_LIMIT_KW-12)),available,morning_budget/DT)
            if kw<=0:continue
            out[i]-=kw;soc-=kw*DT/eff;discharged+=kw*DT;morning_budget-=kw*DT
        # Solar hours: charge only when grid headroom exists and solar is active.
        charge_candidates=list(range(43,64))
        if mode=='gridshare_ai':charge_candidates.sort(key=lambda i:out[i]+40*series[i]['price']-1.5*series[i]['solar'])
        for i in charge_candidates:
            if soc>=capacity-.001:break
            if series[i]['solar']<15:continue
            kw=min(power,max(0,FEEDER_LIMIT_KW-out[i]-12),(capacity-soc)/(DT*eff))
            if kw<=.1:continue
            out[i]+=kw;soc+=kw*DT*eff;charged+=kw*DT
        # Peak hours: only discharge energy above the initial SOC. Reserve the
        # morning's energy and ensure no phantom arbitrage across 24h replays.
        evening=list(range(63,94))
        evening.sort(key=lambda i:out[i]+35*series[i]['price'],reverse=True)
        for i in evening:
            deliverable=max(0,(soc-initial_soc)*eff/DT)
            if deliverable<=.01:break
            kw=min(power,deliverable,max(0,out[i]-175))
            if kw<=0:continue
            out[i]-=kw;soc-=kw*DT/eff;discharged+=kw*DT
        # If charging could not replenish morning usage, the result must not
        # quietly claim round-trip-neutral operation. Revert to no battery.
        if soc < initial_soc-.05:
            return list(net),0.,0.
        return out,charged,discharged

    @staticmethod
    def calculate_metrics(series, net):
        imports=sum(max(0,v)*DT for v in net)
        exports=sum(max(0,-v)*DT for v in net)
        cost=sum((max(0,v)*r['price']-max(0,-v)*SOLAR_EXPORT_PRICE)*DT for v,r in zip(net,series))
        peak=max(net)
        overload=sum(1 for v in net if v>FEEDER_LIMIT_KW)
        # Deliberately synthetic time-dependent emissions factors (kgCO2e/kWh).
        # NOT a calculation from actual Dutch marginal generation data.
        emissions=sum(max(0,v)*DT*(.18 if 11<=int(r['time'][:2])<16 else .46 if 17<=int(r['time'][:2])<22 else .32) for v,r in zip(net,series))
        # These are engineering proxies, not metered curtailment/emissions.
        potential_solar=sum(r['solar']*DT for r in series)
        on_site_solar=max(0,potential_solar-exports)
        return {'cost_eur':round(cost,2),'import_kwh':round(imports,1),'export_kwh':round(exports,1),
                'peak_kw':round(peak,1),'overload_slots':overload,'overload_hours':round(overload*DT,2),
                'solar_self_use_proxy_kwh':round(on_site_solar,1),'co2_proxy_kg':round(emissions,1)}

    def optimize_day(self,d=DEMO_DAY,mode='gridshare_ai',use_actual=False):
        series=self.forecast_day(d)
        initial=[r['net'] for r in series]
        if mode=='no_coord':shifted=list(initial)
        elif mode=='best_solo':shifted=self.shift_flexible(series,.09,'simple')
        elif mode=='rule_based':shifted=self.shift_flexible(series,.20,'simple')
        else:shifted=self.shift_flexible(series,.42,'smart')
        optimized,charged,discharged=self.battery_schedule(series,shifted,mode)
        if use_actual:
            actual=self.actual_day(d)
            delta=[after-before for before,after in zip(initial,optimized)]
            initial=actual
            optimized=[a+x for a,x in zip(actual,delta)]
        before=self.calculate_metrics(series,initial)
        after=self.calculate_metrics(series,optimized)
        results={'date':d,'scenario':mode,'feeder_limit_kw':FEEDER_LIMIT_KW,'before':before,'after':after,
                 'savings_eur':round(before['cost_eur']-after['cost_eur'],2),
                 'peak_reduction_kw':round(before['peak_kw']-after['peak_kw'],2),
                 'co2_proxy_delta_kg':round(before['co2_proxy_kg']-after['co2_proxy_kg'],1),
                 'storage_charged_kwh':round(charged,1), 'storage_discharged_kwh':round(discharged,1),
                 'uncertainty_band_kw':round(1.6*len(ASSETS)*(self.mae['load']+self.mae['solar']),1),
                 'uncertainty_note':'Indicative ± band based on synthetic held-out MAE, not a calibrated confidence interval',
                 'timeseries': [{'time':row['time'],'net_before':round(a,1),'net_after':round(b,1),'solar':round(row['solar'],1), 'price':row['price']} for row,a,b in zip(series,initial,optimized)]}
        return results

    def backtest(self):
        if self.cached_backtest:return self.cached_backtest
        variants=['no_coord','best_solo','rule_based','gridshare_ai']
        totals={x:defaultdict(float) for x in variants}
        numdays=0
        for start,end in HELD_OUT:
            d=date.fromisoformat(start)
            while d<=date.fromisoformat(end):
                ds=d.isoformat();numdays+=1
                for mode in variants:
                    result=self.optimize_day(ds,mode,use_actual=True)
                    m=result['after']
                    for k in ['cost_eur','import_kwh','export_kwh','overload_hours','solar_self_use_proxy_kwh']:
                        totals[mode][k]+=m[k]
                    totals[mode]['worst_peak_kw']=max(totals[mode]['worst_peak_kw'],m['peak_kw'])
                d+=timedelta(days=1)
        scores=[]
        baseline=totals['no_coord']
        for mode in variants:
            t=totals[mode]
            scores.append({'key':mode,'label':{'no_coord':'No coordination','best_solo':'Best solo','rule_based':'Rule-based','gridshare_ai':'GridShare optimized'}[mode],
               'cost_eur':round(t['cost_eur'],2),'peak_kw':round(t['worst_peak_kw'],1),
               'overload_hours':round(t['overload_hours'],2),
               'import_kwh':round(t['import_kwh'],1),'solar_self_use_proxy_kwh':round(t['solar_self_use_proxy_kwh'],1),
               'savings_vs_baseline_eur':round(baseline['cost_eur']-t['cost_eur'],2)})
        self.cached_backtest={'weeks':[{'start':a,'end':b} for a,b in HELD_OUT], 'days':numdays,
            'dataset':'100% synthetic 2026 15-minute dataset; held-out weeks excluded from forecast training',
            'forecast_mae_kw':self.mae,'feeder_limit_kw':FEEDER_LIMIT_KW,'scores':scores,
            'notes':['No real Groningen network measurements or commercial tariffs are used.',
                     'Forecasts are trained on the other synthetic weeks; evaluated on the two held-out periods.',
                     'Battery uses an assumed 90% round-trip efficiency; optimized scheduling is heuristic.',
                     'Solar self-use is a proxy, not measured avoided curtailment.',
                     'Backtest reports realized outcomes using actual synthetic series and forecast-planned schedule changes.']}
        return self.cached_backtest

    @staticmethod
    def window_slots(x):
        import re
        numbers=re.findall(r'(\d{1,2}):(\d{2})',str(x.get('window','')))
        if len(numbers)<2:return set(range(36,80))
        start=int(numbers[0][0])*4+int(numbers[0][1])//15
        end=int(numbers[1][0])*4+int(numbers[1][1])//15
        if end<=start:return set(range(start,96))|set(range(end))
        return set(range(max(0,start),min(96,end)))

    def partner_for(self,offer,listings):
        """Explainable *discovery* ranking; not a proof of legal compatibility."""
        kind=offer['kind']
        expected={'solar':'demand','battery':'solar','mcc':'mcc','demand':'solar'}[kind]
        possibles=[]
        for other in listings:
            if other['id']==offer['id'] or other['kind']!=expected:continue
            overlap=len(self.window_slots(offer)&self.window_slots(other))
            if overlap==0:continue
            supplier_match=offer.get('supplier')==other.get('supplier')
            same_demo_feeder=offer.get('feeder')==other.get('feeder') and str(offer.get('feeder','')).startswith('GRN-DEMO-')
            same_connect=offer.get('connection')==other.get('connection')
            if kind=='mcc':
                if not (same_demo_feeder and same_connect):continue
                score=overlap*3+20
            else:
                distance=math.hypot((offer['lat']-other['lat'])*110,(offer['lon']-other['lon'])*67)
                score=overlap*2 + (20 if supplier_match else -8) - min(20,distance*1.9)
            possibles.append((score,other,supplier_match,same_demo_feeder,overlap))
        if not possibles:
            return {'partner_id':None,'partner_name':'No candidate available','overlap_intervals':0,
                    'compatibility':'No eligible partner verified','partner_reason':'No overlapping candidate of the required listing type'}
        _,other,supplier_match,same_demo_feeder,overlap=max(possibles,key=lambda z:z[0])
        if kind=='mcc':
            reason='Same fictional feeder ID and connection class. Real operator verification is still essential.'
            compatibility='SIMULATED topology only; GTO required'
        else:
            reason='Overlapping published time windows and '+('matching provider labels.' if supplier_match else 'different provider labels; further settlement needed.')
            compatibility='Supplier labels align, unverified' if supplier_match else 'Different supplier — settlement check'
        return {'partner_id':other['id'],'partner_name':other['name'],
                'overlap_intervals':overlap,'compatibility':compatibility,'partner_reason':reason}

    def matches(self, listings,profile=None,d=DEMO_DAY):
        forecast=self.forecast_day(d)
        available_early=sum(max(0,r['solar']-60)*.25 for r in forecast if 10<=int(r['time'][:2])<16)
        result=[]
        for x in listings:
            kind=x['kind'];partner=self.partner_for(x,listings)
            ratio=min(1,partner['overlap_intervals']/18) if partner['partner_id'] else 0
            if kind=='solar':
                fit=min(float(x.get('energy_kwh') or 0),max(5,available_early*.36))*ratio
                est=fit*.058
                title='Match solar surplus to flexible consumers'
                desc=f"{fit:.1f} kWh possible time-window overlap with {partner['partner_name']} under modelled conditions. Actual metering and supplier approval required."
                risk='Supplier agreement + smart-meter data required'
            elif kind=='battery':
                fit=min(float(x.get('energy_kwh') or 0),23)*ratio
                est=fit*.038
                title='Charge free storage during solar hours'
                desc=f"{partner['partner_name']} could offer solar input for {fit:.1f} kWh battery charging. Retrieval later is not a standard guaranteed right."
                risk='Battery ownership, supplier settlement and charges need review'
            elif kind=='mcc':
                fit=min(float(x.get('power_kw') or 0)*.3,45)*ratio
                est=fit*.22
                title='Explore shared contracted transport headroom'
                desc=f"{fit:.1f} kW modelled complementary demand with {partner['partner_name']}; network topology and legal eligibility are fictional and require an Enexis check."
                risk='GTO approval; matching network station and connection category required'
            else:
                fit=min(float(x.get('energy_kwh') or 0),21)*ratio
                est=fit*.041
                title='Shift flexible demand to solar hours'
                desc=f"Forecast {fit:.1f} kWh planning opportunity with {partner['partner_name']}, subject to actual usage and billing rules."
                risk='Flexible consumption and supplier permissions required'
            elig='Review required'
            if profile:
                if kind=='mcc' and profile.get('account_type')!='business':elig='Business arrangement required'
                elif kind=='solar' and profile.get('supplier')==x.get('supplier'):elig='Supplier name aligned — not verified'
            result.append({'listing_id':x['id'],'title':title,'explanation':desc,'eligibility':elig,
                'risk':risk,'quantity':round(fit,1),'unit':'kW' if kind=='mcc' else 'kWh',
                'illustrative_value_eur':round(est,2),'confidence':'Model estimate · synthetic inputs',**partner})
        return result

    def best_deals(self,listings,profile=None,d=DEMO_DAY):
        """Compare candidate deals for each partner, including no-match cases."""
        matches=self.matches(listings,profile,d)
        rows=[]
        for item in matches:
            offer=next((x for x in listings if x['id']==item['listing_id']),None)
            if not offer:continue
            rows.append({'participant':offer['name'],'kind':offer['kind'],
                         'partner':item['partner_name'],'quantity':item['quantity'],
                         'unit':item['unit'],'gross_opportunity_eur':item['illustrative_value_eur'],
                         'status':item['compatibility'],
                         'notes':'Gross illustrative opportunity, not a final after-tax saving or legally cleared trade.'})
        return rows


ENGINE=None

def get_engine():
    global ENGINE
    if ENGINE is None:ENGINE=EnergyEngine()
    return ENGINE
