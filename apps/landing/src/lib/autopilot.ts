export type TradeMode = "sell" | "buy";
export type PeerGroup = "household" | "business";
export type Asset = "solar" | "battery" | "ev" | "business" | "flex";
export type Hours = "daytime" | "extended" | "all";

export interface Preferences {
	mode: TradeMode;
	price: number;
	dailyLimit: number;
	reserve: number;
	hours: Hours;
	households: boolean;
	businesses: boolean;
	supplier: "noordstroom" | "polder" | "vast";
}

export const initialPreferences: Preferences = {
	mode: "sell",
	price: 0.17,
	dailyLimit: 10,
	reserve: 30,
	hours: "extended",
	households: true,
	businesses: true,
	supplier: "noordstroom",
};

export interface Neighbour {
	id: string;
	name: string;
	asset: Asset;
	group: PeerGroup;
	price: number;
	quantity: number;
	time: string;
	battery: boolean;
	sameGrid: boolean;
	x: number;
	y: number;
	distance: number;
}

export const sellNeighbours: Neighbour[] = [
	{
		id: "sports",
		name: "Sports club chargers",
		asset: "ev",
		group: "business",
		price: 0.17,
		quantity: 2,
		time: "11:00",
		battery: false,
		sameGrid: true,
		x: 80,
		y: 39,
		distance: 480,
	},
	{
		id: "heat",
		name: "Heat pump · Linnaeusstraat",
		asset: "flex",
		group: "household",
		price: 0.19,
		quantity: 1.5,
		time: "12:30",
		battery: false,
		sameGrid: true,
		x: 44,
		y: 75,
		distance: 220,
	},
	{
		id: "shop",
		name: "Corner shop · Oosterstraat",
		asset: "business",
		group: "business",
		price: 0.21,
		quantity: 2.5,
		time: "13:00",
		battery: false,
		sameGrid: true,
		x: 61,
		y: 29,
		distance: 390,
	},
	{
		id: "zernike",
		name: "Data centre · Zernike",
		asset: "business",
		group: "business",
		price: 0.23,
		quantity: 5,
		time: "14:00",
		battery: false,
		sameGrid: false,
		x: 93,
		y: 78,
		distance: 2800,
	},
	{
		id: "balcony",
		name: "Balcony neighbour · Oosterkade",
		asset: "solar",
		group: "household",
		price: 0.13,
		quantity: 1,
		time: "15:00",
		battery: false,
		sameGrid: true,
		x: 35,
		y: 23,
		distance: 180,
	},
	{
		id: "bakery",
		name: "Bakery · Marktplein",
		asset: "business",
		group: "business",
		price: 0.24,
		quantity: 3,
		time: "18:00",
		battery: true,
		sameGrid: true,
		x: 43,
		y: 7,
		distance: 650,
	},
	{
		id: "molenlaan",
		name: "EV charger · Molenlaan",
		asset: "ev",
		group: "household",
		price: 0.22,
		quantity: 2,
		time: "19:30",
		battery: true,
		sameGrid: true,
		x: 21,
		y: 39,
		distance: 310,
	},
	{
		id: "herestraat",
		name: "EV charger · Herestraat",
		asset: "ev",
		group: "household",
		price: 0.18,
		quantity: 2,
		time: "23:00",
		battery: true,
		sameGrid: true,
		x: 54,
		y: 61,
		distance: 580,
	},
];

export const buyNeighbours: Neighbour[] = [
	{
		id: "roof",
		name: "Rooftop solar · Oosterweg",
		asset: "solar",
		group: "household",
		price: 0.12,
		quantity: 2,
		time: "11:00",
		battery: false,
		sameGrid: true,
		x: 35,
		y: 23,
		distance: 180,
	},
	{
		id: "farm",
		name: "Community roof · Stadspark",
		asset: "solar",
		group: "business",
		price: 0.14,
		quantity: 3,
		time: "12:30",
		battery: false,
		sameGrid: true,
		x: 68,
		y: 13,
		distance: 520,
	},
	{
		id: "home",
		name: "Home battery · Kerkstraat",
		asset: "battery",
		group: "household",
		price: 0.18,
		quantity: 2.5,
		time: "13:00",
		battery: false,
		sameGrid: true,
		x: 73,
		y: 71,
		distance: 390,
	},
	{
		id: "park",
		name: "Solar park · Zernike",
		asset: "solar",
		group: "business",
		price: 0.11,
		quantity: 5,
		time: "14:00",
		battery: false,
		sameGrid: false,
		x: 93,
		y: 78,
		distance: 2800,
	},
	{
		id: "workshop",
		name: "Workshop · Diepkade",
		asset: "business",
		group: "business",
		price: 0.25,
		quantity: 1.5,
		time: "15:00",
		battery: false,
		sameGrid: true,
		x: 28,
		y: 60,
		distance: 280,
	},
	{
		id: "bakery",
		name: "Bakery battery · Marktplein",
		asset: "battery",
		group: "business",
		price: 0.19,
		quantity: 3,
		time: "18:00",
		battery: true,
		sameGrid: true,
		x: 43,
		y: 7,
		distance: 650,
	},
	{
		id: "neighbour",
		name: "Neighbour battery · Molenlaan",
		asset: "battery",
		group: "household",
		price: 0.17,
		quantity: 2,
		time: "19:30",
		battery: true,
		sameGrid: true,
		x: 21,
		y: 39,
		distance: 310,
	},
	{
		id: "night",
		name: "Overnight battery · Herestraat",
		asset: "battery",
		group: "household",
		price: 0.1,
		quantity: 2,
		time: "23:00",
		battery: true,
		sameGrid: true,
		x: 54,
		y: 61,
		distance: 580,
	},
];

export type DecisionReason =
	| "Would take"
	| "Partly"
	| "Other grid area"
	| "Outside your hours"
	| "Below your minimum"
	| "Above your maximum"
	| "Not selected"
	| "Daily limit reached"
	| "Battery reserve"
	| "Daytime budget"
	| "Supplier unavailable";
export interface Decision {
	neighbour: Neighbour;
	quantity: number;
	reason: DecisionReason;
}
export const neighboursFor = (mode: TradeMode) => (mode === "sell" ? sellNeighbours : buyNeighbours);

/** Illustrative allocation, not a market or an equipment controller.
 * Default example: 6 kWh daytime surplus/direct-use budget; full 10 kWh battery
 * before the evening, protected by the selected reserve; no additional cycling.
 */
export function planTrades(preferences: Preferences, preferred: ReadonlySet<string>) {
	const neighbours = neighboursFor(preferences.mode);
	const decisions: Decision[] = neighbours.map((neighbour) => {
		let reason: DecisionReason = "Would take";
		const hour = Number(neighbour.time.split(":")[0]);
		if (preferences.supplier === "vast") reason = "Supplier unavailable";
		else if (!neighbour.sameGrid) reason = "Other grid area";
		else if (preferences.hours !== "all" && (hour < 10 || hour >= (preferences.hours === "daytime" ? 16 : 22)))
			reason = "Outside your hours";
		else if (preferences.mode === "sell" && neighbour.price < preferences.price - 1e-9) reason = "Below your minimum";
		else if (preferences.mode === "buy" && neighbour.price > preferences.price + 1e-9) reason = "Above your maximum";
		else if (neighbour.group === "household" ? !preferences.households : !preferences.businesses)
			reason = "Not selected";
		return {neighbour, quantity: 0, reason};
	});
	let remaining = Math.max(0, preferences.dailyLimit);
	let daytime = 6;
	let battery = 10 * (1 - Math.min(100, Math.max(0, preferences.reserve)) / 100);
	const eligible = decisions
		.filter((decision) => decision.reason === "Would take")
		.sort((a, b) => {
			const preference = Number(preferred.has(b.neighbour.id)) - Number(preferred.has(a.neighbour.id));
			if (preference) return preference;
			return preferences.mode === "sell"
				? b.neighbour.price - a.neighbour.price
				: a.neighbour.price - b.neighbour.price;
		});
	for (const decision of eligible) {
		const available = decision.neighbour.battery ? battery : daytime;
		decision.quantity = Math.max(0, Math.min(decision.neighbour.quantity, remaining, available));
		remaining -= decision.quantity;
		if (decision.neighbour.battery) battery -= decision.quantity;
		else daytime -= decision.quantity;
		if (decision.quantity > 1e-8)
			decision.reason = decision.quantity < decision.neighbour.quantity - 1e-8 ? "Partly" : "Would take";
		else
			decision.reason =
				remaining < 1e-8 ? "Daily limit reached" : decision.neighbour.battery ? "Battery reserve" : "Daytime budget";
	}
	const accepted = decisions.filter((decision) => decision.quantity > 1e-8);
	const energy = accepted.reduce((sum, decision) => sum + decision.quantity, 0);
	const value = accepted.reduce((sum, decision) => sum + decision.quantity * decision.neighbour.price, 0);
	return {
		decisions,
		accepted,
		energy,
		extra: preferences.mode === "sell" ? value - energy * 0.06 : energy * 0.3 - value,
		surplus: daytime,
	};
}

export const baselineLoad = [
	38, 34, 32, 31, 33, 36, 45, 58, 55, 48, 44, 42, 41, 40, 42, 45, 51, 65, 92, 96, 93, 85, 65, 50,
];
/** A normalized illustrative feeder profile. Shifted load is conserved. */
export function feederProfile(energy: number) {
	const reduction = Math.min(0.15, Math.max(0, energy) * 0.015);
	const values = baselineLoad.map((value, hour) => (hour >= 18 && hour <= 21 ? value * (1 - reduction) : value));
	const shifted = baselineLoad.reduce((sum, value, index) => sum + value - values[index], 0);
	for (let hour = 10; hour <= 14; hour++) values[hour] += shifted / 5;
	return {values, reduction};
}
