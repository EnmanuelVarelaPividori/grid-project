"""Synthetic 15-minute year (ticket: Generate a synthetic 15-minute year for the cluster).

SYNTHETIC DATA. Weather is a clear-sky model for Groningen with random daily cloudiness;
loads come from the stylised usage curves in profiles.py with noise. Replace with KNMI or
Open-Meteo history and real meter data when available; the output shape stays the same.
"""
import numpy as np
import pandas as pd

from .profiles import series

LAT, LON = 53.22, 6.57


def time_index(year: int = 2025) -> pd.DatetimeIndex:
    return pd.date_range(f"{year}-01-01", f"{year+1}-01-01", freq="15min", tz="UTC", inclusive="left")


def weather(idx: pd.DatetimeIndex, seed: int = 1) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    doy = idx.dayofyear.values
    hour_utc = idx.hour.values + idx.minute.values / 60
    decl = np.radians(23.44) * np.sin(2 * np.pi * (284 + doy) / 365)
    ha = np.radians(15 * (hour_utc + LON / 15 - 12))
    lat = np.radians(LAT)
    sin_el = np.clip(np.sin(lat) * np.sin(decl) + np.cos(lat) * np.cos(decl) * np.cos(ha), 0, None)
    ghi_clear = np.where(sin_el > 0.01, 1098 * sin_el * np.exp(-0.057 / np.maximum(sin_el, 0.01)), 0)
    days = pd.Index(idx.normalize()).unique()
    season = 0.55 + 0.15 * np.sin(2 * np.pi * (np.arange(len(days)) - 80) / 365)
    kt = np.empty(len(days))
    kt[0] = season[0]
    for d in range(1, len(days)):
        kt[d] = np.clip(season[d] + 0.6 * (kt[d - 1] - season[d - 1]) + rng.normal(0, 0.15), 0.1, 1.0)
    kt_step = pd.Series(kt, index=days).reindex(idx.normalize()).values
    ghi = ghi_clear * np.clip(kt_step + rng.normal(0, 0.08, len(idx)), 0.05, 1.05)
    temp = 10 - 7 * np.cos(2 * np.pi * (doy - 20) / 365) + 3 * np.sin(2 * np.pi * (hour_utc - 9) / 24)
    temp = temp + np.repeat(rng.normal(0, 2.5, len(days)), 96)[: len(idx)]
    return pd.DataFrame({"ghi_wm2": ghi, "ghi_clear_wm2": ghi_clear, "temp_c": temp}, index=idx)


def fleet_sessions(park: pd.DataFrame, idx: pd.DatetimeIndex, seed: int = 3) -> pd.DataFrame:
    """Vans return 16-18h on weekdays and leave 06-07h; a few vans also charge at weekends."""
    rng = np.random.default_rng(seed)
    days = pd.Index(idx.tz_convert("Europe/Amsterdam").normalize()).unique()
    rows = []
    for pid, p in park[park.vans > 0].iterrows():
        for d in days[:-1]:
            n_vans = p.vans if d.weekday() < 5 else int(p.vans * 0.2)
            for v in range(n_vans):
                arr = d + pd.Timedelta(hours=float(rng.uniform(16, 18)))
                dep = d + pd.Timedelta(days=1, hours=float(rng.uniform(6, 7)))
                rows.append(dict(pid=pid, arrive=arr.tz_convert("UTC").floor("15min"),
                                 depart=dep.tz_convert("UTC").floor("15min"),
                                 kwh=float(p.van_kwh * rng.uniform(0.4, 0.9)), kw=float(p.charger_kw)))
    return pd.DataFrame(rows)


def build_year(park: pd.DataFrame, year: int = 2025, seed: int = 2) -> dict:
    rng = np.random.default_rng(seed)
    idx = time_index(year)
    wx = weather(idx)
    temp = wx["temp_c"].values
    load = {pid: series(p.archetype, idx, temp, p.annual_kwh, rng) for pid, p in park.iterrows()}
    pv = {pid: p.pv_kwp * wx["ghi_wm2"].values / 1000 * 0.85 for pid, p in park.iterrows()}
    return {"load_kw": pd.DataFrame(load, index=idx), "pv_kw": pd.DataFrame(pv, index=idx),
            "weather": wx, "sessions": fleet_sessions(park, idx)}


def expansion_kw(idx: pd.DatetimeIndex, temp_c: np.ndarray, kw_avg: float) -> np.ndarray:
    """Load of a new cold-store hall with average power kw_avg (same 24/7 cooling profile)."""
    return series("cold_storage", idx, temp_c, kw_avg * 8760)
