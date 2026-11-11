# GridShare engine v1: business park energy hub

Engine for GridShare AI as a **Smart Energy Hub on a Groningen business park**. The businesses share one medium-voltage substation and one group transport agreement (GTO). One command builds the park, a synthetic year and the usage curves, runs the frozen backtest for four controllers, and writes the business case and the JSON the GridShare prototype reads.

```
pip install numpy pandas matplotlib
python run.py          # about 80 seconds; writes everything to out/
```

**All data is synthetic**: the park, the usage curves (stylised, not measured), the weather and the fleet sessions are fictional, and the contracts and tariffs are assumptions (see `out/scoreboard.json` → `assumptions`).

## The park

| Id | Business | Usage curve | Year use | Assets | Own GTV* |
|---|---|---|---|---|---|
| L1 | Distribution centre | 2 shifts, quiet weekends | 1.6 GWh | 900 kWp roof | 400 kW |
| O1 | Office building | weekdays 8–18 | 0.5 GWh | 250 kWp roof | 190 kW |
| C1 | Cold store | 24/7, more in heat | 2.2 GWh | 300 kWp, pre-cooling 150 kW / 500 kWh | 320 kW |
| D1 | Data centre | flat 24/7 | 1.3 GWh | — | 200 kW |
| F1 | Factory | 2 shifts, 06–22 | 2.5 GWh | 400 kWp, battery 500 kW / 1 MWh | 580 kW |
| E1 | EV fleet depot | 25 vans, charge overnight | 0.05 GWh + vans | 100 kWp | 260 kW |
| B1 | Industrial bakery | night production | 0.9 GWh | — | 240 kW |
| W1 | Wholesale | 06–22, refrigeration | 0.6 GWh | 150 kWp | 130 kW |

*Contracted capacity, derived from the synthetic year; the cold store, fleet depot and factory get tight contracts (growing sites). The GTO group limit is **1,770 kW** import, the park's own coincident peak, so the operator grants no extra capacity.

## Usage curves (`gridshare/profiles.py`)

The library holds 12 archetypes: home, office, distribution centre, cold store, data centre, factory (2 and 3 shifts), hospital, supermarket/wholesale, school, industrial bakery and EV fleet depot. Each has:

- a weekday and a weekend curve
- heating and cooling sensitivity to outdoor temperature
- a seasonal swing
- school holidays, for the school

`out/usage_curves.png` shows them all. Homes and the hospital are in the library but not in the park: households cannot join a GTO, and a hospital would be a fixed priority load. Replace any curve with the MFFBAS standard profile or real 15-minute meter data without changing anything else.

## Results (synthetic)

**Expansion: the cold store wants a 250 kW freezer hall the grid cannot connect.** The size is chosen on training weeks only; the held-out weeks then test it.

| | Own contracts | GTO, no coordination | Rule-based | GridShare v0 |
|---|---|---|---|---|
| Expansion the park can absorb (training weeks) | — | 0 kW | 150 kW | **250 kW** |
| Group limit violations with +250 kW (12 held-out weeks, 15-min steps) | 380 | 380 | 53 | **0** |
| Group peak with +250 kW | 2,001 kW | 2,001 kW | 1,891 kW | **1,682 kW** |

**Business case, one year without expansion: net gain per business against its own contract, after platform fees (€).**

| | L1 | O1 | C1 | D1 | F1 | E1 | B1 | W1 |
|---|---|---|---|---|---|---|---|---|
| GTO + exchange, no platform | 13,710 | 3,062 | 6,152 | 6,296 | 4,958 | 4,789 | 2,947 | 1,029 |
| GridShare, €150/month flat | 11,036 | 1,098 | 3,894 | 4,114 | 1,555 | 2,605 | 990 | **−801** |
| GridShare, tiered (€50 below 250 kW GTV) | 11,036 | 2,271 | 3,894 | 5,288 | 1,555 | 2,605 | 2,164 | 373 |

Platform revenue per park per year (tiered): SaaS €11,150, exchange margin €2,759, gain-share €232, GOPACS €0 (not modelled).

## What this tells the team (say it in the pitch)

1. **The AI's value is expansion, not euros on the energy bill.** Without coordination, the GTO and the exchange already deliver most of the bill savings. GridShare is the reason a 250 kW freezer hall can open without grid reinforcement, and it guarantees the group limit. Rules alone manage 150 kW.
2. **A flat €150/month makes the smallest business worse off.** The wholesaler gains about €1,000 a year from the exchange and pays €1,800 in SaaS. A fee tiered by contracted capacity keeps every business positive.
3. **The gain-share on avoided capacity increases is small here,** €232 a year. In this park only a few overshoots happen, and the €40/kW/year capacity tariff is an assumption. The real value of avoided overshoots is in congestion areas, where the operator no longer raises capacity at all. That's the expansion case, which needs a € value per kW of headroom from the businesses themselves (an interview question).
4. **Battery energy sold to neighbours needs a storage price.** At the plain exchange price the factory lost €8,800 a year. At just under retail it gains, and its battery now only works for the group on forecast risk days.
5. **Most of the park's solar is used inside the park anyway** (98%), so self-consumption isn't a selling point for this park.

## How GridShare v0 works (placeholder for the MILP/MPC coordinator)

- **Day ahead:** it forecasts each business's load (same time last week) and solar (clear-sky times yesterday's clearness). On days where the park is forecast above 90% of its limit, it plans fleet charging into the quietest hours. Before the forecast peak it fills the factory battery and pre-cools the cold store.
- **Every 15 minutes:** pre-cooling, then the battery, shave anything above 95% of the group limit. A final safety layer at 97% defers van charging and uses whatever storage is left.

## Files

| Path | What |
|---|---|
| `gridshare/profiles.py` | Usage curves for 12 connection types, plus the curve plot |
| `gridshare/cluster.py` | The park, tariffs, and revenue-model parameters (SaaS, gain-share, margin) |
| `gridshare/synth.py` | Synthetic weather, loads from the curves, solar, fleet sessions, expansion load |
| `gridshare/sim.py` | Forecasts, the four controllers, and the safety layer |
| `gridshare/settle.py` | Exchange settlement, storage price, capacity costs, business case, frozen scoreboard |
| `gridshare/export.py` | Listings, buy and sell scenarios, substation curve for the prototype |
| `run.py` | Contracts and group limit, locked held-out weeks, scenarios A and B, exports |
| `docs/SCHEMA.md` | Conventions and the prototype JSON |
| `out/` | `park.csv`, `usage_curves.png`, `usage_curves_week*.csv`, `held_out_weeks.json`, `scoreboard.json`, `gridshare_prototype.json` |

## Rules for whoever continues

1. Do not change `settle.technical`, `settle.business_case` or the held-out weeks once tagged. The judge runner owns the final run.
2. New controllers use the same `simulate(world, start, steps, name)` interface and only forecasts for future steps.
3. Replace synthetic inputs one at a time: weather history, then the usage curves, then real meter data per business.
