# GridShare

pnpm workspace for two independent TanStack Start / React / HeroUI applications.

| Directory      | Purpose                                                                   | Local URL             |
| -------------- | ------------------------------------------------------------------------- | --------------------- |
| `apps/landing` | GridShare marketing page and interactive Autopilot demo                   | http://127.0.0.1:5173 |
| `apps/web`     | Existing business dashboard prototype; starting point for the application | http://127.0.0.1:5175 |
| `server`       | Shared production HTTP adapter and tests                                  |
| `deploy`       | Restricted SSH, nginx and blue/green deployment scripts                   |
| `docs`         | Deployment instructions                                                   |

## Development

Run all commands from the repository root. Install pnpm 12.18.0, then:

```sh
pnpm --package=vite-plus@1.6.0 dlx vp install --frozen-lockfile
pnpm dev              # landing, with hot reload
pnpm dev:web          # dashboard, in a second terminal
pnpm check           # root and both applications
pnpm test            # HTTP adapter, landing rules, dashboard/data tests
pnpm build           # production builds for both applications
```

There is one workspace lockfile at the root. Install shared workspace dependencies from the root, or target an application with `pnpm --filter @gridshare/landing add PACKAGE` / `pnpm --filter @gridshare/web add PACKAGE`. Application source and Vite/TypeScript configuration stay within their application directory. Debug panels and their Vite plugin are opt-in with `VITE_DEVTOOLS=true`.

The dashboard is the recovered exploratory prototype, not a finished production application. Its data/simulation contract is in [apps/web/INTEGRATION.md](apps/web/INTEGRATION.md). The landing's behaviour, sources and assumptions are in [apps/landing/GRIDSHARE.md](apps/landing/GRIDSHARE.md). Registrations and energy trades remain demonstrations.

## Production

```sh
pnpm build
PORT=8080 pnpm start                 # landing by default
APP_NAME=web PORT=8081 pnpm start     # dashboard
```

The Docker build validates/builds both apps. Its default runtime serves the landing; `--build-arg APP_NAME=web` selects the dashboard image. The current hiqual pipeline deploys the landing to `aigrunn.evarela.dev`; the dashboard does not gain a public route automatically. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the existing Cloudflare route and required repository secrets.

```sh
docker build --build-arg VCS_REF=COMMIT_SHA -t grid-project:COMMIT_SHA .
docker build --build-arg APP_NAME=web -t grid-project-web:COMMIT_SHA .
```

## Migration

This monorepo is based on the repository's replacement initial commit (`ff930dc`). It restores the landing and CI/CD changes that predate the history reset and preserves the local dashboard prototype under `apps/web`. Previous checkouts are retained locally; no prior remote history is force-pushed back.
