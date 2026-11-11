<!-- intent-skills:start -->

# TanStack Intent - before editing files, run the matching guidance command.

tanstackIntent:

- id: "@tanstack/react-table#create-table-hook"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-table#create-table-hook"
  for: "Build reusable React table infrastructure with createTableHook, useAppTable, createAppColumnHelper, shared features/defaults, component registries, AppTable/AppCell/AppHeader wrappers, and typed context hooks. Load for recurring application table conventions, scoped contexts, HMR cycles, or table prop drilling."
- id: "@tanstack/react-table#getting-started"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-table#getting-started"
  for: "Create and render a TanStack React Table v9 table with useTable, tableFeatures, stable data and columns, row/header models, and table.FlexRender. Load for a first React table, headless rendering, or when v8 useReactTable examples are producing the wrong setup."
- id: "@tanstack/react-table#table-state"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-table#table-state"
  for: "Read, select, subscribe to, and control React Table V9 state with useTable selectors, table.state, table.Subscribe, table.atoms, table.store, and external TanStack Store atoms. Load for controlled state, render performance, or React Compiler builder-method subscription problems."
- id: "@tanstack/react-table#with-tanstack-query"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-table#with-tanstack-query"
  for: "Compose React Table v9 with TanStack Query for server filtering, sorting, pagination, and infinite data. Load for query-key table state, manual* processing boundaries, server rowCount, keepPreviousData, or avoiding duplicated query-result state."
- id: "@tanstack/react-table-devtools#devtools"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/react-table-devtools#devtools"
  for: "Connect React Table v9 instances to Devtools with tableDevtoolsPlugin and useTanStackTableDevtools. Load for missing Table panels, registration lifecycle, required options.key, enabled state, or development versus explicit production exports."
- id: "@tanstack/router-core#router-core"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core"
  for: "Framework-agnostic core concepts for TanStack Router: route trees, createRouter, createRoute, createRootRoute, createRootRouteWithContext, addChildren, Register type declaration, route matching, route sorting, file naming conventions. Entry point for all router skills."
- id: "@tanstack/router-core#router-core/auth-and-guards"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/auth-and-guards"
  for: "Route protection with beforeLoad, redirect()/throw redirect(), isRedirect helper, authenticated layout routes (_authenticated), non-redirect auth (inline login), RBAC with roles and permissions, auth provider integration (Auth0, Clerk, Supabase), router context for auth state."
- id: "@tanstack/router-core#router-core/code-splitting"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/code-splitting"
  for: "Automatic code splitting (autoCodeSplitting), .lazy.tsx convention, createLazyFileRoute, createLazyRoute, lazyRouteComponent, getRouteApi for typed hooks in split files, codeSplitGroupings per-route override, splitBehavior programmatic config, critical vs non-critical properties."
- id: "@tanstack/router-core#router-core/data-loading"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/data-loading"
  for: "Route loader option, loaderDeps for cache keys, staleTime/gcTime/ defaultPreloadStaleTime SWR caching, pendingComponent/pendingMs/ pendingMinMs, errorComponent/onError/onCatch, beforeLoad, router context and createRootRouteWithContext DI pattern, router.invalidate, Await component, deferred data loading with unawaited promises."
- id: "@tanstack/router-core#router-core/navigation"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/navigation"
  for: "Link component, useNavigate, Navigate component, router.navigate, ToOptions/NavigateOptions/LinkOptions, from/to relative navigation, activeOptions/activeProps, preloading (intent/viewport/render), preloadDelay, navigation blocking (useBlocker, Block), createLink, linkOptions helper, scroll restoration, MatchRoute."
- id: "@tanstack/router-core#router-core/not-found-and-errors"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/not-found-and-errors"
  for: "notFound() function, notFoundComponent, defaultNotFoundComponent, notFoundMode (fuzzy/root), errorComponent, CatchBoundary, CatchNotFound, isNotFound, NotFoundRoute (deprecated), route masking (mask option, createRouteMask, unmaskOnReload)."
- id: "@tanstack/router-core#router-core/path-params"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/path-params"
  for: "Dynamic path segments ($paramName), splat routes ($ / _splat), optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext), useParams, params.parse/stringify, pathParamsAllowedCharacters, i18n locale patterns."
- id: "@tanstack/router-core#router-core/search-params"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/search-params"
  for: "validateSearch, search param validation with Zod/Valibot/ArkType adapters, fallback(), search middlewares (retainSearchParams, stripSearchParams), custom serialization (parseSearch, stringifySearch), search param inheritance, loaderDeps for cache keys, reading and writing search params."
- id: "@tanstack/router-core#router-core/ssr"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/ssr"
  for: "Non-streaming and streaming SSR, RouterClient/RouterServer, renderRouterToString/renderRouterToStream, createRequestHandler, defaultRenderHandler/defaultStreamHandler, HeadContent/Scripts components, head route option (meta/links/styles/scripts), ScriptOnce, automatic loader dehydration/hydration, memory history on server, data serialization, document head management."
- id: "@tanstack/router-core#router-core/type-safety"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-core#router-core/type-safety"
  for: "Full type inference philosophy (never cast, never annotate inferred values), Register module declaration, from narrowing on hooks and Link, strict:false for shared components, getRouteApi for code-split typed access, addChildren with object syntax for TS perf, LinkProps and ValidateLinkOptions type utilities, as const satisfies pattern."
- id: "@tanstack/router-plugin#router-plugin"
  run: "pnpm dlx @tanstack/intent@latest load @tanstack/router-plugin#router-plugin"
  for: "TanStack Router bundler plugin for route generation and automatic code splitting. Supports Vite, Webpack, Rspack, and esbuild. Configures autoCodeSplitting, routesDirectory, target framework, and code split groupings."

<!-- intent-skills:end -->

This project uses vite plus. search about it and run commands as vp ..

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Running Scripts

Run TypeScript and JavaScript files with `vpx <file>`, for example `vpx ./scripts/seed.ts --dry-run`. It handles enums, decorators, JSX, and tsconfig `paths`, so do not add `tsx` or `ts-node` to run scripts. `vpx --watch <file>` reruns the file when a file it uses changes, in place of `tsx watch`. `vp node <file>` runs plain Node.js.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Monorepo commands and directories

- `apps/landing` is the marketing app: the GridShare landing page and interactive Autopilot demo. Preserve its design and behaviour.
- `apps/web` is the GridShare Groningen dashboard: a standard-library Python server (`app.py`, `engine/`) with SQLite persistence, a React 19 + shadcn/ui dashboard interface in `apps/web/hero-ui` (the `@gridshare/web` pnpm workspace) and the original interface in `apps/web/static` (served at `/classic`). See `apps/web/README.md`. Run its tests with `python3 -m unittest discover -s tests` from `apps/web`.
- Use the single root pnpm workspace and lockfile. Root Vite config centralizes lint/format settings; the landing's Vite config owns its build and framework plugins.
- Run `pnpm dev` (landing, port 5173), `pnpm dev:api` (Python, port 8765), `pnpm dev:web` (dashboard, port 5175), `pnpm check`, `pnpm test`, and `pnpm build` from the repository root. The root test config discovers landing tests and dashboard calculation tests.
- Debug panels and the Vite debug plugin are opt-in with `VITE_DEVTOOLS=true`.
- There is no Docker, deployment runtime or deployment pipeline. CI runs root checks, tests and workspace builds. Do not reintroduce deployment work unless requested.
