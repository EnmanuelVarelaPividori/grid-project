# GridShare

pnpm workspace containing the GridShare landing page built with TanStack Start, React and HeroUI v3.

| Directory      | Purpose                                                         |
| -------------- | --------------------------------------------------------------- |
| `apps/landing` | GridShare landing and interactive Autopilot demo                |
| `apps/web`     | Empty placeholder for future application work (`.gitkeep` only) |

## Development

Run commands from the repository root using pnpm 12.18.0:

```sh
pnpm --package=vite-plus@1.6.0 dlx vp install --frozen-lockfile
pnpm dev       # landing with hot reload: http://127.0.0.1:5173
pnpm check     # formatting, lint and type checks
pnpm test      # landing tests
pnpm build     # landing production build
```

There is one root workspace lockfile. Install landing dependencies with `pnpm --filter @gridshare/landing add PACKAGE`. Lint and formatting are configured in the root `vite.config.ts`; the landing owns its framework/build configuration and source. Debug panels and their Vite plugin are opt-in with `VITE_DEVTOOLS=true`.

The landing's visual style, interactive behaviour, data sources and simulation assumptions are documented in [apps/landing/GRIDSHARE.md](apps/landing/GRIDSHARE.md). Signup forms and energy trades remain demonstrations.

CI runs checks, tests and a build. There is no Docker configuration or deployment pipeline. `apps/web` intentionally has no app, dependencies or dev server.
