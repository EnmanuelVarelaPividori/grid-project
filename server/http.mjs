import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {createServer} from "node:http";
import {extname, resolve, sep} from "node:path";
import {Readable} from "node:stream";
import {pipeline} from "node:stream/promises";

const mimeTypes = {
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".txt": "text/plain; charset=utf-8",
};

/** Serve Vite's client assets and forward dynamic requests to Start's fetch entry. */
export function createAppServer({handler, clientDirectory, revision = "development", origin}) {
	const clientRoot = resolve(clientDirectory);
	return createServer({requestTimeout: 30_000, headersTimeout: 15_000}, async (request, response) => {
		try {
			const url = new URL(request.url ?? "/", origin ?? `http://${request.headers.host ?? "localhost"}`);
			response.setHeader("X-Content-Type-Options", "nosniff");
			response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
			response.setHeader("X-Frame-Options", "SAMEORIGIN");
			if (url.pathname === "/healthz") {
				response.writeHead(200, {"Content-Type": "application/json", "Cache-Control": "no-store"});
				response.end(request.method === "HEAD" ? undefined : JSON.stringify({status: "ok", revision}));
				return;
			}
			let pathname;
			try {
				pathname = decodeURIComponent(url.pathname);
			} catch {
				response.writeHead(400);
				response.end("Bad request");
				return;
			}
			const filePath = resolve(clientRoot, `.${pathname}`);
			if (filePath !== clientRoot && !filePath.startsWith(`${clientRoot}${sep}`)) {
				response.writeHead(403);
				response.end("Forbidden");
				return;
			}
			if (request.method === "GET" || request.method === "HEAD") {
				const file = await stat(filePath).catch(() => null);
				if (file?.isFile()) {
					response.writeHead(200, {
						"Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
						"Content-Length": file.size,
						"Cache-Control": pathname.startsWith("/assets/")
							? "public, max-age=31536000, immutable"
							: "public, max-age=300",
					});
					if (request.method === "HEAD") response.end();
					else await pipeline(createReadStream(filePath), response);
					return;
				}
			}
			const controller = new AbortController();
			response.on("close", () => {
				if (!response.writableFinished) controller.abort();
			});
			const headers = new Headers();
			for (const [name, value] of Object.entries(request.headers)) {
				if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
			}
			const result = await handler(
				new Request(url, {
					method: request.method,
					headers,
					signal: controller.signal,
					...(request.method !== "GET" && request.method !== "HEAD"
						? {body: Readable.toWeb(request), duplex: "half"}
						: {}),
				}),
			);
			response.statusCode = result.status;
			for (const [name, value] of result.headers) if (name !== "set-cookie") response.setHeader(name, value);
			const cookies = result.headers.getSetCookie();
			if (cookies.length) response.setHeader("Set-Cookie", cookies);
			// Avoid edge caches holding on to old HTML during a blue/green switch.
			if (!response.hasHeader("Cache-Control")) response.setHeader("Cache-Control", "no-store");
			if (!result.body || request.method === "HEAD") response.end();
			else await pipeline(Readable.fromWeb(result.body), response);
		} catch (error) {
			console.error("Request failed:", error instanceof Error ? error.message : "Unknown error");
			if (!response.headersSent) response.writeHead(500, {"Content-Type": "text/plain", "Cache-Control": "no-store"});
			response.end("Internal server error");
		}
	});
}
