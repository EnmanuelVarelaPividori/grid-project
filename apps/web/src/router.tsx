import {QueryClient} from "@tanstack/react-query";
import {createRouter, ErrorComponent} from "@tanstack/react-router";
import {setupRouterSsrQueryIntegration} from "@tanstack/react-router-ssr-query";
import {routeTree} from "./routeTree.gen.ts";

export function getRouter() {
	const queryClient = new QueryClient({
		defaultOptions: {queries: {staleTime: 30_000}},
	});

	const router = createRouter({
		context: {queryClient},
		defaultErrorComponent: () => <ErrorComponent error />,
		defaultNotFoundComponent: () => <span>Not Found</span>,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		routeTree,
		scrollRestoration: true,
	});

	setupRouterSsrQueryIntegration({
		queryClient,
		router,
	});

	return router;
}

declare module "@tanstack/react-router" {
	//noinspection JSUnusedGlobalSymbols
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
