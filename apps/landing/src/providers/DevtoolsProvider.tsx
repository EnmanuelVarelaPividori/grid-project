import {a11yDevtoolsPlugin} from "@tanstack/devtools-a11y/react";
import {TanStackDevtools} from "@tanstack/react-devtools";
import {FormDevtoolsPanel} from "@tanstack/react-form-devtools";
import {useQueryClient} from "@tanstack/react-query";
import {ReactQueryDevtoolsPanel} from "@tanstack/react-query-devtools";
import {useRouter} from "@tanstack/react-router";
import {TanStackRouterDevtoolsPanel} from "@tanstack/react-router-devtools";
import {TableDevtoolsPanel} from "@tanstack/react-table-devtools";

export function DevtoolsProvider() {
	const router = useRouter();
	const queryClient = useQueryClient();

	return (
		<TanStackDevtools
			plugins={[
				{name: "TanStack Query", render: <ReactQueryDevtoolsPanel client={queryClient} />},
				{name: "TanStack Router", render: <TanStackRouterDevtoolsPanel router={router} />},
				{name: "TanStack Form", render: <FormDevtoolsPanel />},
				{name: "TanStack Table", render: <TableDevtoolsPanel devtoolsOpen={true} />},
				a11yDevtoolsPlugin(),
			]}
		/>
	);
}
