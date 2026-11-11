# GridShare Groningen dashboard

The React/shadcn frontend is part of the pnpm workspace. Run `pnpm dev:api` and `pnpm dev:web` in separate terminals from the monorepo root, then open **http://127.0.0.1:5175**. The landing uses port 5173. For a compiled preview served by Python, run `pnpm --filter @gridshare/web build`, then `python3 apps/web/app.py` and open http://127.0.0.1:8765.

See [shadcn setup](docs/SHADCN_SETUP.md) for the current commands. The original standalone Python/HTML interface below remains available at `/classic`.

---

## Current dashboard experience

The dashboard is a read-only Autopilot preview: Overview, Activity, Energy network and Your setup. Costs and peak reductions describe a simulated neighbourhood on 12 November 2026. Planned activity is separate from earlier saved drafts; no real trades or device operations occur.

The interface uses React, shadcn/ui, Tailwind, Recharts and mapcn/MapLibre. The historical `hero-ui` directory and launcher names remain for compatibility. The launchers build the dashboard with pnpm from the monorepo root; install workspace dependencies first.

## Classic interface reference

The Python-only marketplace below is the older interface served at `/classic`. Its manual profile, listing, request and scenario controls are not part of the current Autopilot dashboard.

# GridShare AI — Groningen

**A working, single-page, local energy-sharing marketplace prototype** inspired by the VOI scooter map. Built for a student AI/sustainability project in Groningen, Netherlands.

The whole demo works on your computer with **Python 3.10+**, a modern browser, and **no third-party Python packages, npm install, external account, or API keys**.

## Run locally with VS Code

1. Unzip `GridShare_Groningen.zip` somewhere you can keep it, such as Documents.
2. Open **VS Code → File → Open Folder** and select the `GridShare_Groningen` folder.
3. Open a terminal (**Terminal → New Terminal**) and run:

   - **Windows:** `py app.py --open` (or `python app.py --open`)
   - **macOS/Linux:** `python3 app.py --open`

   Or double-click `run_windows.bat` (Windows) or use `./run_mac_linux.sh` (Mac/Linux).

4. If the browser doesn't open automatically, visit **http://127.0.0.1:8765**.
5. Stop the server with **Ctrl+C** in the terminal.

If port 8765 is already used: `python app.py --port 8766 --open`.

**Offline behavior:** The app, simulated listings, charts, accounts, and backend work without internet. Online OpenStreetMap basemap tiles and an _optional_ publicly published provincial GIS cable overlay may need an internet connection. An illustrated **schematic** map remains visible offline. Network geography, simulated asset pins and feeder topology are not proof of an electrical connection.

## What you can do

### Map — one page, VOI-inspired

- Navigate a Groningen-only map with colored clickable pins and search/filter tools.
- Discover four resource types: **surplus electricity**, **battery storage**, **flexible demand**, and **Maximum Connection Contract (MCC)** capacity-coordination candidates.
- View power in kW, electricity or storage energy in kWh, time windows, indicative price, electricity provider, connection category, and eligibility warnings.
- Pan, zoom and recenter; enable a **clearly simulated** congestion heat overlay.
- Optionally display published Groningen medium-voltage station/cable **GIS geometry** from the Province of Groningen service when online. This is not actual line loading, congestion, or verified connectivity.
- Open the **official Netbeheer Nederland capacity map** in a separate browser tab. The app does not falsely claim this source reports exact real-time capacity per building.

### On-page registration — not a separate login page

- Personal or business **local profile** in a slide-over panel.
- Display name, optional email, Groningen neighborhood, electricity **supplier/provider**, supply contract type (fixed/variable/dynamic), physical connection size (e.g. 3 × 25 A), maximum current (A), contracted transport capacity (kW), installed solar and battery capacities, and participation roles.
- Public-demo listing consent and optional future meter integration interest.
- Create public-on-this-computer listings and save **draft** match requests for future dates.
- Edit your local information in **My space**. The profile survives restarts in `data/gridshare.sqlite3`.

**Security note:** This is **not a production account system**. It deliberately has no passwords, cloud identity verification, multiuser authorization, payment processing or smart-meter access. Do not put real personal/energy-account secrets into it or expose the app to the internet.

### AI & optimization

- Deterministic **synthetic full-year 2026 dataset at 15-minute resolution** for six fictional cluster participants, plus synthetic weather and standard usage profiles.
- Local, **trained seasonal/weather forecast** for load and PV. The evaluation excludes two explicit held-out test weeks. It is a small explainable statistical model, not an LLM pretending to predict real grid conditions.
- Discovery ranking by time-window overlap, supplier name, fictional feeder category for MCC, and proximity.
- Proposed partner explanations, gross modelled opportunity values, and missing eligibility checks.
- **Schedule flexible EV/workshop demand**, with an illustrative shared feeder limit.
- **Model a battery** with rate, capacity, state-of-charge and 90% round-trip efficiency; no free daily energy granted to the simulation.
- Daily comparison of **cost, peak demand, overload hours, storage output, solar self-use proxy, and synthetic emissions-weighted demand**.
- Scenario selector: **no coordination / best solo / rule-based / GridShare optimized**.
- Head-to-head benchmark over 14 held-out days, with separate forecasting MAE and reproducible scorecard.
- **Compare best deal per participant** table (proposals only).

### Optional FlexMeasures bridge

- `integrations/flexmeasures_adapter.py` documents the published API v3 scheduling endpoint and provides a lightweight optional client for **your own** separately hosted FlexMeasures instance.
- **FlexMeasures is not included, running, or required by this app.** No meter, inverter, battery or charger receives real control commands.
- The default scheduling engine is our own readable Python heuristic, so the demo always runs locally.

## What's intentionally NOT live

This is a software research prototype and **does not**:

- transfer electricity between houses or sell power;
- rent someone's battery, settle multi-period storage services, or debit money;
- move spare amperes from one connection to another;
- verify that two pins connect to the same real feeder or qualify for an Enexis GTO;
- access a real meter, solar inverter, real supplier, billing system, official live congestion feed or battery API;
- guarantee energy savings, climate benefits, or modeled prices.

### Important MCC terminology

The project uses **Maximum Connection Contract (MCC)** as a friendly product name. Real-world terms include **connection rating** (e.g. `3 × 160 A`), **actual current** (A), and **contracted transport capacity** (usually kW). They are different. Unused 80 A on a 100 A connection is not freely transferable property. An eligible energy hub may coordinate transport capacity through an **approved group transport agreement (GTO)** and a suitable energy management system. See Enexis reference below.

### Sustainability reporting caveats

- kWh of electricity is different from kW of power and A of current.
- Storage losses can increase electricity consumption.
- Lowering a local grid peak is not automatically the same as saving kWh or CO₂.
- Cost estimates use **fictional example tariffs** and omit real tax/provider/transport settlement details.
- CO₂e comparisons use _synthetic_ time-of-day emission factors, not a verified Dutch emissions dataset.
- A solar on-site use proxy cannot be marketed as measured avoided curtailment.

## Architecture & data

```text
GridShare_Groningen/
  app.py                             Local HTTP API and SQLite persistence
  engine/model.py                    Synthetic year, trained model, matching, 15-min scheduling, backtest
  integrations/flexmeasures_adapter.py  Optional future EMS adapter (inactive)
  static/index.html                  One-page interface and slide-in forms
  static/styles.css                  Responsive VOI-inspired UI; offline schematic
  static/app.js                      Map, cards, registration, requests and dashboards
  data/cluster_2026_synthetic_15min.csv   Generated deterministic data
  data/weather_2026_synthetic_15min.csv   Generated synthetic weather
  data/standard_profiles_synthetic.json  Participant metadata
  data/gridshare.sqlite3             Created locally on first launch (your local edits)
  tests/                             Standard-library test suite
  docs/                              Schema, feature coverage, limitations, SURF and sources
  run_windows.bat / run_mac_linux.sh Simple launch scripts
```

Data CSV files are supplied in the ZIP. If they are removed, `python app.py` regenerates them deterministically. It may take several seconds on first launch and consumes some memory while training.

**Test the project:** From the project folder run `python -m unittest discover -s tests -v`. No install needed.

## Shared environment / SURF Research Cloud

The prototype has **not been deployed to SURF Research Cloud** and your team will need access and a suitable deployment policy. The script binds only to `127.0.0.1` by default. See `docs/SURF_SETUP.md` for an SSH-tunnel-only demonstration approach. **Do not** expose this demo server publicly: it lacks production authentication and access controls.

## Real sources for further work

- [Netbeheer Nederland — official national capacity map](https://capaciteitskaart.netbeheernederland.nl/)
- [National map CSV export documentation](https://capaciteitskaart.netbeheernederland.nl/info/algemene-info/)
- [Province of Groningen — published Enexis GIS](https://geoservices.provinciegroningen.nl/server/rest/services/BasisdataExtern/EnergieEnexis/MapServer)
- [Enexis — group transport agreement conditions](https://www.enexis.nl/zakelijk/netcapaciteit/flexibiliteitsoplossingen/groepstransportovereenkomst)
- [ACM — group transport agreement legal decision](https://www.acm.nl/nl/publicaties/codebesluit-groepstransportovereenkomst)
- [FlexMeasures — open-source EMS](https://github.com/FlexMeasures/flexmeasures)
- [FlexMeasures — scheduling docs](https://flexmeasures.readthedocs.io/latest/features/scheduling.html)

**Licensing of the prototype:** MIT for our original source code in this folder. This doesn't license third-party map tiles, the public data sources, external software or the startup reference PDF, which is kept out of this repository. OpenStreetMap attribution is shown in the map when tiles are used. See `LICENSE`.
