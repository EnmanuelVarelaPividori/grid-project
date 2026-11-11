"""GridShare engine v1: business park energy hub (GTO).

    python run.py

Two scenarios, all on SYNTHETIC data:
  A. Today: the park as it is. Annual business case (net gain per business after platform
     fees) and held-out technical scoreboard.
  B. Expansion: the cold store adds a freezer hall it cannot get grid capacity for. The size
     is chosen on training weeks only; the held-out weeks then test it.
Writes to out/.
"""
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from gridshare.cluster import build_park, saas_units, SAAS_EUR_PER_MONTH, GAIN_SHARE, MARGIN_EUR_KWH, CAPACITY_EUR_PER_KW_YEAR
from gridshare.synth import build_year, expansion_kw
from gridshare.sim import World, simulate, DAY
from gridshare.settle import technical, business_case
from gridshare.profiles import plot_all, ARCHETYPES
from gridshare import export

OUT = Path("out")
OUT.mkdir(exist_ok=True)
CONTROLLERS = ["best_solo", "no_coordination", "rule_based", "gridshare_v0"]
GTV_FACTOR = {"C1": 0.95, "E1": 0.9, "F1": 0.9}   # ASSUMPTION: tight contracts for growing sites
EXPANSION_SITE = "C1"


def r10(x):
    return float(np.ceil(x / 10) * 10)


def weeks_of(data):
    wx = data["weather"]
    weekly = wx.resample("W-MON", label="left", closed="left").agg({"temp_c": "mean", "ghi_wm2": "mean"})
    return weekly.iloc[2:-1]


def lock_held_out(weekly):
    picks = {
        "coldest_dark_week": weekly["temp_c"].idxmin(),
        "sunny_spring_week": weekly[(weekly.index.month >= 4) & (weekly.index.month <= 5)]["ghi_wm2"].idxmax(),
        "heat_wave_week": weekly["temp_c"].idxmax(),
        "summer_holiday_week": weekly.index[weekly.index.get_indexer([pd.Timestamp("2025-07-28", tz="UTC")], method="nearest")[0]],
    }
    for i, w in enumerate([w for w in weekly.index[1::4] if w not in picks.values()][:8]):
        picks[f"spread_{i + 1}"] = w
    return sorted(picks.items(), key=lambda kv: kv[1])


def year_run(world, controller):
    start = world.load.index[7 * DAY]
    steps = len(world.load) - 7 * DAY - DAY
    return simulate(world, start, steps, controller), steps


def main():
    t0 = time.time()
    park = build_park()
    data = build_year(park)
    plot_all(str(OUT / "usage_curves.png"))

    # Contracts: own GTVs from an uncontracted solo year, then the GTO group limits from the solo year
    w0 = World(park, data, pd.Series(1e9, index=park.index), 1e9, 1e9)
    raw, _ = year_run(w0, "best_solo")
    gtv = pd.Series({pid: r10(raw["net"][pid].max() * GTV_FACTOR.get(pid, 1.05)) for pid in park.index})
    w1 = World(park, data, gtv, 1e9, 1e9)
    solo_year, _ = year_run(w1, "best_solo")
    g = solo_year["net"].sum(axis=1)
    group_imp, group_exp = r10(g.max()), r10(-g.min())   # status quo: no extra capacity from the operator

    weekly = weeks_of(data)
    held = lock_held_out(weekly)
    held_set = {w for _, w in held}
    (OUT / "held_out_weeks.json").write_text(json.dumps(
        {"locked": True, "note": "Chosen before any model work. Do not train or tune on these weeks.",
         "weeks": [{"label": k, "start_utc": str(v)} for k, v in held]}, indent=2))

    # ---------- Scenario A: today ----------
    wA = World(park, data, gtv, group_imp, group_exp)
    techA = {c: [] for c in CONTROLLERS}
    for label, w in held:
        for c in CONTROLLERS:
            techA[c].append({"week": label, **technical(wA, simulate(wA, w, 7 * DAY, c))})
    years = {c: year_run(wA, c) for c in CONTROLLERS}
    steps = years["best_solo"][1]
    months = steps * 0.25 / 730
    nets_y = {c: years[c][0]["net"] for c in CONTROLLERS}
    batt_y = {c: years[c][0]["battery_kw"] for c in CONTROLLERS}
    case = business_case(park, nets_y, gtv.values, group_imp, months, batt_y)
    # Sensitivity: tiered SaaS (EUR 150 for connections with GTV >= 250 kW, EUR 50 below)
    tier = np.where(gtv.values >= 250, SAAS_EUR_PER_MONTH, 50.0)
    case_tiered = business_case(park, nets_y, gtv.values, group_imp, months, batt_y, saas_per_unit=tier)["gridshare_v0"]

    # ---------- Scenario B: expansion, size chosen on training weeks only ----------
    idx, temp = data["load_kw"].index, data["weather"]["temp_c"].values
    train = [w for w in weekly.index if w not in held_set]
    hardest = sorted(train, key=lambda w: -float(solo_year["net"].sum(axis=1).loc[w: w + pd.Timedelta(days=7)].max()))[:6]
    def max_expansion(controller):
        best = 0
        for x in range(50, 1501, 50):
            ex = pd.DataFrame(0.0, index=idx, columns=park.index)
            ex[EXPANSION_SITE] = expansion_kw(idx, temp, x)
            wx = World(park, data, gtv, group_imp, group_exp, ex)
            if all(technical(wx, simulate(wx, w, 7 * DAY, controller))["group_limit_violations"] == 0 for w in hardest):
                best = x
            else:
                break
        return best
    expansion_capacity = {c: max_expansion(c) for c in ["no_coordination", "rule_based", "gridshare_v0"]}
    chosen = expansion_capacity["gridshare_v0"]
    extra = pd.DataFrame(0.0, index=idx, columns=park.index)
    extra[EXPANSION_SITE] = expansion_kw(idx, temp, chosen)
    wB = World(park, data, gtv, group_imp, group_exp, extra)
    techB = {c: [] for c in CONTROLLERS}
    resB = {}
    for label, w in held:
        for c in CONTROLLERS:
            r = simulate(wB, w, 7 * DAY, c)
            resB[(label, c)] = r
            techB[c].append({"week": label, **technical(wB, r)})

    def summ(rows):
        return {"group_limit_violations": sum(r["group_limit_violations"] for r in rows),
                "group_peak_import_kw": max(r["group_peak_import_kw"] for r in rows),
                "group_peak_export_kw": max(r["group_peak_export_kw"] for r in rows),
                "solar_used_inside_park_pct": round(float(np.mean([r["solar_used_inside_park_pct"] for r in rows])), 1),
                "weeks_with_own_gtv_overshoot": sum(r["businesses_over_own_gtv"] > 0 for r in rows),
                "battery_cycles": round(sum(r["battery_cycles"] for r in rows), 1)}

    sA = {c: summ(techA[c]) for c in CONTROLLERS}
    sB = {c: summ(techB[c]) for c in CONTROLLERS}
    gs = case["gridshare_v0"]
    pass_criteria = {
        "expansion_kw_absorbed_training_weeks": expansion_capacity,
        "gridshare_absorbs_most_expansion": chosen >= max(expansion_capacity.values()) and chosen > 0,
        "zero_group_violations_with_expansion_held_out": sB["gridshare_v0"]["group_limit_violations"] == 0,
        "every_business_better_off_after_fees_flat_saas": gs["businesses_worse_off"] == 0,
        "every_business_better_off_after_fees_tiered_saas": case_tiered["businesses_worse_off"] == 0,
    }
    reported = {
        "group_export_peak_reduction_pct_vs_no_coordination": round(100 * (1 - sA["gridshare_v0"]["group_peak_export_kw"] / sA["no_coordination"]["group_peak_export_kw"]), 1),
        "solar_used_inside_park_pct": {c: sA[c]["solar_used_inside_park_pct"] for c in CONTROLLERS},
        "note": "The park's large loads absorb almost all its solar, so these do not separate the controllers.",
    }
    (OUT / "scoreboard.json").write_text(json.dumps({
        "data": "SYNTHETIC",
        "assumptions": {"gtv_kw": gtv.to_dict(), "group_import_limit_kw": group_imp, "group_export_limit_kw": group_exp,
                        "capacity_tariff_eur_per_kw_year": CAPACITY_EUR_PER_KW_YEAR, "saas_eur_per_month": SAAS_EUR_PER_MONTH,
                        "saas_units": saas_units(park), "gain_share": GAIN_SHARE, "margin_eur_kwh": MARGIN_EUR_KWH,
                        "annual_case_covers_months": round(months, 1)},
        "pass_criteria": pass_criteria,
        "reported": reported,
        "scenario_A_today": {"held_out_summary": sA, "business_case_year": case,
                             "business_case_year_gridshare_tiered_saas": case_tiered, "per_week": techA},
        "scenario_B_expansion": {"expansion_site": EXPANSION_SITE, "expansion_kw": chosen,
                                 "held_out_summary": sB, "per_week": techB},
    }, indent=2, default=str))

    # ---------- Prototype JSON ----------
    peak_day = max(((label, d) for label, _ in held for d in range(7)),
                   key=lambda ld: float(resB[(ld[0], "no_coordination")]["net"].sum(axis=1).iloc[ld[1] * DAY:(ld[1] + 1) * DAY].max()))
    label, d = peak_day
    day0 = resB[(label, "no_coordination")]["idx"][d * DAY]
    sl = slice(d * DAY, (d + 1) * DAY)
    fnet = pd.DataFrame(wB.forecast_load(day0, DAY) - wB.forecast_pv(day0, DAY),
                        index=wB.load.index[wB.load.index.get_loc(day0): wB.load.index.get_loc(day0) + DAY], columns=wB.ids)
    sunny = max(((lb, dd) for lb, _ in held for dd in range(7)),
                key=lambda ld: float((-resB[(ld[0], "best_solo")]["net"]["L1"]).clip(lower=0).iloc[ld[1] * DAY:(ld[1] + 1) * DAY].sum()))
    sday = resB[(sunny[0], "best_solo")]["idx"][sunny[1] * DAY]
    fnet_s = pd.DataFrame(wB.forecast_load(sday, DAY) - wB.forecast_pv(sday, DAY),
                          index=wB.load.index[wB.load.index.get_loc(sday): wB.load.index.get_loc(sday) + DAY], columns=wB.ids)
    s = data["sessions"]
    fleet_kwh = float(s[(s.arrive >= day0 - pd.Timedelta(hours=12)) & (s.arrive < day0 + pd.Timedelta(hours=12))]["kwh"].sum())
    proto = {
        "generated_for": str(day0.tz_convert("Europe/Amsterdam").date()),
        "data": "SYNTHETIC: fictional business park, stylised usage curves, synthetic weather",
        "suppliers": [{"id": "partner", "name": "Supplier partner", "evening": 0.20, "feedIn": 0.05, "sharing": True}],
        "listings": export.listings(park, fnet, fleet_kwh),
        "scenarios": {
            "buy": {"you": "Cold store, expanding", "moneyLabel": "Peak headroom created (kW)",
                    **export.match_buy(park, resB[(label, "gridshare_v0")], resB[(label, "no_coordination")], sl,
                                       EXPANSION_SITE, chosen, group_imp)},
            "sell": {"you": "Distribution centre, 900 kWp roof", "moneyLabel": "Extra earned vs feed-in",
                     "for_date": str(sday.tz_convert("Europe/Amsterdam").date()), **export.match_sell(park, fnet_s, "L1")},
        },
        "substation": {"name": "Park substation (GTO group limit)", "limitKw": group_imp,
                       "loadOff": export.substation_curve(resB[(label, "no_coordination")]["net"].iloc[sl], group_imp),
                       "loadOn": export.substation_curve(resB[(label, "gridshare_v0")]["net"].iloc[sl], group_imp)},
        "scoreboard": {"expansionKw": chosen, "violationsWithExpansion": sB["gridshare_v0"]["group_limit_violations"],
                       "solarUsedInsidePct": sA["gridshare_v0"]["solar_used_inside_park_pct"],
                       "businessesBetterOff": gs["businesses_better_off"], "businesses": len(park)},
        "revenue": gs["platform_revenue_eur"],
    }
    (OUT / "gridshare_prototype.json").write_text(json.dumps(proto, indent=2, ensure_ascii=False, default=str))
    pd.DataFrame({k: v for k, v in [(a, ARCHETYPES[a]["weekday"]) for a in ARCHETYPES]}).to_csv(OUT / "usage_curves_weekday.csv", index_label="hour")
    pd.DataFrame({k: v for k, v in [(a, ARCHETYPES[a]["weekend"]) for a in ARCHETYPES]}).to_csv(OUT / "usage_curves_weekend.csv", index_label="hour")
    park.assign(gtv_kw=gtv).to_csv(OUT / "park.csv")
    print(json.dumps({"limits": {"group_imp": group_imp, "group_exp": group_exp, "gtv": gtv.to_dict()},
                      "pass": pass_criteria, "B_violations": {c: sB[c]["group_limit_violations"] for c in CONTROLLERS},
                      "A_peaks": {c: (sA[c]["group_peak_import_kw"], sA[c]["group_peak_export_kw"]) for c in CONTROLLERS},
                      "case_gs": case["gridshare_v0"], "case_nc": case["no_coordination"]["net_gain_eur"],
                      "tiered": case_tiered["net_gain_eur"]}, indent=1, default=str))
    print(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
