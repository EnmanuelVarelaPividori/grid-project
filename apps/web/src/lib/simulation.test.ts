import {describe, expect, it} from "vite-plus/test";
import snapshot from "@/data/snapshot.json";
import {defaultScenario, simulate, summarize} from "./simulation";

describe("battery dispatch", () => {
	it("conserves energy at the connection and within the battery while obeying physical limits", () => {
		const points = simulate(snapshot.weather, defaultScenario);
		let previousEnergy = defaultScenario.batteryKwh * 0.1;
		for (const point of points) {
			expect(point.optimized).toBeCloseTo(point.load - point.solar + point.charge - point.discharge, 8);
			expect(point.stored).toBeCloseTo(
				previousEnergy + point.charge * 0.25 * Math.sqrt(0.9) - (point.discharge * 0.25) / Math.sqrt(0.9),
				8,
			);
			expect(point.soc).toBeGreaterThanOrEqual(10 - 1e-8);
			expect(point.soc).toBeLessThanOrEqual(100 + 1e-8);
			expect(point.charge).toBeLessThanOrEqual(defaultScenario.batteryKw);
			expect(point.discharge).toBeLessThanOrEqual(defaultScenario.batteryKw);
			expect(point.charge * point.discharge).toBe(0);
			previousEnergy = point.stored;
		}
	});
	it("leaves the baseline intact when there is no battery", () => {
		const points = simulate(snapshot.weather, {...defaultScenario, batteryKwh: 0});
		expect(points).toHaveLength(96);
		for (const point of points) expect(point.optimized).toBe(point.baseline);
	});
	it("does not discharge free initial energy when there is no solar", () => {
		const points = simulate(snapshot.weather, {...defaultScenario, solarKw: 0});
		expect(summarize(points).discharged).toBe(0);
		expect(summarize(points).selfConsumption).toBe(0);
	});
	it("can reduce both import and export peaks using the real demo forecast", () => {
		const summary = summarize(simulate(snapshot.weather, defaultScenario));
		expect(summary.peakAfter).toBeLessThan(summary.peakBefore);
		expect(summary.exportAfter).toBeLessThan(summary.exportBefore);
		expect(summary.discharged).toBeLessThanOrEqual(summary.charged * 0.9 + 1e-8);
	});
	it("skips missing solar intervals rather than treating them as measured zero production", () => {
		const weather = {...snapshot.weather, shortwave_radiation: snapshot.weather.shortwave_radiation.map(() => null)};
		expect(simulate(weather, defaultScenario)).toHaveLength(0);
	});
});
