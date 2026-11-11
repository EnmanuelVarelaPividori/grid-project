"""Usage curves per connection type.

STYLISED profiles: shapes follow the typical daily rhythm of each type (opening hours, shifts,
24/7 cooling), not measured data. Replace each with the MFFBAS standard profile or real
15-minute meter data when available; the interface stays the same.

Each archetype gives:
  weekday / weekend : 24 hourly values, relative (local time, Europe/Amsterdam)
  heat / cool       : extra load per degree below 15 C / above 20 C, as a fraction of base
  season            : amplitude of a winter-high seasonal swing (lighting), as a fraction
  closed_holidays   : True if the site is mostly closed in school holidays (schools)
  annual_kwh        : typical yearly use, used when the cluster gives none
"""
import numpy as np
import pandas as pd

ARCHETYPES = {
    "home": dict(
        label="Home (household)", annual_kwh=2800, heat=0.0, cool=0.0, season=0.15,
        weekday=[.35, .30, .28, .27, .27, .30, .50, .80, .70, .50, .45, .45, .50, .45, .42, .45, .60, .90, 1.0, .95, .85, .70, .55, .42],
        weekend=[.40, .33, .30, .28, .28, .29, .35, .50, .70, .75, .70, .68, .70, .62, .58, .60, .70, .90, 1.0, .95, .85, .72, .58, .45]),
    "office": dict(
        label="Office building", annual_kwh=500_000, heat=0.012, cool=0.03, season=0.05,
        weekday=[.15, .15, .15, .15, .15, .18, .30, .65, .92, 1.0, 1.0, 1.0, .95, .98, 1.0, .97, .88, .60, .35, .22, .18, .16, .15, .15],
        weekend=[.15] * 24),
    "logistics": dict(
        label="Distribution centre (2 shifts)", annual_kwh=1_600_000, heat=0.006, cool=0.01, season=0.08,
        weekday=[.45, .45, .42, .40, .40, .55, .85, .95, 1.0, 1.0, .98, .95, .92, .95, .98, 1.0, .95, .90, .88, .85, .80, .70, .55, .48],
        weekend=[.35, .35, .33, .32, .32, .35, .45, .55, .60, .60, .58, .55, .45, .38, .35, .33, .32, .32, .32, .32, .33, .34, .35, .35]),
    "cold_storage": dict(
        label="Cold store (24/7)", annual_kwh=2_200_000, heat=0.0, cool=0.025, season=0.0,
        weekday=[.85, .84, .83, .83, .83, .85, .90, .96, 1.0, 1.0, 1.0, 1.0, .99, 1.0, 1.0, 1.0, .98, .95, .92, .90, .88, .87, .86, .85],
        weekend=[.86, .85, .84, .84, .84, .84, .85, .87, .89, .90, .91, .92, .92, .92, .92, .91, .90, .89, .88, .87, .87, .86, .86, .86]),
    "data_center": dict(
        label="Server room / data centre (24/7)", annual_kwh=1_300_000, heat=0.0, cool=0.006, season=0.0,
        weekday=[.97, .97, .96, .96, .96, .96, .97, .98, .99, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, .99, .99, .98, .98, .98, .97, .97],
        weekend=[.96] * 24),
    "factory_2shift": dict(
        label="Factory (2 shifts, 06-22)", annual_kwh=2_500_000, heat=0.004, cool=0.008, season=0.03,
        weekday=[.25, .24, .24, .24, .26, .55, .95, 1.0, 1.0, 1.0, .98, .95, .90, .97, 1.0, 1.0, .98, .97, .95, .93, .90, .85, .45, .28],
        weekend=[.22, .22, .21, .21, .21, .22, .24, .26, .28, .28, .27, .26, .25, .24, .23, .23, .23, .22, .22, .22, .22, .22, .22, .22]),
    "factory_3shift": dict(
        label="Factory (3 shifts, 24/5)", annual_kwh=4_000_000, heat=0.003, cool=0.006, season=0.02,
        weekday=[.90, .90, .89, .89, .89, .90, .95, 1.0, 1.0, 1.0, 1.0, .98, .96, 1.0, 1.0, 1.0, .98, .96, .95, .94, .93, .92, .91, .90],
        weekend=[.40] * 24),
    "hospital": dict(
        label="Hospital (24/7, critical)", annual_kwh=6_000_000, heat=0.008, cool=0.02, season=0.04,
        weekday=[.66, .64, .63, .63, .63, .66, .74, .86, .96, 1.0, 1.0, 1.0, .98, 1.0, 1.0, .98, .94, .88, .82, .78, .75, .72, .70, .68],
        weekend=[.66, .64, .63, .63, .63, .64, .67, .72, .76, .78, .79, .79, .78, .78, .77, .76, .75, .74, .73, .72, .71, .70, .69, .67]),
    "supermarket": dict(
        label="Supermarket / wholesale", annual_kwh=600_000, heat=0.004, cool=0.02, season=0.04,
        weekday=[.45, .44, .44, .44, .45, .50, .65, .85, .95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, .98, .95, .75, .55, .47],
        weekend=[.45, .44, .44, .44, .45, .48, .60, .80, .92, .97, .98, .98, .98, .98, .97, .96, .95, .92, .85, .70, .55, .50, .47, .46]),
    "school": dict(
        label="School", annual_kwh=150_000, heat=0.015, cool=0.0, season=0.15, closed_holidays=True,
        weekday=[.15, .15, .15, .15, .15, .15, .22, .55, .92, 1.0, 1.0, 1.0, .95, .98, .90, .60, .35, .25, .20, .18, .16, .15, .15, .15],
        weekend=[.12] * 24),
    "bakery": dict(
        label="Industrial bakery (night production)", annual_kwh=900_000, heat=0.0, cool=0.004, season=0.0,
        weekday=[.70, .85, 1.0, 1.0, 1.0, .95, .85, .70, .55, .50, .48, .46, .45, .45, .45, .45, .45, .45, .45, .45, .45, .48, .55, .62],
        weekend=[.60, .75, .90, .90, .85, .70, .55, .45, .40, .38, .36, .35, .35, .35, .35, .35, .35, .35, .35, .35, .35, .38, .42, .50]),
    "ev_depot": dict(
        label="EV fleet depot (base load only; charging is modelled per session)", annual_kwh=50_000, heat=0.0, cool=0.0, season=0.1,
        weekday=[.3, .3, .3, .3, .3, .5, 1.0, 1.0, .6, .5, .5, .5, .5, .5, .5, .6, .8, 1.0, .8, .5, .4, .3, .3, .3],
        weekend=[.3] * 24),
}

# School holidays region Noord 2025 (approximate, for the closed_holidays flag)
HOLIDAYS_2025 = [("2025-02-15", "2025-02-23"), ("2025-04-26", "2025-05-04"),
                 ("2025-07-05", "2025-08-17"), ("2025-10-11", "2025-10-19"), ("2025-12-20", "2026-01-04")]


def series(archetype: str, idx: pd.DatetimeIndex, temp_c: np.ndarray, annual_kwh: float | None = None,
           rng: np.random.Generator | None = None, noise: float = 0.06) -> np.ndarray:
    """15-minute load in kW for one connection of this archetype, scaled to annual_kwh."""
    a = ARCHETYPES[archetype]
    local = idx.tz_convert("Europe/Amsterdam")
    h = local.hour.values
    m = local.minute.values / 60
    wk = np.array(a["weekday"])
    we = np.array(a["weekend"])
    weekend = local.weekday.values >= 5
    nxt = (h + 1) % 24
    base = np.where(weekend, we[h] + (we[nxt] - we[h]) * m, wk[h] + (wk[nxt] - wk[h]) * m)  # smooth within the hour
    if a.get("closed_holidays"):
        day = local.normalize().tz_localize(None)
        for s, e in HOLIDAYS_2025:
            hol = (day >= pd.Timestamp(s)) & (day <= pd.Timestamp(e))
            base = np.where(hol, np.array(a["weekend"])[h], base)
    doy = local.dayofyear.values
    base = base * (1 + a["season"] * np.cos(2 * np.pi * (doy - 15) / 365))
    base = base * (1 + a["heat"] * np.clip(15 - temp_c, 0, None) + a["cool"] * np.clip(temp_c - 20, 0, None))
    if rng is not None and noise > 0:
        base = base * np.clip(1 + rng.normal(0, noise, len(idx)), 0.5, None)
    kwh = annual_kwh if annual_kwh is not None else a["annual_kwh"]
    return base / (base.sum() * 0.25) * kwh * (len(idx) / 35040)


def plot_all(path: str):
    """Writes a PNG with one panel per archetype: weekday and weekend curve, relative to its peak."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    keys = list(ARCHETYPES)
    fig, axes = plt.subplots(3, 4, figsize=(15, 9), sharex=True, sharey=True)
    hours = np.arange(24)
    for ax, key in zip(axes.flat, keys):
        a = ARCHETYPES[key]
        peak = max(max(a["weekday"]), max(a["weekend"]))
        ax.plot(hours, np.array(a["weekday"]) / peak, color="#2f6db0", lw=2, label="Weekday")
        ax.plot(hours, np.array(a["weekend"]) / peak, color="#d08a2e", lw=2, ls="--", label="Weekend")
        ax.set_title(a["label"].split(" (base")[0], fontsize=10)
        ax.set_xticks(range(0, 25, 6))
        ax.set_ylim(0, 1.08)
        ax.grid(alpha=0.3)
    for ax in axes[-1]:
        ax.set_xlabel("Hour (local time)")
    for ax in axes[:, 0]:
        ax.set_ylabel("Share of own peak")
    axes[0, 0].legend(fontsize=8, loc="lower right")
    fig.suptitle("GridShare usage curves per connection type (stylised, not measured)", fontsize=13)
    fig.tight_layout(rect=(0, 0, 1, 0.96))
    fig.savefig(path, dpi=130)
    plt.close(fig)
