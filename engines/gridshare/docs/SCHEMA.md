# Data schema

## Time series (engine)

- Index: 15-minute steps in UTC (tz-aware). Local time (Europe/Amsterdam) only for display and usage curves.
- One column per connection id (`L1`, `O1`, `C1`, `D1`, `F1`, `E1`, `B1`, `W1`).
- Power in kW (average over the step), energy in kWh, temperature in °C, irradiance in W/m².
- Net load sign: positive = import from the grid, negative = export.
- Inputs: `load_kw`, `pv_kw`, weather (`ghi_wm2`, `ghi_clear_wm2`, `temp_c`), fleet sessions (`pid, arrive, depart, kwh, kw`).
- Simulation outputs: `net`, `battery_kw`, `flex_kw` (cold store pre-cooling: + = extra cooling now, − = less later), `fleet_kw`.

## Park table (`out/park.csv`)

`id, name, archetype, role (sells/stores/needs), street, annual_kwh, pv_kwp, bess_kwh, bess_kw, flex_kwh, flex_kw, vans, van_kwh, charger_kw, x, y, gtv_kw`

## Usage curves (`out/usage_curves_weekday.csv`, `..._weekend.csv`)

24 rows (local hour 0–23), one column per archetype, relative values. Heat, cool and season factors are in `gridshare/profiles.py`.

## Prototype JSON (`out/gridshare_prototype.json`)

| Key | Replaces in the page | Fields |
|---|---|---|
| `listings[]` | `LISTINGS` | `id, kind (solar/battery/ev/business), who, name, place, x, y, dist, amount, window, price, inArea, east, role` |
| `suppliers[]` | `SUPPLIERS` | one supplier partner that settles the exchange |
| `scenarios.buy` | `SCENARIOS.buy` | The cold store's expansion: `need, options[] {id, provider, sub, kwh, price, peakKw, value, score, needs}, explanation, peakWithoutKw, peakWithKw` |
| `scenarios.sell` | `SCENARIOS.sell` | The distribution centre's roof surplus on a sunny weekend day: `have, for_date, options[] {…, earn, value}, explanation` |
| `substation` | `LOAD_OFF`, `LOAD_ON` | `name, limitKw, loadOff[24], loadOn[24]`: hourly peak as % of the group limit (local hours) |
| `scoreboard` | new | `expansionKw, violationsWithExpansion, solarUsedInsidePct, businessesBetterOff, businesses` |
| `revenue` | new | `saas, gain_share, exchange_margin, gopacs` (EUR per year, flat SaaS) |

Differences from the current page: the buy scenario's money line becomes "peak headroom created (kW)", and the feeder chart becomes the substation chart, where above 100% means over the group limit.
