"""GridShare Groningen: self-contained offline-first local demo server.

Run: python app.py --open
No npm install, no API keys, no third-party Python modules required.
All account information stored locally in data/gridshare.sqlite3 (NOT authenticated).
"""
from __future__ import annotations
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlsplit, parse_qs
from pathlib import Path
import argparse, json, sqlite3, mimetypes, re, webbrowser, threading
from datetime import datetime
from engine.model import get_engine, DEMO_DAY, HELD_OUT, FEEDER_LIMIT_KW

ROOT=Path(__file__).resolve().parent
DB=ROOT/'data'/'gridshare.sqlite3'
DEMO_LISTINGS=[
 {'id':'solar-1','kind':'solar','name':'Oosterpoort Solar Collective','owner':'Neighborhood solar co-op','lat':53.2069,'lon':6.5770,'power_kw':19,'energy_kwh':66,'price':0.075,'window':'11:00–16:00','supplier':'Eneco','verified':'Demo estimate','details':'Shared rooftop solar · forecast surplus; small-user electricity-sharing agreement required.','feeder':'Unknown','connection':'3 × 25 A'},
 {'id':'solar-2','kind':'solar','name':'Euvelgunne Solar Warehouse','owner':'Warehouse partner · demo','lat':53.2159,'lon':6.6075,'power_kw':82,'energy_kwh':210,'price':0.069,'window':'10:00–16:00','supplier':'Vattenfall','verified':'Demo estimate','details':'Commercial rooftop PV. Export and consumption depend on existing contracts.','feeder':'GRN-DEMO-EAST','connection':'3 × 160 A'},
 {'id':'solar-3','kind':'solar','name':'Helpman Rooftop Solar','owner':'Neighborhood household · demo','lat':53.1988,'lon':6.5849,'power_kw':6,'energy_kwh':18,'price':0.078,'window':'12:00–15:00','supplier':'Greenchoice','verified':'Demo estimate','details':'Illustrative household with solar forecast. Location randomized within neighborhood.','feeder':'Unknown','connection':'3 × 25 A'},
 {'id':'battery-1','kind':'battery','name':'Noorderplantsoen Home Battery','owner':'Battery host · demo','lat':53.2247,'lon':6.5528,'power_kw':5,'energy_kwh':10,'price':0.055,'window':'13:00–19:00','supplier':'Tibber','verified':'Self-reported demo','details':'10 kWh available storage; 5 kW charge rate. Storage service and later retrieval are not automatically supported.','feeder':'Unknown','connection':'3 × 25 A'},
 {'id':'battery-2','kind':'battery','name':'Sontplein Commercial Battery','owner':'Energy operator · demo','lat':53.2242,'lon':6.6056,'power_kw':72,'energy_kwh':230,'price':0.038,'window':'10:00–22:00','supplier':'Eneco','verified':'Demo estimate','details':'Simulated commercial battery supporting feeder-constrained scheduling; efficiency assumption 90%.','feeder':'GRN-DEMO-EAST','connection':'3 × 160 A'},
 {'id':'battery-3','kind':'battery','name':'Zernike Energy Storage','owner':'Research pilot · fictional','lat':53.2397,'lon':6.5402,'power_kw':40,'energy_kwh':145,'price':0.049,'window':'12:00–23:00','supplier':'Vandebron','verified':'Demo estimate','details':'Fictional campus battery. Different fictional network segment; not eligible for eastern hub MCC coordination.','feeder':'GRN-DEMO-NORTH','connection':'3 × 160 A'},
 {'id':'demand-1','kind':'demand','name':'Binnenstad EV Charging','owner':'EV fleet · demo','lat':53.2182,'lon':6.5631,'power_kw':24,'energy_kwh':54,'price':0.22,'window':'11:00–17:00','supplier':'Eneco','verified':'Demo estimate','details':'Flexible EV charging can be shifted to renewable generation periods.','feeder':'Unknown','connection':'3 × 80 A'},
 {'id':'demand-2','kind':'demand','name':'Euvelgunne EV Depot','owner':'Commercial fleet · demo','lat':53.2186,'lon':6.6200,'power_kw':145,'energy_kwh':285,'price':0.25,'window':'10:00–22:00','supplier':'Vattenfall','verified':'Demo estimate','details':'Demand shifts are modelled at 15-minute granularity within a fictional feeder limit.','feeder':'GRN-DEMO-EAST','connection':'3 × 250 A'},
 {'id':'mcc-1','kind':'mcc','name':'Euvelgunne Flexible Workshop','owner':'Business capacity · demo','lat':53.2145,'lon':6.6242,'power_kw':48,'energy_kwh':0,'price':0,'window':'12:00–17:00','supplier':'Essent','verified':'Eligibility not verified','details':'Physical connection rating is not the same as contracted transport rights. Candidate for collective planning only.','feeder':'GRN-DEMO-EAST','connection':'3 × 160 A'},
 {'id':'mcc-2','kind':'mcc','name':'Sontweg Cold Storage','owner':'Business capacity · demo','lat':53.2220,'lon':6.6062,'power_kw':34,'energy_kwh':0,'price':0,'window':'08:00–11:00','supplier':'Eneco','verified':'Eligibility not verified','details':'Illustrative complementary electricity profile for a potential group transport agreement.','feeder':'GRN-DEMO-EAST','connection':'3 × 160 A'},
 {'id':'mcc-3','kind':'mcc','name':'Zernike Research Facilities','owner':'Business capacity · demo','lat':53.2390,'lon':6.5370,'power_kw':22,'energy_kwh':0,'price':0,'window':'14:00–19:00','supplier':'Vandebron','verified':'Different segment · demo','details':'Fictional northern feeder; nearby appearance never proves network compatibility.','feeder':'GRN-DEMO-NORTH','connection':'3 × 160 A'},
]

PROVIDERS=['Eneco','Essent','Vattenfall','Greenchoice','Vandebron','Budget Energie','Frank Energie','Tibber','Zonneplan','ANWB Energie','Other / unknown']
KINDS={'solar','battery','demand','mcc'}

def connect_db():
    DB.parent.mkdir(exist_ok=True,parents=True)
    con=sqlite3.connect(DB,timeout=10)
    con.row_factory=sqlite3.Row
    con.execute('''CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)''')
    con.execute('''CREATE TABLE IF NOT EXISTS listings (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)''')
    con.execute('''CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)''')
    con.commit()
    return con

def read_profile(con):
    row=con.execute('SELECT json FROM profile WHERE id=1').fetchone()
    return json.loads(row['json']) if row else None

def all_listings(con):
    rows=[json.loads(row['json']) for row in con.execute('SELECT json FROM listings ORDER BY id DESC')]
    return DEMO_LISTINGS+rows

def get_requests(con):
    return [{**json.loads(r['json']),'id':r['id'],'created_at':r['created_at']} for r in con.execute('SELECT * FROM requests ORDER BY id DESC')]

def safe_text(x,limit=140):
    return str(x or '').strip()[:limit]

def safe_number(x,maximum=100000):
    try:return round(min(max(0,float(x)),maximum),3)
    except (ValueError,TypeError):return 0

def valid_date(s):
    try:
        d=datetime.strptime(s,'%Y-%m-%d').date()
        return d.isoformat() if d.year==2026 else DEMO_DAY
    except (TypeError,ValueError):return DEMO_DAY

class Handler(SimpleHTTPRequestHandler):
    server_version='GridShareLocal/1.0'
    def log_message(self,fmt,*args):
        print('[GridShare]',fmt%args)

    def respond(self,content,status=200):
        raw=json.dumps(content,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(raw)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers()
        self.wfile.write(raw)

    def read_json(self):
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size>800000 or size<2:raise ValueError('Request exceeds size limit or is empty')
            obj=json.loads(self.rfile.read(size))
            if not isinstance(obj,dict):raise ValueError('Expected JSON object')
            return obj
        except Exception as err:raise ValueError('Invalid request: '+str(err))

    def do_GET(self):
        path=urlsplit(self.path).path
        q=parse_qs(urlsplit(self.path).query)
        if path.startswith('/api/'):
            try:
                engine=get_engine()
                if path=='/api/health':return self.respond({'status':'ok','mode':'synthetic_offline_demo'})
                if path=='/api/bootstrap':
                    with connect_db() as con:
                        return self.respond({'profile':read_profile(con),'listings':all_listings(con),'requests':get_requests(con),
                            'providers':PROVIDERS,'demo_date':DEMO_DAY,'feeder_limit_kw':FEEDER_LIMIT_KW,
                            'warnings':['All demonstration listings, congestion zones, and electricity prices are simulated.','No real transfers, meters, billing or account authentication.']})
                if path=='/api/forecast':
                    d=valid_date(q.get('date',[DEMO_DAY])[0]);mode=q.get('mode',['gridshare_ai'])[0]
                    if mode not in ['no_coord','best_solo','rule_based','gridshare_ai']:mode='gridshare_ai'
                    return self.respond(engine.optimize_day(d,mode))
                if path=='/api/backtest':return self.respond(engine.backtest())
                if path=='/api/deals':
                    d=valid_date(q.get('date',[DEMO_DAY])[0])
                    with connect_db() as con:return self.respond({'date':d,'deals':engine.best_deals(all_listings(con),read_profile(con),d)})
                if path=='/api/matches':
                    d=valid_date(q.get('date',[DEMO_DAY])[0])
                    with connect_db() as con:return self.respond({'date':d,'matches':engine.matches(all_listings(con),read_profile(con),d)})
                if path=='/api/sources':return self.respond({'sources':[
                    {'name':'Official Netherlands capacity map','url':'https://capaciteitskaart.netbeheernederland.nl/','note':'Public planning map; not individual live power.'},
                    {'name':'Capacity map export documentation','url':'https://capaciteitskaart.netbeheernederland.nl/info/algemene-info/','note':'Official CSV exports; not bundled here.'},
                    {'name':'Groningen published Enexis GIS layer','url':'https://geoservices.provinciegroningen.nl/server/rest/services/BasisdataExtern/EnergieEnexis/MapServer','note':'Published geography; not a live transferable-capacity layer.'},
                    {'name':'Enexis group transport agreement','url':'https://www.enexis.nl/zakelijk/netcapaciteit/flexibiliteitsoplossingen/groepstransportovereenkomst','note':'Rules for eligible group contracts and feeders.'},
                    {'name':'FlexMeasures open-source scheduler','url':'https://github.com/FlexMeasures/flexmeasures','note':'Optional future integration; not required to run the local demo.'}]})
                return self.respond({'error':'Not found'},404)
            except Exception as e:
                print('API error:',repr(e))
                return self.respond({'error':str(e)},500)
        # Prefer the compiled HeroUI v3 interface when it is installed/built.
        # The full no-dependency original stays available at /classic.
        if path in ('/','/heroui'):
            path='/static/heroui/index.html' if (ROOT/'static'/'heroui'/'index.html').is_file() else '/static/index.html'
        elif path=='/classic':
            path='/static/index.html'
        if not path.startswith('/static/'):
            self.send_error(404,'Not found')
            return
        candidate=(ROOT/path.lstrip('/')).resolve()
        if ROOT not in candidate.parents or not candidate.is_file():return self.send_error(404,'Not found')
        payload=candidate.read_bytes()
        mimetype,_=mimetypes.guess_type(candidate.name)
        self.send_response(200)
        self.send_header('Content-Type',(mimetype or 'application/octet-stream')+('; charset=utf-8' if (mimetype or '').startswith(('text/','application/javascript')) else ''))
        self.send_header('Content-Length',str(len(payload)))
        self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        path=urlsplit(self.path).path
        if path not in ('/api/profile','/api/listings','/api/requests'):
            return self.respond({'error':'Endpoint not found'},404)
        try:
            obj=self.read_json()
            with connect_db() as con:
                if path=='/api/profile':
                    acct=obj.get('account_type')
                    if acct not in ('person','business'):raise ValueError('Select personal or company account')
                    if not safe_text(obj.get('name')):raise ValueError('Please provide an account display name')
                    supplier=obj.get('supplier')
                    if supplier not in PROVIDERS:raise ValueError('Choose an electricity provider')
                    contract=obj.get('contract_type')
                    if contract not in ('fixed','variable','dynamic','unknown'):raise ValueError('Select a contract type')
                    safe={
                        'account_type':acct,'name':safe_text(obj.get('name'),90), 'email':safe_text(obj.get('email'),120),
                        'supplier':supplier,'contract_type':contract,'grid_operator':'Enexis (indicative Groningen region)',
                        'connection_type':safe_text(obj.get('connection_type'),70),'connection_amps':safe_number(obj.get('connection_amps'),5000),
                        'contracted_kw':safe_number(obj.get('contracted_kw'),5000),
                        'roles':[str(k) for k in obj.get('roles',[]) if k in ('producer','consumer','battery','business_capacity')],
                        'solar_kwp':safe_number(obj.get('solar_kwp'),5000),'battery_kwh':safe_number(obj.get('battery_kwh'),50000),
                        'share_public':bool(obj.get('share_public')),'meter_consent':bool(obj.get('meter_consent')),
                        'location_area':safe_text(obj.get('location_area'),80),
                        'acknowledged_simulation':bool(obj.get('acknowledged_simulation')),
                        'saved_at':datetime.now().isoformat(timespec='seconds')}
                    if not safe['acknowledged_simulation']:raise ValueError('Confirm you understand that this is only a local demo')
                    con.execute('INSERT OR REPLACE INTO profile(id,json) VALUES(1,?)',(json.dumps(safe),))
                    return self.respond({'ok':True,'profile':safe})
                if path=='/api/listings':
                    profile=read_profile(con)
                    if profile is None:raise ValueError('Create a local profile before publishing a demo listing')
                    kind=safe_text(obj.get('kind'))
                    if kind not in KINDS:raise ValueError('Listing type not recognized')
                    if kind=='mcc' and profile['account_type']!='business':raise ValueError('MCC listings require a business profile')
                    if not profile.get('share_public'):raise ValueError('Enable public-demo listing visibility in your profile first')
                    name=safe_text(obj.get('name'),90)
                    if not name:raise ValueError('Enter listing name')
                    area=safe_text(obj.get('location_area'),50) or 'Groningen'
                    point={'Binnenstad':(53.2177,6.5675),'Oosterpoort':(53.2074,6.5752),'Zernike':(53.239,6.538),
                         'Helpman':(53.1989,6.583),'Euvelgunne':(53.2158,6.616),'Paddepoel':(53.2316,6.545),
                         'Noorderplantsoen':(53.2258,6.560),'Sontplein':(53.2225,6.605)}.get(area,(53.218,6.568))
                    count=con.execute('SELECT count(*) FROM listings').fetchone()[0]
                    payload={'id':f'my-{count+1}','kind':kind,'name':name,'owner':profile['name']+' · local demo','lat':point[0]+.0007*(count%3),
                        'lon':point[1]+.0005*(count%4),'power_kw':safe_number(obj.get('power_kw'),10000),
                        'energy_kwh':safe_number(obj.get('energy_kwh'),100000),'price':safe_number(obj.get('price'),10),
                        'window':safe_text(obj.get('window'),50) or '12:00–16:00','supplier':profile['supplier'],
                        'verified':'User-entered · unverified','details':safe_text(obj.get('details'),300),
                        'feeder':'Unknown — not verified','connection':profile['connection_type'],'local':True}
                    if payload['power_kw']<=0:raise ValueError('Power must be positive')
                    con.execute('INSERT INTO listings(json) VALUES(?)',(json.dumps(payload),))
                    return self.respond({'ok':True,'listing':payload})
                if path=='/api/requests':
                    profile=read_profile(con)
                    if profile is None:raise ValueError('Create a local profile before requesting a match')
                    listing_id=safe_text(obj.get('listing_id'),50)
                    listings=all_listings(con)
                    listing=next((a for a in listings if a['id']==listing_id),None)
                    if listing is None:raise ValueError('Listing no longer exists')
                    qty=safe_number(obj.get('quantity'),100000)
                    if qty<=0:raise ValueError('Enter a positive requested quantity')
                    when=valid_date(obj.get('date') or DEMO_DAY)
                    match=next((m for m in get_engine().matches(listings,profile,when) if m['listing_id']==listing_id),None)
                    estimated_quantity=min(qty,match['quantity']) if match and match['quantity']>0 else 0
                    estimate=round(match['illustrative_value_eur']*estimated_quantity/match['quantity'],2) if estimated_quantity>0 else None
                    request={'listing_id':listing_id,'listing_name':listing['name'],'requester':profile['name'],
                             'quantity':qty,'unit':'kW' if listing['kind']=='mcc' else 'kWh', 'date':when,
                             'message':safe_text(obj.get('message'),300),
                             'estimated_savings_eur':estimate, 'estimated_quantity':estimated_quantity,
                             'savings_basis':'Synthetic gross opportunity estimate; not realized bill savings',
                             'status':'Draft — not sent or booked',
                             'important':'Local planning record only. No money, power or grid capacity transferred.'}
                    cur=con.execute('INSERT INTO requests(json) VALUES(?)',(json.dumps(request),))
                    return self.respond({'ok':True,'request':{'id':cur.lastrowid,**request}})
        except ValueError as err:return self.respond({'error':str(err)},400)
        except Exception as err:
            print('POST error:',repr(err))
            return self.respond({'error':'Could not save local demo data'},500)


def main():
    p=argparse.ArgumentParser(description='Run GridShare Groningen local demo')
    p.add_argument('--port',default=8765,type=int)
    p.add_argument('--open',action='store_true',help='Open browser on startup')
    args=p.parse_args()
    print('GridShare: checking synthetic 15-minute dataset and training forecast model...')
    engine=get_engine()
    print(f'GridShare: ready. Held-out forecast MAE: {engine.mae}')
    try:
        server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    except OSError as e:
        print(f'Cannot use port {args.port}: {e}. Try: python app.py --port 8766 --open');return
    url=f'http://127.0.0.1:{args.port}'
    print(f'\nOPEN THIS IN A BROWSER: {url}\nAll data stays on this computer. Press Ctrl+C to stop.\n')
    if args.open:threading.Timer(1,lambda:webbrowser.open(url)).start()
    try:server.serve_forever()
    except KeyboardInterrupt:print('\nStopping GridShare...')
    finally:server.server_close()

if __name__=='__main__':main()
