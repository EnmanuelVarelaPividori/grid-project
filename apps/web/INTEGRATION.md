# Energy demo integration

Paths below are relative to `apps/web`. This recovered prototype lives independently of the landing.

Claude Design supplies the visual design. Use the existing **HeroUI v3** dependencies to implement its components. The current local dashboard is an exploratory preview; its visual treatment is replaceable. No new framework or component dependencies have been added.

## Reusable modules

- `src/lib/energy-data.ts`: browser-compatible Open-Meteo and PDOK adapters with timeouts, cancellation and response validation; bundled Energy-Charts market data; missing-aware averages.
- `src/lib/simulation.ts`: framework-independent TypeScript, using `simulate(weather, scenario)` and `summarize(intervals)`.
- `src/lib/scenario-store.ts`: validated browser-local scenario persistence with SSR-safe subscriptions.
- `src/data/snapshot.json`: attributed real weather, Dutch prices and national generation, including the actual data date and retrieval timestamp.
- `scripts/refresh-data.mjs`: refresh bundled records with `node apps/web/scripts/refresh-data.mjs YYYY-MM-DD`. With no argument it uses today's date in Europe/Amsterdam. The weather API supports its recent-past/forecast window, not arbitrary historical dates. Failed or empty source responses preserve the existing snapshot.

## Data contract

Weather timestamps are Unix **seconds**. Power is in **kW**, energy in **kWh**, solar installation capacity in **kWp**. Energy-Charts prices arrive in **EUR/MWh**; divide by 10 for ct/kWh. Format display times explicitly with Europe/Amsterdam. Market records retain their actual date; never relabel a historical snapshot as today's live data.

The demo planning date is pinned to the bundled snapshot date so weather and price inputs align. Refresh the snapshot before a presentation. The browser refreshes weather for that date and verifies Groningen through PDOK; the market remains an explicitly dated snapshot because direct browser Energy-Charts requests returned restrictive CORS headers during research. API failures fall back to the attributed bundled records.

## Simulation assumptions

- Synthetic business demand: workshop, office or warehouse profile.
- Estimated PV output: hourly horizontal irradiance / 1,000 × installed kWp × 0.85. No site-specific roof geometry, shading or panel temperature model.
- Each hourly forecast is held over four 15-minute dispatch intervals. This does not create additional weather forecast precision.
- Solar surplus charges the battery. Stored energy discharges above the chosen import target. No grid charging or price arbitrage.
- Battery power and energy limits, 10% reserve and 90% round-trip efficiency are enforced. Initial SOC is the 10% reserve, so the comparison does not spend free starting energy.
- Unused stored energy remains at the end of the day and is reported. Solar captured onsite includes energy put into storage, not only energy already consumed.
- Import/export targets may remain exceeded when the battery cannot help. Export limits are monitored; PV curtailment is not implemented.
- This is an illustrative rule-based dispatch, not an optimal solver, a guaranteed bill-saving calculation or a hardware controller.

## Checks

From the monorepo root use `pnpm check`, `pnpm test`, and `pnpm build` to validate both apps and the shared runtime. Start this dashboard with `pnpm dev:web` (port 5175); `pnpm dev` starts the landing (port 5173).

Tests cover power and energy balance, battery limits, zero capacity and zero solar, missing measurements, HTTP failures and response validation.

## Attribution and access

- [Open-Meteo](https://open-meteo.com/): weather data attribution required; the public hosted API is for non-commercial use/evaluation, with commercial plans available.
- [Energy-Charts / Fraunhofer ISE](https://api.energy-charts.info/): generation data CC BY 4.0 unless otherwise stated. The NL price response identifies Bundesnetzagentur / SMARD.de under CC BY 4.0.
- [PDOK Locatieserver](https://www.pdok.nl/pdok-locatieserver): public Dutch geocoding.
- [Netbeheer Nederland capacity map](https://capaciteitskaart.netbeheernederland.nl/): contextual external link, not currently integrated as a live feed.

No API keys or customer telemetry are required for this frontend demo.
