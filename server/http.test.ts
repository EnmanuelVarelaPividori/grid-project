import {mkdtemp, mkdir, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterAll, beforeAll, describe, expect, it} from "vite-plus/test";
import {createAppServer} from "./http.mjs";

let directory: string;
let base: string;
let server: ReturnType<typeof createAppServer>;
beforeAll(async () => {
	directory = await mkdtemp(join(tmpdir(), "grid-http-"));
	await mkdir(join(directory, "assets"));
	await writeFile(join(directory, "assets", "app-test.js"), 'console.log("asset")');
	await writeFile(join(directory, "favicon.svg"), "<svg/>");
	server = createAppServer({
		clientDirectory: directory,
		revision: "abc123",
		origin: undefined,
		handler: async (request: Request) => {
			if (new URL(request.url).pathname === "/echo") return new Response(await request.text());
			const headers = new Headers({"Content-Type": "text/html"});
			headers.append("Set-Cookie", "a=1; Path=/");
			headers.append("Set-Cookie", "b=2; Path=/");
			return new Response("<html>SSR works</html>", {headers});
		},
	});
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("No listening address");
	base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
	await new Promise<void>((done, reject) => server.close((error) => (error ? reject(error) : done())));
	await rm(directory, {recursive: true, force: true});
});
describe("production HTTP adapter", () => {
	it("reports the deployed revision without caching health results", async () => {
		const response = await fetch(`${base}/healthz`);
		expect(await response.json()).toEqual({status: "ok", revision: "abc123"});
		expect(response.headers.get("cache-control")).toBe("no-store");
	});
	it("serves immutable build assets with the correct media type", async () => {
		const response = await fetch(`${base}/assets/app-test.js`);
		expect(await response.text()).toBe('console.log("asset")');
		expect(response.headers.get("content-type")).toContain("javascript");
		expect(response.headers.get("cache-control")).toContain("immutable");
	});
	it("serves HEAD requests and does not permanently cache public files", async () => {
		const response = await fetch(`${base}/favicon.svg`, {method: "HEAD"});
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("");
		expect(response.headers.get("content-length")).toBe("6");
		expect(response.headers.get("cache-control")).not.toContain("immutable");
	});
	it("forwards SSR results and preserves separate cookies", async () => {
		const response = await fetch(base);
		expect(await response.text()).toContain("SSR works");
		expect(response.headers.getSetCookie()).toHaveLength(2);
		expect(response.headers.get("cache-control")).toBe("no-store");
	});
	it("streams POST bodies through the Fetch handler", async () => {
		const response = await fetch(`${base}/echo`, {method: "POST", body: "request payload"});
		expect(await response.text()).toBe("request payload");
	});
	it("rejects encoded traversal outside the client directory", async () => {
		const response = await fetch(`${base}/..%2fsecret`);
		expect(response.status).toBe(403);
	});
	it("rejects malformed URI encoding", async () => {
		const response = await fetch(`${base}/%GG`);
		expect(response.status).toBe(400);
	});
});
