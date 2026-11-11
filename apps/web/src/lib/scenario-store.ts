import {z} from "zod";
import {defaultScenario} from "./simulation";
import type {Scenario} from "./simulation";

const schema = z.object({
	solarKw: z.number().min(0).max(700),
	batteryKwh: z.number().min(0).max(400),
	batteryKw: z.number().min(0).max(150),
	importLimit: z.number().min(10).max(120),
	exportLimit: z.number().min(0).max(100),
	profile: z.enum(["workshop", "office", "warehouse"]),
});
const listeners = new Set<() => void>();
let cachedJson: string | null | undefined;
let cachedScenario: Scenario = defaultScenario;

export function readSavedScenario() {
	try {
		const json = localStorage.getItem("gridwise-scenario");
		if (json !== cachedJson) {
			cachedJson = json;
			const parsed = schema.safeParse(JSON.parse(json ?? "null"));
			cachedScenario = parsed.success ? parsed.data : defaultScenario;
		}
	} catch {
		cachedScenario = defaultScenario;
	}
	return cachedScenario;
}
export const serverScenario = () => defaultScenario;

export function subscribeScenario(listener: () => void) {
	listeners.add(listener);
	window.addEventListener("storage", listener);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", listener);
	};
}
export function persistScenario(scenario: Scenario) {
	localStorage.setItem("gridwise-scenario", JSON.stringify(schema.parse(scenario)));
	listeners.forEach((listener) => listener());
}
export const subscribeBrowser = () => () => {};
export const browserSnapshot = () => true;
export const serverBrowserSnapshot = () => false;
