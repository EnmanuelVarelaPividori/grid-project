"""Matching on forecast overlap (v0) and the JSON the GridShare prototype reads.

Tickets: Match sellers and buyers on forecast overlap; Agree the data schema and the JSON the
prototype reads; Generate the match explanations (templates v0).
"""
import numpy as np
import pandas as pd

from .cluster import RETAIL_EUR_KWH as R, FEED_IN_EUR_KWH as FI, MARGIN_EUR_KWH
from .settle import MID

STEP_H = 0.25
YOU = (560, 300)
M_PER_PX = 2.5
BUY_PRICE = round(MID + MARGIN_EUR_KWH / 2, 3)
SELL_PRICE = round(MID - MARGIN_EUR_KWH / 2, 3)


def _window(s: pd.Series, thr: float) -> str:
    on = s[s > thr]
    if on.empty:
        return "—"
    if len(on) >= 0.9 * len(s):
        return "24/7"
    loc = on.index.tz_convert("Europe/Amsterdam")
    return f"Tomorrow {loc.min().hour:02d}–{(loc.max().hour + 1) % 24:02d}h"


def listings(park, fnet: pd.DataFrame, fleet_kwh: float) -> list:
    out = []
    for pid, p in park.iterrows():
        sur = (-fnet[pid]).clip(lower=0)
        dem = fnet[pid].clip(lower=0)
        if p.bess_kwh > 0:
            kind, amount, price, window = "battery", f"{p.bess_kwh * 0.6:.0f} kWh free", 0.03, "Charges in quiet hours · releases at the park peak"
        elif sur.sum() * STEP_H > 50:
            kind, amount, price, window = "solar", f"{sur.sum() * STEP_H:,.0f} kWh", SELL_PRICE, _window(sur, 20)
        elif p.vans > 0:
            kind, amount, price, window = "ev", f"{fleet_kwh:,.0f} kWh", BUY_PRICE, "Flexible, ready by 06:00"
        else:
            kind, amount, price, window = "business", f"{dem.sum() * STEP_H:,.0f} kWh", BUY_PRICE, _window(dem, dem.max() * 0.7)
        dist = np.hypot(p.x - YOU[0], p.y - YOU[1]) * M_PER_PX
        out.append(dict(id=pid, kind=kind, who="Business", name=p["name"], place=p.street, x=int(p.x), y=int(p.y),
                        dist=f"{dist:.0f} m", amount=amount, window=window, price=price, inArea=True, east=True,
                        role=p.role))
    return out


def match_buy(park, r_on: dict, r_off: dict, sl: slice, buyer: str, extra_kw: float, group_imp: float) -> dict:
    """The cold store wants a freezer hall the grid cannot connect. The options are the
    flexibility sources GridShare actually used on this day to keep the group under its limit."""
    from .settle import STORAGE_PRICE
    on = r_on["net"].iloc[sl].sum(axis=1)
    off = r_off["net"].iloc[sl].sum(axis=1)
    peak_steps = off > 0.9 * group_imp                          # when the park would be near or over its limit
    if not peak_steps.any():
        peak_steps = off >= off.quantile(0.9)
    batt = park[park.bess_kwh > 0].index
    fleet = park[park.vans > 0].index
    b = (-r_on["battery_kw"].iloc[sl][batt].sum(axis=1)).clip(lower=0)
    f = (-r_on["flex_kw"].iloc[sl][buyer]).clip(lower=0)
    shift = (r_off["fleet_kw"].iloc[sl][fleet].sum(axis=1) - r_on["fleet_kw"].iloc[sl][fleet].sum(axis=1)).clip(lower=0)
    opts = []
    if len(batt):
        bt = park.loc[batt[0]]
        opts.append(dict(id="b-battery", provider=f"{bt['name']}, charged overnight",
                         sub=f"{b[peak_steps].sum() * STEP_H:,.0f} kWh released during the park's peak hours",
                         kwh=round(float(b[peak_steps].sum() * STEP_H)), price=round(STORAGE_PRICE, 3),
                         peakKw=round(float(b[peak_steps].max())), needs=f"Storage agreement with {bt['name']}"))
    opts.append(dict(id="b-precool", provider="Your own cold store, pre-cooled in quiet hours",
                     sub=f"{f[peak_steps].sum() * STEP_H:,.0f} kWh of cooling moved out of the peak",
                     kwh=round(float(f[peak_steps].sum() * STEP_H)), price=0.0, peakKw=round(float(f[peak_steps].max())),
                     needs="Temperature band agreed with your quality manager"))
    if len(fleet):
        opts.append(dict(id="b-fleet", provider=f"{park.loc[fleet[0], 'name']}, charging shifted",
                         sub=f"{shift[peak_steps].sum() * STEP_H:,.0f} kWh of van charging moved to the night",
                         kwh=round(float(shift[peak_steps].sum() * STEP_H)), price=0.0, peakKw=round(float(shift[peak_steps].max())),
                         needs=f"Charging window agreement with {park.loc[fleet[0], 'name']}"))
    opts.append(dict(id="b-wait", provider="Grid operator waiting list", sub="Request extra contracted capacity and wait",
                     kwh=0, price=R, peakKw=0, needs="Capacity request; no date"))
    pmax = max(o["peakKw"] for o in opts) or 1
    for o in opts:
        o["value"] = o["peakKw"]
        o["score"] = 5 if o["id"] == "b-wait" else int(round(40 + 60 * o["peakKw"] / pmax))
    opts.sort(key=lambda o: -o["score"])
    used = [o for o in opts if o["id"] != "b-wait" and o["peakKw"] > 0]
    names = {"b-battery": "the factory battery", "b-precool": "pre-cooling in its own cold store", "b-fleet": "shifted van charging"}
    items = [f"{names[o['id']]} ({o['peakKw']} kW)" for o in used]
    parts = ", ".join(items[:-1]) + (" and " if len(items) > 1 else "") + items[-1] if items else "nothing"
    expl = (f"The new freezer hall adds about {extra_kw:.0f} kW. Without coordination the park would peak at "
            f"{off.max():,.0f} kW against its {group_imp:,.0f} kW group limit. GridShare forecast that peak a day ahead and "
            f"combined {parts}, so the park peaks at {on.max():,.0f} kW. The hall can open without waiting for grid reinforcement.")
    return dict(need=f"New freezer hall: +{extra_kw:.0f} kW, 24/7", options=opts, explanation=expl,
                peakWithoutKw=round(float(off.max())), peakWithKw=round(float(on.max())))


def match_sell(park, fnet, seller: str) -> dict:
    sur = (-fnet[seller]).clip(lower=0)
    total = float(sur.sum() * STEP_H)
    dem = fnet.drop(columns=[seller]).clip(lower=0)
    ov = pd.Series(np.minimum(dem.values, sur.values[:, None]).sum(axis=0) * STEP_H, index=dem.columns)
    opts = []
    left = total
    for bid in ov.sort_values(ascending=False).index[:2]:
        kwh = float(min(ov[bid], left))
        left -= kwh
        opts.append(dict(id=f"s-{bid}", provider=park.loc[bid, "name"], sub=f"{kwh:,.0f} kWh directly, while your roof produces",
                         kwh=round(kwh), earn=round(kwh * SELL_PRICE), peakKw=0, needs=f"Exchange agreement with {park.loc[bid, 'name']}"))
    opts.append(dict(id="s-feed", provider="Your supplier (feed-in)", sub="Export the surplus at the feed-in tariff",
                     kwh=0, earn=None, peakKw=0, needs="Nothing to arrange"))
    for o in opts:
        o["value"] = round(o["kwh"] * (SELL_PRICE - FI)) if o["earn"] is not None else 0
    vmax = max(o["value"] for o in opts) or 1
    for o in opts:
        o["score"] = 30 if o["earn"] is None else int(round(60 + 35 * o["value"] / vmax))
    opts.sort(key=lambda o: -o["score"])
    top = opts[0]
    expl = (f"Your roof makes about {total:,.0f} kWh more than you use tomorrow. {top['provider']} runs during exactly those hours, "
            f"so GridShare matches {top['kwh']:,} kWh at €{SELL_PRICE:.3f}/kWh: €{top['value']:,} more than feed-in.")
    return dict(have=f"{total:,.0f} kWh spare tomorrow, {_window(sur, 20)[9:]}", options=opts, explanation=expl)


def substation_curve(net: pd.DataFrame, limit: float) -> list:
    g = net.sum(axis=1)
    hourly = g.groupby(g.index.tz_convert("Europe/Amsterdam").hour).max()
    return [int(round(100 * v / limit)) for v in hourly.reindex(range(24)).fillna(0).values]
