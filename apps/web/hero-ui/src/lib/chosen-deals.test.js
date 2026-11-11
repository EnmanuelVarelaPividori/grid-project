import {describe, expect, it} from "vite-plus/test";
import {chosenDeals} from "./chosen-deals.js";

describe("chosen deal history", () => {
	it("keeps the latest eight saved choices without mutating request order", () => {
		const requests = Object.freeze(Array.from({length: 10}, (_, id) => Object.freeze({id: id + 1})));
		expect(chosenDeals(requests, []).map((deal) => deal.id)).toEqual([10, 9, 8, 7, 6, 5, 4, 3]);
		expect(requests[0].id).toBe(1);
	});
	it("joins saved choices to map resources and retains unavailable locations", () => {
		const resource = {id: "solar-1", lat: 53.2, lon: 6.5};
		const result = chosenDeals(
			[
				{id: 2, listing_id: "removed"},
				{id: 1, listing_id: "solar-1"},
			],
			[resource],
		);
		expect(result[0].resource).toBeNull();
		expect(result[1].resource).toBe(resource);
	});
	it("preserves zero estimates and never invents savings for older drafts", () => {
		const result = chosenDeals(
			[{id: 3, estimated_savings_eur: 0}, {id: 2}, {id: 1, estimated_savings_eur: Infinity}],
			[],
		);
		expect(result.map((deal) => deal.estimate)).toEqual([0, null, null]);
	});
});
