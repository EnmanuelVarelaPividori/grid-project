import {createAppServer} from "./http.mjs";

const appName = process.env.APP_NAME ?? "landing";
if (!["landing", "web"].includes(appName)) throw new Error("APP_NAME must be landing or web");
const {default: start} = await import(`../apps/${appName}/dist/server/server.js`);
const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
const server = createAppServer({
	handler: (request) => start.fetch(request),
	clientDirectory: new URL(`../apps/${appName}/dist/client/`, import.meta.url).pathname,
	revision: process.env.BUILD_REVISION ?? "development",
	origin: process.env.APP_ORIGIN,
});
server.listen(port, process.env.HOST ?? "0.0.0.0", () => console.log(`Listening on port ${port}`));
for (const signal of ["SIGINT", "SIGTERM"])
	process.on(signal, () => {
		server.close(() => process.exit(0));
		setTimeout(() => {
			server.closeAllConnections();
			process.exit(1);
		}, 10_000).unref();
	});
