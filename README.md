# GridShare

pnpm workspace containing the GridShare landing page built with TanStack Start, React and HeroUI v3.

| Directory      | Purpose                                                         |
| -------------- | --------------------------------------------------------------- |
| `apps/landing` | GridShare landing and interactive Autopilot demo                |
| `apps/web`     | GridShare Groningen dashboard: Python server + shadcn interface |

## Development

Run commands from the repository root using pnpm 12.18.0:

```sh
pnpm --package=vite-plus@1.6.0 dlx vp install --frozen-lockfile
pnpm dev       # landing with hot reload: http://127.0.0.1:5173
pnpm dev:api   # Python dashboard API: http://127.0.0.1:8765
pnpm dev:web   # dashboard with hot reload: http://127.0.0.1:5175
pnpm check     # formatting, lint and type checks
pnpm test      # landing and dashboard tests
pnpm build     # landing and dashboard builds
```

There is one root workspace lockfile. Install landing dependencies with `pnpm --filter @gridshare/landing add PACKAGE`. Lint and formatting are configured in the root `vite.config.ts`; the landing owns its framework/build configuration and source. Debug panels and their Vite plugin are opt-in with `VITE_DEVTOOLS=true`.

The landing's visual style, interactive behaviour, data sources and simulation assumptions are documented in [apps/landing/GRIDSHARE.md](apps/landing/GRIDSHARE.md). Signup forms and energy trades remain demonstrations.

CI runs checks, tests and a build. There is no Docker configuration or deployment pipeline. The dashboard frontend at `apps/web/hero-ui` is the `@gridshare/web` workspace and proxies its API to the Python server. See [its README](apps/web/README.md).

## Simulation engine

The Python energy hub simulation, documentation and sample outputs are in [engines/gridshare](engines/gridshare/README.md). Run its commands from that directory.
