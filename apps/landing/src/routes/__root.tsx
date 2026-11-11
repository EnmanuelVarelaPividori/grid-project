import type {QueryClient} from "@tanstack/react-query";
import {createRootRouteWithContext, HeadContent, Outlet, Scripts} from "@tanstack/react-router";
import type {ReactNode} from "react";
import {DevtoolsProvider} from "@/providers/DevtoolsProvider.tsx";
import appCss from "@/styles/globals.css?url";

interface RouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
	head: () => ({
		links: [
			{href: "/favicon.svg", rel: "icon", type: "image/svg+xml"},
			{href: appCss, rel: "stylesheet"},
		],
		meta: [
			{charSet: "utf-8"},
			{content: "width=device-width, initial-scale=1", name: "viewport"},
			{title: "GridShare · Set your limits. Your energy trades itself."},
			{
				name: "description",
				content:
					"Explore local energy sharing in Groningen. Set your limits, meet your neighbours, and preview solar and battery trades with GridShare autopilot.",
			},
		],
	}),
});

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
			{import.meta.env.DEV && import.meta.env.VITE_DEVTOOLS === "true" && <DevtoolsProvider />}
		</RootDocument>
	);
}

function RootDocument({children}: Readonly<{children: ReactNode}>) {
	return (
		<html suppressHydrationWarning lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
