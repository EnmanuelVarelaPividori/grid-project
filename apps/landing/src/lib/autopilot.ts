// Simulated Autopilot model for the landing page. Everything here is deterministic, illustrative data:
// it is not a forecasting, trading, billing or device-control system.

export type CustomerType = "home" | "biz";
export type Asset = "solar" | "battery" | "ev" | "flex" | "business";
export type ActionKind = Asset | "share";
export type SupplierId =
	| "vattenfall"
	| "eneco"
	| "essent"
	| "greenchoice"
	| "vandebron"
	| "budget"
	| "zonneplan"
	| "frank"
	| "tibber"
	| "pure"
	| "other";

export const iconPaths: Record<ActionKind, string> = {
	solar:
		"M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
	battery: "M5 7h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2ZM22 11v2M7 10v4",
	ev: "M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v5",
	flex: "M14 14.76V3.5a2 2 0 0 0-4 0v11.26a4 4 0 1 0 4 0Z",
	business: "M3 9l1.5-5h15L21 9M4 9v11h16V9M3 9h18M9 20v-6h6v6",
	share: "M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
};

// Dutch suppliers, listed for illustration only; GridShare is not affiliated with them. None offers energy
// sharing to consumers yet, so steering works with every supplier and neighbour sharing is shown as a potential.
export const suppliers: Record<SupplierId, string> = {
	vattenfall: "Vattenfall",
	eneco: "Eneco",
	essent: "Essent",
	greenchoice: "Greenchoice",
	vandebron: "Vandebron",
	budget: "Budget Energie",
	zonneplan: "Zonneplan",
	frank: "Frank Energie",
	tibber: "Tibber",
	pure: "Pure Energie",
	other: "Another supplier",
};

export interface AutopilotAction {
	time: string;
	kind: ActionKind;
	title: string;
	detail: string;
	save: number;
	tag: string;
	/** kWh exchanged with a neighbour; only set for local shares. */
	kwh?: number;
	/** Sharing with neighbours: not available until Dutch suppliers offer energy sharing. */
	share?: boolean;
}

export interface Profile {
	assets: [Asset, string][];
	assetsLabel: string;
	promises: string[];
	/** Reduction of the customer's own use in the 17–20h peak, in percent. */
	peak: number;
	feedName: string;
	defaults: {use: string; price: string};
	hint: string;
	actions: AutopilotAction[];
}

export const profiles: Record<CustomerType, Profile> = {
	home: {
		assets: [
			["solar", "Solar 4 kWp"],
			["battery", "Battery 10 kWh"],
			["ev", "EV"],
			["flex", "Heat pump"],
		],
		assetsLabel: "We found these at your address",
		promises: [
			"Never worse off than your own contract",
			"Car charged when you leave",
			"Home stays 19–21 °C",
			"One tap to take back control",
		],
		peak: 85,
		feedName: "Household",
		defaults: {use: "6000", price: "0.30"},
		hint: "Both are on your yearly energy bill. 6,000 kWh is typical for a home with an EV and heat pump.",
		actions: [
			{
				time: "01:30",
				kind: "ev",
				title: "Charged your EV",
				detail: "7 kWh while the street sleeps",
				save: 0.84,
				tag: "Grid quiet",
			},
			{
				time: "06:30",
				kind: "flex",
				title: "Pre-heated your home",
				detail: "20 °C at 07:00, before the morning rush",
				save: 0.18,
				tag: "Comfort kept",
			},
			{
				time: "11:00",
				kind: "share",
				title: "Shared solar with the corner shop",
				detail: "2.5 kWh at €0.21",
				kwh: 2.5,
				save: 0.38,
				tag: "Local share",
				share: true,
			},
			{
				time: "12:00",
				kind: "battery",
				title: "Filled your battery with sun",
				detail: "6 kWh stored for tonight",
				save: 0,
				tag: "Stored",
			},
			{
				time: "13:00",
				kind: "share",
				title: "Shared solar with the sports club chargers",
				detail: "2 kWh at €0.17",
				kwh: 2,
				save: 0.22,
				tag: "Local share",
				share: true,
			},
			{
				time: "18:00",
				kind: "battery",
				title: "Covered your dinner peak from the battery",
				detail: "3 kWh you didn’t buy at €0.36",
				save: 0.9,
				tag: "Peak avoided",
			},
			{
				time: "19:00",
				kind: "share",
				title: "Sent 2 kWh to the Marktplein bakery",
				detail: "From your battery at €0.24",
				kwh: 2,
				save: 0.36,
				tag: "Local share",
				share: true,
			},
		],
	},
	biz: {
		assets: [
			["business", "Bakery · ovens"],
			["flex", "Cold room"],
			["ev", "Delivery van"],
			["solar", "Roof 12 kWp"],
		],
		assetsLabel: "We found these at your business",
		promises: [
			"Never worse off than your own contract",
			"Food-safe temperatures, always",
			"Bread ready when you open",
			"One tap to take back control",
		],
		peak: 40,
		feedName: "Marktplein bakery",
		defaults: {use: "30000", price: "0.25"},
		hint: "Both are on your yearly energy bill. 30,000 kWh is typical for a small bakery or shop.",
		actions: [
			{
				time: "03:00",
				kind: "business",
				title: "Started the first oven batch early",
				detail: "Done before households wake up",
				save: 1.1,
				tag: "Grid quiet",
			},
			{
				time: "05:30",
				kind: "ev",
				title: "Charged the delivery van",
				detail: "12 kWh at night rates",
				save: 1.3,
				tag: "Grid quiet",
			},
			{
				time: "12:00",
				kind: "share",
				title: "Used rooftop solar from Lindenstraat",
				detail: "4 kWh at €0.16 instead of €0.28",
				kwh: 4,
				save: 0.48,
				tag: "Local share",
				share: true,
			},
			{
				time: "14:00",
				kind: "flex",
				title: "Pre-cooled the cold room with midday sun",
				detail: "1.5 °C buffer, still food-safe",
				save: 0.62,
				tag: "Food-safe",
			},
			{
				time: "18:00",
				kind: "share",
				title: "Took 3 kWh from a neighbour’s battery",
				detail: "At €0.24 instead of €0.36 at the peak",
				kwh: 3,
				save: 0.36,
				tag: "Peak avoided",
				share: true,
			},
		],
	},
};

/**
 * Yesterday's simulated actions. Sharing with neighbours is not possible yet, so those actions are left out of
 * the day's savings and summed into one potential instead.
 */
export function dayFeed(type: CustomerType) {
	const actions = profiles[type].actions;
	const items = actions.filter((action) => !action.share);
	const money = items.reduce((total, action) => total + action.save, 0);
	const potential = actions.filter((action) => action.share).reduce((total, action) => total + action.save, 0);
	return {items, money, potential};
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const steerWeights = [1.1, 1.05, 1, 0.95, 0.9, 0.85, 0.85, 0.9, 0.95, 1.05, 1.1, 1.15];
const shareWeights = [0.3, 0.45, 0.8, 1.2, 1.6, 1.8, 1.8, 1.6, 1.1, 0.7, 0.4, 0.25];
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export interface MonthBar {
	/** Short month name, e.g. "Jan". */
	month: string;
	/** Heights as a share (0–1) of the tallest month. */
	steer: number;
	share: number;
	/** Sharing savings that need a sharing supplier, drawn as an outline. */
	ghost: number;
}

/**
 * Savings prediction from the customer's own yearly use (kWh) and price (€/kWh). Simplified and simulated.
 * Steering: part of the use is flexible and moves to cheaper hours.
 * Sharing: homes sell solar surplus to neighbours; businesses buy local solar below their price.
 */
export function predictSavings(type: CustomerType, sharing: boolean, yearlyUse: number, price: number) {
	const use = Math.max(0, Number.isFinite(yearlyUse) ? yearlyUse : 0);
	const rate = Math.max(0, Number.isFinite(price) ? price : 0);
	const steer = Math.round(type === "home" ? use * 0.35 * rate * 0.5 : use * 0.25 * rate * 0.4);
	const share = Math.round(type === "home" ? (use > 0 ? 108 : 0) : use * 0.05 * Math.max(0, rate - 0.16));
	const steerTotal = sum(steerWeights);
	const shareTotal = sum(shareWeights);
	const months = steerWeights.map((weight, index) => ({
		steer: (steer * weight) / steerTotal,
		share: (share * shareWeights[index]) / shareTotal,
	}));
	const max = Math.max(...months.map((month) => month.steer + month.share)) || 1;
	const bars: MonthBar[] = months.map((month, index) => ({
		month: monthNames[index],
		steer: month.steer / max,
		share: sharing ? month.share / max : 0,
		ghost: sharing ? 0 : month.share / max,
	}));
	const total = steer + (sharing ? share : 0);
	const bill = use * rate;
	return {
		total,
		monthly: total / 12,
		low: Math.round((total * 0.8) / 10) * 10,
		high: Math.round((total * 1.2) / 10) * 10,
		steer,
		share,
		bill,
		percentOfBill: bill > 0 ? Math.round((total / bill) * 100) : 0,
		bars,
	};
}

// Street load (kW per hour) for 40 homes + 4 businesses. Same daily energy in both scenarios, only moved in time.
export const streetLoad = {
	before: {
		homes: [16, 14, 13, 12, 12, 14, 22, 36, 30, 22, 18, 17, 18, 17, 18, 24, 36, 54, 64, 60, 48, 36, 26, 20],
		businesses: [10, 10, 10, 10, 10, 12, 22, 40, 58, 64, 66, 68, 66, 66, 66, 66, 62, 56, 40, 22, 14, 12, 10, 10],
	},
	after: {
		homes: [24, 24, 22, 20, 24, 22, 22, 30, 26, 22, 26, 26, 30, 30, 28, 26, 30, 34, 39, 38, 34, 26, 24, 20],
		businesses: [30, 30, 30, 30, 30, 30, 34, 44, 50, 52, 50, 48, 46, 46, 46, 46, 42, 36, 26, 22, 20, 22, 30, 30],
	},
};
export const streetLimitKw = 85;

export function streetStats(homes: number[], businesses: number[]) {
	const totals = homes.map((value, hour) => value + businesses[hour]);
	const peak = Math.max(...totals);
	const average = sum(totals) / totals.length;
	return {
		totals,
		peak,
		ratio: peak / average,
		hoursOver: totals.filter((value) => value > streetLimitKw).length,
		energy: sum(totals),
	};
}

/** kWh moved out of over-full hours when Autopilot spreads the flexible load. */
export function energyMoved() {
	const before = streetStats(streetLoad.before.homes, streetLoad.before.businesses).totals;
	const after = streetStats(streetLoad.after.homes, streetLoad.after.businesses).totals;
	return sum(before.map((value, hour) => Math.max(0, value - after[hour])));
}
