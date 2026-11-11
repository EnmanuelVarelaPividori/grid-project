# Reproducible data, forecast and settlement schema

## The data is synthetic

`engine/model.py` generates a seeded year at exactly **15-minute resolution**. It creates one weather record for each of 35,040 quarter-hours and **six** fictional site rows per interval (210,240 rows), containing:

`date, slot (0–95), asset_id, demand_kw, solar_kw, flexible_kw, temperature_c, cloud_fraction, sun_index, eur_per_kwh`

The `weather_2026_synthetic_15min.csv` columns are `date, slot, temperature_c, cloud_fraction, sun_index, source`. Source always explicitly identifies synthetic weather.

`standard_profiles_synthetic.json` describes fictional site sectors, solar nameplate kWp, and a **fictional** eastern Groningen group ID. Display pin geography is approximate Groningen, not derived from private addresses or real feeder boundaries.

### Participant roles in the demo cluster

- `solar_hub`: high rooftop PV warehouse
- `bakery`: morning-heavy production load
- `ev_depot`: EV charging with shiftable evening demand
- `cold_storage`: temperature-sensitive storage load
- `factory`: shiftable workshop process
- `offices`: weekday office usage
- One virtual **230 kWh / 72 kW** shared battery (separate from the six load/generation profiles)

The demo feeder cap is **325 kW**, arbitrary and clearly not from Enexis. All cluster-level metrics are for this hypothetical group.

## Forecast training

Train on all non-held-out data in the 2026 dataset using season/month, day type, 15-minute slot and the forecast weather fields. The forecast uses learned means and weather corrections. **Neither held-out week contributes to forecast training.**

**Test weeks:** 2026-10-12 to 2026-10-18, and 2026-10-26 to 2026-11-01. These are hard-coded so repeated runs yield comparable results.

Backtesting constructs future schedules from **forecasted** demand and solar and applies the scheduled changes to **actual synthetic** measurements in test weeks. Scores compare four methods on the **same realized samples**. Important caveat: it does not model intraday forecast refresh, contract settlement, market dispatch, or all network-level physical constraints.

The chart's uncertainty band is calculated from held-out MAE as a **heuristic**. It is not a statistically calibrated 95% prediction interval.

## Financial modelling

All prices are synthetic, inclusive demo rate of €0.26/kWh plus illustrative time-of-use adjustments. Export credit is a fixed €0.045/kWh assumption. No supplier-specific tax, grid fees, battery wear or capacity contract fees are applied.

A proposed partner's monetary estimate is an **illustrative gross opportunity**, not guaranteed saving or a concluded trade.

## CO2 and sustainability

Emissions calculations use **synthetic** time-of-day weights in `engine/model.py`. These are not actual carbon intensity or marginal emissions for Groningen. Battery loss increases imported kWh. Lower load peaks do not necessarily save power. The reported on-site PV use measure is a proxy and cannot be reported as measured avoided renewable curtailment.

## Real data upgrade path

With explicit permissions and appropriate contracts, a future pilot could replace the synthetic weather CSV and site data with validated historical readings and forecast weather; train out of sample by day and time block; document missing intervals, calendar effects, privacy, units, asset ownership and agreed connection limits. No such integrations are made by default.
