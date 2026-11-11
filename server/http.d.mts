import type {Server} from "node:http";

export interface AppServerOptions {
	handler: (request: Request) => Response | Promise<Response>;
	clientDirectory: string;
	revision?: string;
	origin?: string;
}
export function createAppServer(options: AppServerOptions): Server;
