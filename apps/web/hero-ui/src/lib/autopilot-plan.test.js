import {describe, expect, it} from "vite-plus/test";
import {autopilotPlan} from "./autopilot-plan.js";

describe("read-only autopilot preview", () => {
	const resources = [{id: "solar-1", name: "Local solar", kind: "solar", window: "11:00–16:00"}];
	const match = {
		listing_id: "solar-1",
		partner_id: "demand-1",
		partner_name: "EV charger",
		quantity: 12,
		unit: "kWh",
		illustrative_value_eur: 0.7,
		compatibility: "Supplier labels align, unverified",
	};
	it("only displays available opportunities with a local partner", () => {
		expect(
			autopilotPlan([match, {...match, quantity: 0}, {...match, partner_id: null}], resources, "2026-11-12"),
		).toHaveLength(1);
	});
	it("keeps model estimates and makes planned previews distinct from saved drafts", () => {
		const [deal] = autopilotPlan([Object.freeze(match)], resources, "2026-11-12");
		expect(deal).toMatchObject({
			preview: true,
			status: "Planned · demo",
			estimated_savings_eur: 0.7,
			quantity: 12,
			listing_name: "Local solar",
			date: "2026-11-12",
		});
		expect(match.preview).toBeUndefined();
	});
	it("surfaces supplier checks instead of implying an approved automatic trade", () => {
		const [deal] = autopilotPlan(
			[{...match, compatibility: "Different supplier — settlement check"}],
			resources,
			"2026-11-12",
		);
		expect(deal.review).toBe(true);
	});
});
