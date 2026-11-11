# shadcn dashboard

The dashboard uses official shadcn/ui registry components (Radix / new-york) with GridShare colour tokens. Sidebar, buttons, cards, form fields, sheets, badges, alerts, tables, tooltips and charts are shadcn components. The map is the MIT-licensed mapcn component, powered by MapLibre with CARTO / OpenStreetMap attribution. The local Python API and model remain unchanged.

`hero-ui/` is the historical frontend directory name; it no longer depends on HeroUI. Compiled assets still use `static/heroui/` to preserve the existing Python server paths. The separate landing app retains its own dependencies and styling.

From the monorepo root:

```sh
pnpm --package=vite-plus@1.6.0 dlx vp install --frozen-lockfile
pnpm dev:api
# second terminal
pnpm dev:web
```

Open http://127.0.0.1:5175. The frontend proxies `/api` to port 8765. `pnpm --filter @gridshare/web build` compiles the dashboard for the Python server at port 8765. `/classic` retains the original fallback interface.

```sh
pnpm check
pnpm test
pnpm build
cd apps/web
python3 -m unittest discover -s tests
```

Map tiles and the MapLibre worker require internet; MapLibre requires WebGL. No API key or device control is used. Resource positions, grid eligibility and congestion remain demonstration data. Cost curves sum 15-minute import power × tariff, less export credit at the engine's illustrative €0.045/kWh. Interval powers are rounded by the API, so their accumulated totals can differ slightly from its unrounded daily totals. The curves support keyboard navigation, hover/touch tooltips and individual line toggles.

Registry sources live in `src/components/ui`; `components.json` records the shadcn configuration. Custom app logic remains checked by Vite+; upstream registry components keep their distributed formatting. `MAPCN-LICENSE` preserves mapcn attribution.

## Autopilot experience

The React interface is a read-only customer preview based on the landing page’s “connect once” proposition. Navigation is Overview, Activity, Energy network and Your setup. The fixed demo day is 12 November 2026; the scenario editor, manual listing/request forms, model controls and backtesting are no longer part of this interface. The classic interface and backend endpoints remain available for development.

`src/lib/autopilot-plan.js` adapts model suggestions to non-persisted planned activity. Preview plans are never inserted into the SQLite request history or described as settled trades. Existing saved drafts remain available in Activity and on the map. Headline costs and peak reductions remain neighbourhood totals, explicitly labelled as such. Account and device details are read-only; no actual device or supplier connections are claimed.
