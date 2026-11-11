"""Physical simulation of the park and the four controllers.

  best_solo        every business on its own contract (own GTV). Factory battery shaves its own
                   peak; fleet charges on arrival; cold-store flexibility unused. No exchange.
  no_coordination  same physics as best_solo, but a GTO and energy exchange inside the hub.
  rule_based       reactive group rules: battery, cold store and fleet react when the group
                   passes 90% of the group limit.
  gridshare_v0     forecast-based day plan (valley filling for fleet, battery and cold store)
                   plus a real-time safety layer that enforces the group limit every step.
                   Placeholder for the MILP/MPC coordinator; same interface.

Future decisions use only forecasts made from data before the planning moment. Reactive rules
and the safety layer may use the current measured step.
"""
import numpy as np
import pandas as pd

STEP_H = 0.25
DAY = 96


class World:
    def __init__(self, park, data, gtv, group_imp, group_exp, extra=None):
        self.p = park
        self.ids = list(park.index)
        self.load = data["load_kw"][self.ids].copy()
        if extra is not None:
            self.load = self.load + extra[self.ids]
        self.pv = data["pv_kw"][self.ids]
        self.wx = data["weather"]
        self.sessions = data["sessions"]
        self.gtv = gtv.reindex(self.ids).values.astype(float)
        self.imp, self.exp = float(group_imp), float(group_exp)
        self.bcap, self.bpow = park["bess_kwh"].values.astype(float), park["bess_kw"].values.astype(float)
        self.fcap, self.fpow = park["flex_kwh"].values.astype(float), park["flex_kw"].values.astype(float)

    def forecast_load(self, t0, n):
        i = self.load.index.get_loc(t0) - 7 * DAY          # same time last week
        return self.load.iloc[i: i + n].values

    def forecast_pv(self, t0, n):
        i0 = self.wx.index.get_loc(t0)
        prev = self.wx.iloc[i0 - DAY: i0]
        kt = prev["ghi_wm2"].sum() / max(prev["ghi_clear_wm2"].sum(), 1e-6)  # yesterday's clearness
        ghi = self.wx["ghi_clear_wm2"].iloc[i0: i0 + n].values * kt
        return np.outer(ghi / 1000 * 0.85, self.p["pv_kwp"].values)


def _store(soc, cap, want_kw, eff):
    """Applies a charge (+) or discharge (-) request to a store; returns (actual kW, new soc)."""
    if want_kw > 0:
        kw = min(want_kw, (cap - soc) / STEP_H / eff)
        return kw, soc + kw * STEP_H * eff
    kw = max(want_kw, -soc / STEP_H * eff)
    return kw, soc + kw * STEP_H / eff


def simulate(w: World, start, steps: int, controller: str) -> dict:
    i0 = w.load.index.get_loc(start)
    idx = w.load.index[i0: i0 + steps]
    n = len(w.ids)
    L, G = w.load.iloc[i0: i0 + steps].values, w.pv.iloc[i0: i0 + steps].values
    pos = {pid: k for k, pid in enumerate(w.ids)}
    tpos = {t: k for k, t in enumerate(idx)}

    # fleet sessions overlapping the window
    s = w.sessions[(w.sessions.depart > idx[0]) & (w.sessions.arrive <= idx[-1])]
    sess = []
    for r in s.itertuples():
        kwh = r.kwh
        if r.arrive < idx[0]:   # started before the window: assume it charged at full power since
            kwh = max(0.0, kwh - (idx[0] - r.arrive).total_seconds() / 3600 * r.kw)
            if kwh <= 1e-6:
                continue
        a = 0 if r.arrive < idx[0] else tpos[r.arrive]
        d = steps if r.depart > idx[-1] else tpos[r.depart]
        if d > a:
            sess.append([pos[r.pid], a, d, kwh, r.kw])

    # day-ahead forecasts (each day only uses data from before that day)
    Lf, Gf = np.zeros_like(L), np.zeros_like(G)
    for day in range(0, steps, DAY):
        m = min(DAY, steps - day)
        Lf[day: day + m] = w.forecast_load(idx[day], m)
        Gf[day: day + m] = w.forecast_pv(idx[day], m)

    ev_plan = np.zeros((steps, len(sess)))
    group_f = (Lf - Gf).sum(axis=1)
    if controller == "gridshare_v0":
        own_sur = (Gf - Lf) > 0
        for j, (p, a, d, kwh, kw) in sorted(enumerate(sess), key=lambda e: e[1][2] - e[1][1]):
            need = kwh
            for k in np.argsort(group_f[a:d] - 1e5 * own_sur[a:d, p]) + a:
                if need <= 1e-6:
                    break
                e = min(kw * STEP_H, need)
                ev_plan[k, j] = e / STEP_H
                group_f[k] += e / STEP_H
                need -= e
    # Risk days: forecast group load (with planned fleet charging) above 90% of the limit.
    # Before the forecast peak on those days, batteries and the cold store fill up in quiet steps.
    risk = np.zeros(steps, dtype=bool)
    before_peak = np.zeros(steps, dtype=bool)
    if controller == "gridshare_v0":
        for day in range(0, steps, DAY):
            seg = group_f[day: day + DAY]
            if seg.max() > 0.9 * w.imp:
                risk[day: day + DAY] = True
                before_peak[day: day + int(np.argmax(seg))] = True
            # also prepare during the previous evening/night for an early peak
            if day >= DAY and seg[: DAY // 3].max() > 0.9 * w.imp:
                before_peak[day - DAY // 3: day] = True
                risk[day - DAY // 3: day] = True

    bsoc, fsoc = 0.5 * w.bcap, 0.5 * w.fcap
    net = np.zeros((steps, n))
    bat = np.zeros((steps, n))
    flx = np.zeros((steps, n))
    evk = np.zeros((steps, n))
    through = np.zeros(n)
    ev_left = {j: sess[j][3] for j in range(len(sess))}
    for k in range(steps):
        # 1) fleet charging decisions
        ev = np.zeros(n)
        base = L[k] - G[k]
        group_now = base.sum()
        active = [j for j in ev_left if sess[j][1] <= k < sess[j][2] and ev_left[j] > 1e-6]
        for j in active:
            p, a, d, kwh, kw = sess[j]
            must = ev_left[j] > (d - k - 1) * kw * STEP_H
            if controller in ("best_solo", "no_coordination"):
                pw = kw
            elif controller == "rule_based":
                pw = kw if must or group_now < 0.9 * w.imp else 0.0
            else:
                pw = kw if must else ev_plan[k, j]
                if not must and group_now + pw > 0.97 * w.imp:    # safety layer: defer
                    pw = 0.0
            e = min(pw * STEP_H, ev_left[j])
            ev[p] += e / STEP_H
            ev_left[j] -= e
            group_now += e / STEP_H
        own = base + ev

        # 2) battery and cold-store flexibility
        b = np.zeros(n)
        f = np.zeros(n)
        for p in range(n):
            if w.bcap[p] > 0:
                gtv = w.gtv[p]
                if controller in ("best_solo", "no_coordination"):
                    if own[p] > 0.9 * gtv:
                        want = -(own[p] - 0.9 * gtv)
                    elif own[p] < 0:
                        want = -own[p]
                    else:
                        want = min(w.bpow[p], 0.6 * gtv - own[p]) if idx[k].hour < 5 else 0.0
                    want = max(want, -max(own[p], 0))   # on its own contract: no export
                elif controller == "rule_based":
                    if group_now > 0.9 * w.imp:
                        want = -(group_now - 0.9 * w.imp)
                    elif group_now < -0.9 * w.exp:
                        want = -group_now - 0.9 * w.exp
                    else:
                        want = -own[p] if own[p] < 0 else (min(w.bpow[p], 0.6 * gtv - own[p]) if idx[k].hour < 5 else 0.0)
                else:   # gridshare: shave against a threshold; pre-charge before forecast peaks
                    T = 0.95 * w.imp
                    if group_now > T:
                        want = -(group_now - T)
                    elif group_now < -0.95 * w.exp:
                        want = -group_now - 0.95 * w.exp
                    elif before_peak[k] and group_now < 0.75 * w.imp:
                        want = min(w.bpow[p], 0.8 * w.imp - group_now)
                    elif own[p] < 0:
                        want = -own[p]
                    elif not risk[k] and own[p] > 0.9 * gtv:
                        want = -(own[p] - 0.9 * gtv)
                    else:
                        want = 0.0
                kw, bsoc[p] = _store(bsoc[p], w.bcap[p], float(np.clip(want, -w.bpow[p], w.bpow[p])), 0.95)
                b[p] = kw
                through[p] += abs(kw) * STEP_H
                group_now += kw
            if w.fcap[p] > 0 and controller in ("rule_based", "gridshare_v0"):
                if controller == "rule_based":
                    if group_now > 0.9 * w.imp:
                        want = -(group_now - 0.9 * w.imp)
                    elif group_now < -0.9 * w.exp or (fsoc[p] < 0.5 * w.fcap[p] and group_now < 0.6 * w.imp):
                        want = w.fpow[p]
                    else:
                        want = 0.0
                else:   # gridshare: pre-cool before forecast peaks, shave above the threshold
                    T = 0.95 * w.imp
                    if group_now > T:
                        want = -(group_now - T)
                    elif group_now < -0.95 * w.exp:
                        want = w.fpow[p]
                    elif before_peak[k] and group_now < 0.75 * w.imp:
                        want = min(w.fpow[p], 0.8 * w.imp - group_now)
                    elif fsoc[p] < 0.5 * w.fcap[p] and group_now < 0.6 * w.imp:
                        want = w.fpow[p]
                    else:
                        want = 0.0
                want = float(np.clip(want, -min(w.fpow[p], max(L[k, p], 0)), w.fpow[p]))
                kw, fsoc[p] = _store(fsoc[p], w.fcap[p], want, 0.97)
                f[p] = kw
                group_now += kw

        # 3) safety layer (gridshare): enforce the group limit with what is left
        if controller == "gridshare_v0":
            over = group_now - 0.97 * w.imp
            under = -group_now - 0.97 * w.exp
            for p in range(n):
                if over > 0 and w.bcap[p] > 0:
                    extra, bsoc[p] = _store(bsoc[p], w.bcap[p], -min(over, w.bpow[p] + b[p]), 0.95)
                    b[p] += extra; through[p] += abs(extra) * STEP_H; over += extra; group_now += extra
                if over > 0 and w.fcap[p] > 0:
                    room = min(w.fpow[p] + f[p], L[k, p] + f[p])
                    extra, fsoc[p] = _store(fsoc[p], w.fcap[p], -min(over, max(room, 0)), 0.97)
                    f[p] += extra; over += extra; group_now += extra
                if under > 0 and w.bcap[p] > 0:
                    extra, bsoc[p] = _store(bsoc[p], w.bcap[p], min(under, w.bpow[p] - b[p]), 0.95)
                    b[p] += extra; through[p] += abs(extra) * STEP_H; under -= extra; group_now += extra
        net[k] = own + b + f
        bat[k] = b
        flx[k] = f
        evk[k] = ev
    fnet = Lf - Gf
    return {"idx": idx, "net": pd.DataFrame(net, index=idx, columns=w.ids),
            "forecast_net": pd.DataFrame(fnet, index=idx, columns=w.ids), "throughput": through,
            "battery_kw": pd.DataFrame(bat, index=idx, columns=w.ids),
            "flex_kw": pd.DataFrame(flx, index=idx, columns=w.ids),
            "fleet_kw": pd.DataFrame(evk, index=idx, columns=w.ids)}
