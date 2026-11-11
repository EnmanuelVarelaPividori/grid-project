# GridShare landing page

Implements the supplied GridShare / Autopilot visual reference using the existing **HeroUI v3** installation. The page uses HeroUI Button, Link, Card, Tabs, Slider, Switch, Modal, TextField, Input and Label components, with the reference's warm off-white, olive and sage palette. The neighbourhood map is an original, illustrative SVG; no map provider or tile key is required.

Paths below are relative to `apps/landing`; the workspace lockfile lives at the repository root.

## Run and verify

```sh
cd ../..
pnpm dev
pnpm check
pnpm test
pnpm build
```

The development panels are opt-in with `VITE_DEVTOOLS=true`. The default preview keeps their DOM-wide accessibility instrumentation off; production excludes them. The production build was used for desktop/mobile browser QA.

## Interactive behaviour

- Selling/buying, price bounds, energy budget, battery reserve, trading hours, household/business partners and supplier support change the trade preview.
- Compatible preferred neighbours are prioritized while respecting the hard constraints.
- The default selling example reproduces 5 deals, 10.0 kWh and €1.54 extra compared with the fictional €0.06/kWh feed-in tariff.
- The map supports asset filters, zoom, grid-area visibility, neighbour selection and preferences.
- The feeder comparison is a normalized illustration. It conserves shifted load, with a maximum 15% illustrative peak reduction. It is not calculated from live feeder telemetry or guaranteed savings.
- Pilot and supplier dialogs validate their inputs and show an in-page preview. They do not submit registrations or send messages. Form details are held only while the dialog remains open.

## Data and assumptions

`src/lib/autopilot.ts` contains the pure, deterministic rule-based allocator. Its tests cover the default example, price/time/area constraints, battery reserve, daily limits, partner filtering, supplier eligibility and load conservation. It is not a live trading, billing or equipment-control system.

The simulation assumes 6 kWh of daytime surplus/direct-use budget and a full 10 kWh battery before the evening, protected by the selected reserve. These are stated scenario assumptions, not outputs of the weather API. Buy-mode comparison uses a fictional €0.30/kWh import tariff.

`src/lib/energy-data.ts` queries Open-Meteo and PDOK in the browser with cancellation, timeouts, schema validation and a bundled fallback. Real market context is kept separate from fictional neighbour offers. Source badges distinguish live responses, recorded fallbacks, estimated concepts and simulated values. The snapshot's actual date is shown, including when live refresh is unavailable.

Attribution:

- Weather: [Open-Meteo](https://open-meteo.com/). Its public hosted API supports non-commercial prototyping; review the provider's commercial plan before commercial operation.
- Dutch market context: [Fraunhofer ISE Energy-Charts](https://api.energy-charts.info/), with NL prices attributed to Bundesnetzagentur / SMARD under CC BY 4.0, as stated by the source response.
- Location lookup: [PDOK Locatieserver](https://www.pdok.nl/pdok-locatieserver).
- Local congestion: contextual link to the [official capacity map](https://capaciteitskaart.netbeheernederland.nl/); not integrated as a live feed.

Refresh the bundled, attributed records before a presentation:

```sh
node apps/landing/scripts/refresh-data.mjs YYYY-MM-DD
```

The API planning date follows the bundled snapshot date. Failed source refreshes preserve the previous snapshot. The root `server`, `deploy`, and `.github` directories supply the production runtime and hiqual pipeline for this monorepo.
