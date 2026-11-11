import {describe, expect, it} from "vite-plus/test";
import {dayFeed, energyMoved, predictSavings, streetLimitKw, streetLoad, streetStats} from "./autopilot";

describe("savings prediction", () => {
	it("predicts €423 a year for the default household with a sharing supplier", () => {
		const result = predictSavings("home", true, 6000, 0.3);
		expect(result.steer).toBe(315);
		expect(result.share).toBe(108);
		expect(result.total).toBe(423);
		expect(result.low).toBe(340);
		expect(result.high).toBe(510);
		expect(result.bill).toBeCloseTo(1800);
		expect(result.percentOfBill).toBe(24);
	});
	it("leaves sharing out of the total, and shows it as a ghost, when the supplier cannot share", () => {
		const result = predictSavings("home", false, 6000, 0.3);
		expect(result.total).toBe(315);
		expect(result.bars.every((bar) => bar.share === 0)).toBe(true);
		expect(result.bars.some((bar) => bar.ghost > 0)).toBe(true);
	});
	it("models businesses buying local solar below their own price", () => {
		const result = predictSavings("biz", true, 30000, 0.25);
		expect(result.steer).toBe(750);
		expect(result.share).toBe(135);
		expect(predictSavings("biz", true, 30000, 0.15).share).toBe(0);
	});
	it("handles empty or invalid input without negative or NaN values", () => {
		for (const result of [predictSavings("home", true, 0, 0.3), predictSavings("biz", true, Number.NaN, -1)]) {
			expect(result.total).toBe(0);
			expect(result.percentOfBill).toBe(0);
			expect(result.bars.every((bar) => bar.steer === 0 && bar.share === 0)).toBe(true);
		}
	});
	it("scales the tallest month to the full chart height", () => {
		const {bars} = predictSavings("home", true, 6000, 0.3);
		expect(Math.max(...bars.map((bar) => bar.steer + bar.share))).toBeCloseTo(1);
	});
});

describe("Autopilot day feed", () => {
	it("adds up yesterday's savings and shared energy", () => {
		const feed = dayFeed("home", "noord");
		expect(feed.money).toBeCloseTo(2.88);
		expect(feed.shared).toBeCloseTo(6.5);
		expect(feed.items.some((item) => item.blocked)).toBe(false);
	});
	it("blocks local shares when the supplier does not support sharing", () => {
		const feed = dayFeed("home", "vast");
		expect(feed.shared).toBe(0);
		expect(feed.money).toBeCloseTo(1.92);
		const blocked = feed.items.filter((item) => item.blocked);
		expect(blocked).toHaveLength(3);
		for (const item of blocked) expect(item.save).toBe(0);
	});
});

describe("street load", () => {
	const before = streetStats(streetLoad.before.homes, streetLoad.before.businesses);
	const after = streetStats(streetLoad.after.homes, streetLoad.after.businesses);
	it("keeps the same daily energy, only moved in time", () => {
		expect(after.energy).toBe(before.energy);
		expect(energyMoved()).toBeGreaterThan(0);
	});
	it("goes over the street limit without coordination and stays under it with Autopilot", () => {
		expect(before.peak).toBeGreaterThan(streetLimitKw);
		expect(before.hoursOver).toBeGreaterThan(0);
		expect(after.peak).toBeLessThanOrEqual(streetLimitKw);
		expect(after.hoursOver).toBe(0);
		expect(after.ratio).toBeLessThan(before.ratio);
	});
});
