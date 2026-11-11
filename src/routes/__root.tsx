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
			{href: "/vite.svg", rel: "icon", type: "image/svg+xml"},
			{href: appCss, rel: "stylesheet"},
		],
		meta: [
			{charSet: "utf-8"},
			{content: "width=device-width, initial-scale=1", name: "viewport"},
			{title: "Experimenting Workspace"},
		],
	}),
});

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
			<DevtoolsProvider />
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
