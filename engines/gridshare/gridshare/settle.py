"""Settlement, capacity costs, platform revenue and the frozen scoreboard.

Tickets: Build the backtest harness and scoreboard (frozen: do not change after tagging);
Recommend a fair price per match (v0); Compare the best deal per participant.

Exchange inside the hub: at every step, energy exported by one business and imported by another
is matched pro rata. The buyer pays the midpoint between retail and feed-in, the seller receives
it; with GridShare, the platform keeps MARGIN_EUR_KWH, split between both sides. For large
businesses this runs through a supplier partner, not through Energiewet energy sharing.
"""
import numpy as np
import pandas as pd

from .cluster import (RETAIL_EUR_KWH as R, FEED_IN_EUR_KWH as FI, CAPACITY_EUR_PER_KW_YEAR as CAP,
                      SAAS_EUR_PER_MONTH, GAIN_SHARE, MARGIN_EUR_KWH)

STEP_H = 0.25
MID = (R + FI) / 2
STORAGE_PRICE = R - 0.02   # battery energy sold to the group: "rented" peak power, just under retail


def energy_and_exchange(net: pd.DataFrame, exchange: bool, margin: float = 0.0, battery_kw: pd.DataFrame | None = None):
    """Energy cost per connection (EUR, negative = income) and kWh exchanged.
    Exported energy that comes from a battery discharge is priced at STORAGE_PRICE instead of MID."""
    imp = net.clip(lower=0).values
    exp_ = (-net).clip(lower=0).values
    cost = (imp * R - exp_ * FI).sum(axis=0) * STEP_H
    if not exchange:
        return cost, 0.0
    I, E = imp.sum(axis=1), exp_.sum(axis=1)
    x = np.minimum(I, E)
    buy = np.divide(imp * x[:, None], I[:, None], out=np.zeros_like(imp), where=I[:, None] > 0) * STEP_H
    sell = np.divide(exp_ * x[:, None], E[:, None], out=np.zeros_like(exp_), where=E[:, None] > 0) * STEP_H
    cost -= buy.sum(axis=0) * (R - (MID + margin / 2))
    cost -= sell.sum(axis=0) * ((MID - margin / 2) - FI)
    if battery_kw is not None:
        # share of each seller's sold energy that came out of its battery, paid at the storage price
        from_batt = np.minimum((-battery_kw).clip(lower=0).values, exp_) * STEP_H
        sold_frac = np.divide(sell, exp_ * STEP_H, out=np.zeros_like(sell), where=exp_ > 0)
        batt_sold = from_batt * sold_frac                                  # kWh per step per seller
        uplift = batt_sold.sum(axis=1) * (STORAGE_PRICE - MID)             # EUR per step paid by buyers
        cost -= batt_sold.sum(axis=0) * (STORAGE_PRICE - MID)              # battery owners earn the uplift
        share_b = np.divide(buy, buy.sum(axis=1, keepdims=True), out=np.zeros_like(buy), where=buy.sum(axis=1, keepdims=True) > 0)
        cost += (share_b * uplift[:, None]).sum(axis=0)                    # buyers pay it pro rata
    return cost, float(x.sum() * STEP_H)


def capacity_cost(net: pd.DataFrame, gtv: np.ndarray, group_imp: float, gto: bool) -> np.ndarray:
    """Yearly cost of capacity increases triggered in this period (EUR per connection).
    Own contracts: each overshoot raises that business's GTV. GTO: only a group overshoot counts,
    shared pro rata to each business's import at the group peak."""
    imp = net.clip(lower=0)
    if not gto:
        return np.clip(imp.max().values - gtv, 0, None) * CAP
    group = net.sum(axis=1)
    over = max(0.0, float(group.max()) - group_imp)
    if over == 0:
        return np.zeros(net.shape[1])
    at_peak = imp.loc[group.idxmax()].values
    return over * CAP * at_peak / max(at_peak.sum(), 1e-9)


def business_case(park, nets: dict, gtv, group_imp, months: float, batteries: dict | None = None,
                  saas_per_unit: np.ndarray | None = None) -> dict:
    """Per-business yearly result of each controller against best_solo, after platform fees."""
    solo_e, _ = energy_and_exchange(nets["best_solo"], False)
    solo_c = capacity_cost(nets["best_solo"], gtv, group_imp, gto=False)
    units = np.ones(len(park)) + (park["bess_kwh"].values > 0)
    fee = saas_per_unit if saas_per_unit is not None else np.full(len(park), SAAS_EUR_PER_MONTH)
    out = {}
    for name, net in nets.items():
        gs = name == "gridshare_v0"
        e, x = energy_and_exchange(net, exchange=name != "best_solo", margin=MARGIN_EUR_KWH if gs else 0.0,
                                   battery_kw=(batteries or {}).get(name) if name != "best_solo" else None)
        c = capacity_cost(net, gtv, group_imp, gto=name != "best_solo")
        avoided = solo_c - c
        saas = units * fee * months if gs else np.zeros(len(park))
        share = GAIN_SHARE * np.clip(avoided, 0, None) if gs else np.zeros(len(park))
        gain = (solo_e - e) + avoided - saas - share
        out[name] = {
            "net_gain_eur": dict(zip(park.index, np.round(gain, 0))),
            "avoided_capacity_increase_eur": round(float(avoided.sum()), 0),
            "kwh_exchanged": round(x, 0),
            "businesses_better_off": int((gain > 0).sum()),
            "businesses_worse_off": int((gain < 0).sum()),
            "platform_revenue_eur": {
                "saas": round(float(saas.sum()), 0),
                "gain_share": round(float(share.sum()), 0),
                "exchange_margin": round(x * MARGIN_EUR_KWH, 0) if gs else 0.0,
                "gopacs": 0.0,
            },
        }
    return out


def technical(world, r: dict) -> dict:
    net = r["net"]
    group = net.sum(axis=1)
    pv_kwh = world.pv.loc[r["idx"]].values.sum() * STEP_H
    export_kwh = (-group).clip(lower=0).sum() * STEP_H
    imp = net.clip(lower=0)
    over_ind = np.clip(imp.max().values - world.gtv, 0, None)
    cap = world.bcap
    return {
        "group_limit_violations": int((group > world.imp + 1e-6).sum() + (group < -world.exp - 1e-6).sum()),
        "group_peak_import_kw": round(float(group.max()), 0),
        "group_peak_export_kw": round(float(-group.min()), 0),
        "solar_used_inside_park_pct": round(100 * (1 - export_kwh / pv_kwh), 1) if pv_kwh > 0 else 0.0,
        "businesses_over_own_gtv": int((over_ind > 1e-6).sum()),
        "own_gtv_overshoot_kw_total": round(float(over_ind.sum()), 0),
        "battery_cycles": round(float((r["throughput"][cap > 0] / (2 * cap[cap > 0])).sum()), 1),
    }
