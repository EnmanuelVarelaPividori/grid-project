import {createFileRoute} from "@tanstack/react-router";
import {Dashboard} from "@/components/dashboard";

export const Route = createFileRoute("/")({
	component: IndexRoute,
});

function IndexRoute() {
	return <Dashboard />;
}
