import {describe, expect, it} from "vite-plus/test";
import {costSeries} from "./cost-series";
describe("15-minute cost comparison", () => {
	it("applies the interval tariff separately to both coordination scenarios", () => {
		const data = costSeries({
			timeseries: [
				{net_before: 8, net_after: 4, price: 0.3},
				{net_before: 4, net_after: 8, price: 0.1},
			],
		});
		expect(data.at(-1).before).toBeCloseTo(0.7);
		expect(data.at(-1).after).toBeCloseTo(0.5);
		expect(data.at(-1).time).toBe("00:30");
	});
	it("credits exports at the engine's example export rate rather than the import tariff", () => {
		const end = costSeries({timeseries: [{net_before: -4, net_after: 0, price: 0.3}]}).at(-1);
		expect(end.before).toBeCloseTo(-0.045);
		expect(end.after).toBe(0);
	});
	it("starts at zero and labels a complete day through 24:00 without mutating inputs", () => {
		const rows = Array.from({length: 96}, () => Object.freeze({net_before: 1, net_after: 1, price: 0.2}));
		const data = costSeries({timeseries: Object.freeze(rows)});
		expect(data[0]).toEqual({time: "00:00", before: 0, after: 0});
		expect(data).toHaveLength(97);
		expect(data.at(-1).time).toBe("24:00");
		expect(data.at(-1).before).toBeCloseTo(4.8);
	});
});
