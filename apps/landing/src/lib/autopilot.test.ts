import {describe, expect, it} from "vite-plus/test";
import {baselineLoad, feederProfile, initialPreferences, planTrades} from "./autopilot";

const none = new Set<string>();
describe("illustrative autopilot", () => {
	it("reproduces the reference example with five deals, 10 kWh and €1.54 extra", () => {
		const result = planTrades(initialPreferences, none);
		expect(result.accepted).toHaveLength(5);
		expect(result.energy).toBeCloseTo(10);
		expect(result.extra).toBeCloseTo(1.54);
		expect(result.surplus).toBeCloseTo(1);
		expect(result.decisions.find((item) => item.neighbour.id === "sports")?.quantity).toBe(1);
	});
	it("enforces the price, hours and grid-area constraints even for preferred neighbours", () => {
		const result = planTrades(
			{...initialPreferences, price: 0.22, hours: "daytime"},
			new Set(["zernike", "balcony", "herestraat"]),
		);
		for (const item of result.accepted) {
			expect(item.neighbour.sameGrid).toBe(true);
			expect(item.neighbour.price).toBeGreaterThanOrEqual(0.22);
			expect(Number(item.neighbour.time.split(":")[0])).toBeLessThan(16);
		}
		expect(result.accepted).toHaveLength(0);
	});
	it("never exceeds the daily limit or available battery above reserve", () => {
		const result = planTrades({...initialPreferences, dailyLimit: 4, reserve: 90, hours: "all"}, none);
		expect(result.energy).toBeLessThanOrEqual(4);
		expect(
			result.accepted.filter((item) => item.neighbour.battery).reduce((sum, item) => sum + item.quantity, 0),
		).toBeLessThanOrEqual(1 + 1e-9);
	});
	it("honours peer selection and supplier support", () => {
		expect(planTrades({...initialPreferences, households: false, businesses: false}, none).energy).toBe(0);
		expect(planTrades({...initialPreferences, supplier: "vast"}, none).energy).toBe(0);
	});
	it("buys only at or below the chosen maximum and prioritizes lower prices", () => {
		const result = planTrades({...initialPreferences, mode: "buy", price: 0.15}, none);
		expect(result.accepted.length).toBeGreaterThan(0);
		for (const item of result.accepted) expect(item.neighbour.price).toBeLessThanOrEqual(0.15);
	});
	it("keeps shifted load conserved and reduces the illustrative peak by 15% at 10 kWh", () => {
		const profile = feederProfile(10);
		expect(Math.max(...profile.values)).toBeCloseTo(96 * 0.85);
		expect(profile.values.reduce((a, b) => a + b, 0)).toBeCloseTo(baselineLoad.reduce((a, b) => a + b, 0));
		expect(feederProfile(0).values).toEqual(baselineLoad);
	});
});
