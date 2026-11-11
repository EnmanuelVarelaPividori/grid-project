# GridShare landing page

Implements the supplied **GridShare landing page · Autopilot** design: Autopilot is on from day one and manages devices for the whole street, instead of the customer setting trading limits. The page uses the design's DM Sans / Manrope type and warm off-white, olive and sage palette. HeroUI v3 provides the Button, Modal, TextField, Input and Label components; segmented controls, the supplier select and the map controls are plain elements styled in `src/styles/globals.css`. The neighbourhood map is an original, illustrative SVG; no map provider or tile key is required.

Source paths below are relative to `apps/landing`; run the commands from the repository root. The workspace has one root lockfile.

## Run and verify

```sh
pnpm dev
pnpm check
pnpm test
pnpm build
```

The development panels are opt-in with `VITE_DEVTOOLS=true`. The default preview keeps their DOM-wide accessibility instrumentation off; production excludes them. The production build was used for desktop/mobile browser QA.

## Interactive behaviour

- **Autopilot (01):** Household/Business switches the found devices, guarantees and yesterday's simulated actions. Yearly use and price drive the 12-month savings prediction (steering + sharing, with a monthly bar chart). A supplier without energy sharing (Vast & Groen) blocks the local-share actions and leaves sharing out of the prediction, shown as an outline.
- **Flat grid (02):** one Oosterpoort street (40 homes + 4 businesses) with and without Autopilot. Both scenarios use the same daily energy (1,517 kWh), only moved in time; the line morphs between them.
- **Energy map (03):** drag to pan, zoom 0.8–1.8×, recenter, asset filters, grid-capacity zones and a detail card for the selected listing, including whether it is in your grid area.
- Pilot and supplier dialogs validate their inputs and show an in-page preview. They do not submit registrations or send messages. Form details are held only while the dialog remains open.

## Data and assumptions

`src/lib/autopilot.ts` contains the pure, deterministic model: customer profiles and actions, the savings prediction, the day feed and the street-load scenarios. Its tests cover the default household (€423 a year at 6,000 kWh and €0.30/kWh), suppliers without sharing, business savings, invalid input, and energy conservation and the street limit in the flat-grid chart. It is not a live forecasting, trading, billing or equipment-control system.

The prediction is a simplified rule set: homes save 35% of use × price × 0.5 from steering plus a fixed €108 from selling solar; businesses save 25% × price × 0.4 from steering plus 5% of use bought locally below their price (local solar at €0.16/kWh). Monthly weights spread steering across winter and sharing across summer. These are stated assumptions, not outputs of the weather or price APIs.

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

The API planning date follows the bundled snapshot date. Failed source refreshes preserve the previous snapshot. CI checks, tests and builds the landing only. No deployment configuration is included.
