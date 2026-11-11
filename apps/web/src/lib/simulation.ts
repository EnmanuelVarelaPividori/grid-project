export type BusinessProfile = "workshop" | "office" | "warehouse";

export interface Scenario {
	solarKw: number;
	batteryKwh: number;
	batteryKw: number;
	importLimit: number;
	exportLimit: number;
	profile: BusinessProfile;
}

export const defaultScenario: Scenario = {
	solarKw: 400,
	batteryKwh: 180,
	batteryKw: 60,
	importLimit: 45,
	exportLimit: 30,
	profile: "workshop",
};

export interface WeatherData {
	time: number[];
	shortwave_radiation: (number | null)[];
	temperature_2m: (number | null)[];
	cloud_cover: (number | null)[];
}

export interface Interval {
	timestamp: number;
	hour: number;
	load: number;
	solar: number;
	baseline: number;
	optimized: number;
	charge: number;
	discharge: number;
	stored: number;
	soc: number;
}

const gaussian = (hour: number, center: number, width: number) => Math.exp(-((hour - center) ** 2) / width);
const timeFormat = new Intl.DateTimeFormat("en-GB", {
	timeZone: "Europe/Amsterdam",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});
export const localTime = (timestamp: number) => timeFormat.format(timestamp * 1000);

export function demandAt(hour: number, profile: BusinessProfile) {
	if (profile === "office") return 10 + 48 * gaussian(hour, 10, 9) + 40 * gaussian(hour, 15.5, 7);
	if (profile === "warehouse") return 24 + 40 * gaussian(hour, 7, 6) + 65 * gaussian(hour, 19, 10);
	return 12 + 35 * gaussian(hour, 8, 5) + 14 * gaussian(hour, 12, 18) + 75 * gaussian(hour, 18, 5);
}

/** AC power balance in kW; battery energy in kWh; 15-minute dispatch.
 * Only solar surplus charges the battery. A 10% reserve is also the initial SOC,
 * so the comparison never gets free energy from a precharged demonstration battery.
 * Hourly irradiance is held constant in each of its four quarter-hour intervals.
 */
export function simulate(weather: WeatherData, scenario: Scenario): Interval[] {
	const capacity = Math.max(0, scenario.batteryKwh);
	const reserve = capacity * 0.1;
	const efficiency = Math.sqrt(0.9);
	const power = Math.max(0, scenario.batteryKw);
	let stored = reserve;
	return weather.time.flatMap((timestamp, index) => {
		if (!Number.isFinite(weather.shortwave_radiation[index])) return [];
		return Array.from({length: 4}, (_, quarter) => {
			const at = timestamp + quarter * 900;
			const [h, m] = localTime(at).split(":").map(Number);
			const hour = h + m / 60;
			const load = demandAt(hour, scenario.profile);
			// Illustrative PV conversion: horizontal irradiance, 85% performance ratio.
			const solar =
				(Math.max(0, weather.shortwave_radiation[index] ?? 0) / 1000) * Math.max(0, scenario.solarKw) * 0.85;
			const baseline = load - solar;
			const charge = baseline < 0 ? Math.min(-baseline, power, (capacity - stored) / (0.25 * efficiency)) : 0;
			const discharge =
				baseline > scenario.importLimit
					? Math.min(baseline - scenario.importLimit, power, (Math.max(0, stored - reserve) * efficiency) / 0.25)
					: 0;
			stored = Math.max(
				reserve,
				Math.min(capacity, stored + charge * 0.25 * efficiency - (discharge * 0.25) / efficiency),
			);
			return {
				timestamp: at,
				hour,
				load,
				solar,
				baseline,
				optimized: baseline + charge - discharge,
				charge,
				discharge,
				stored,
				soc: capacity > 0 ? (stored / capacity) * 100 : 0,
			};
		});
	});
}

export function summarize(intervals: Interval[]) {
	const sum = (get: (point: Interval) => number) => intervals.reduce((total, point) => total + get(point) * 0.25, 0);
	const peak = (get: (point: Interval) => number) => Math.max(0, ...intervals.map(get));
	const solar = sum((point) => point.solar);
	const solarCaptured = sum((point) => Math.min(point.load, point.solar) + point.charge);
	const peakBefore = peak((point) => point.baseline);
	const peakAfter = peak((point) => point.optimized);
	return {
		solar,
		selfConsumption: solar > 0 ? (solarCaptured / solar) * 100 : 0,
		peakBefore,
		peakAfter,
		peakReduction: peakBefore > 0 ? ((peakBefore - peakAfter) / peakBefore) * 100 : 0,
		exportBefore: peak((point) => -point.baseline),
		exportAfter: peak((point) => -point.optimized),
		imported: sum((point) => Math.max(0, point.optimized)),
		charged: sum((point) => point.charge),
		discharged: sum((point) => point.discharge),
		storedAtEnd: intervals.at(-1)?.stored ?? 0,
	};
}
