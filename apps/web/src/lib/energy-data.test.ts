import {afterEach, describe, expect, it, vi} from "vite-plus/test";
import snapshot from "@/data/snapshot.json";
import {average, fetchLocation, fetchWeather} from "./energy-data";

afterEach(() => vi.unstubAllGlobals());

function respond(body: unknown, status = 200) {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(JSON.stringify(body), {status, headers: {"Content-Type": "application/json"}})),
	);
}

describe("public-data adapters", () => {
	it("accepts a complete forecast and preserves its actual timestamps", async () => {
		respond({hourly: snapshot.weather});
		const result = await fetchWeather();
		expect(result.hourly.time).toEqual(snapshot.weather.time);
		expect(result.hourly.shortwave_radiation).toEqual(snapshot.weather.shortwave_radiation);
	});
	it("rejects unavailable sources so the caller can display the recorded fallback", async () => {
		respond({}, 503);
		await expect(fetchWeather()).rejects.toThrow("Source unavailable (503)");
	});
	it("rejects mismatched arrays and missing solar observations", async () => {
		respond({hourly: {...snapshot.weather, shortwave_radiation: [123]}});
		await expect(fetchWeather()).rejects.toThrow("Incomplete weather response");
		respond({hourly: {...snapshot.weather, shortwave_radiation: snapshot.weather.time.map(() => null)}});
		await expect(fetchWeather()).rejects.toThrow("Solar forecast contains missing intervals");
	});
	it("rejects empty location responses rather than labelling the location live", async () => {
		respond({response: {docs: []}});
		await expect(fetchLocation()).rejects.toThrow();
	});
	it("excludes missing data from means and preserves genuinely negative prices", () => {
		expect(average([null, -20, 10])).toBe(-5);
		expect(average([null])).toBeNull();
	});
});
