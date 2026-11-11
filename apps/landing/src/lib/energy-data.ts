import {z} from "zod";
import snapshot from "@/data/snapshot.json";

export {snapshot};

const weatherSchema = z.object({
	hourly: z.object({
		time: z.array(z.number().finite()).min(1),
		shortwave_radiation: z.array(z.number().finite().nullable()),
		temperature_2m: z.array(z.number().finite().nullable()),
		cloud_cover: z.array(z.number().finite().nullable()),
	}),
});

export const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=53.2194&longitude=6.5665&hourly=temperature_2m,shortwave_radiation,cloud_cover&start_date=${snapshot.date}&end_date=${snapshot.date}&timezone=Europe%2FAmsterdam&timeformat=unixtime`;
export const locationUrl =
	"https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=Groningen&fq=type:woonplaats&rows=1";

async function getJson(url: string, signal?: AbortSignal) {
	const response = await fetch(url, {
		signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000),
	});
	if (!response.ok) throw new Error(`Source unavailable (${response.status})`);
	return response.json();
}

export async function fetchWeather(signal?: AbortSignal) {
	const result = weatherSchema.parse(await getJson(weatherUrl, signal)).hourly;
	const length = result.time.length;
	if (
		[result.shortwave_radiation, result.temperature_2m, result.cloud_cover].some((values) => values.length !== length)
	)
		throw new Error("Incomplete weather response");
	if (result.shortwave_radiation.some((value) => value === null))
		throw new Error("Solar forecast contains missing intervals");
	return {hourly: result, retrievedAt: new Date().toISOString()};
}

const locationSchema = z.object({
	response: z.object({docs: z.array(z.object({weergavenaam: z.string(), centroide_ll: z.string()})).min(1)}),
});
export async function fetchLocation(signal?: AbortSignal) {
	return locationSchema.parse(await getJson(locationUrl, signal)).response.docs[0];
}

export function average(values: (number | null)[]) {
	const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
	return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

export function generationMix() {
	const groups = [
		{name: "Wind", sources: ["Wind offshore", "Wind onshore"], color: "#92aa86"},
		{name: "Solar", sources: ["Solar"], color: "#e7ba5c"},
		{name: "Gas", sources: ["Fossil gas"], color: "#b9a998"},
		{name: "Coal", sources: ["Fossil hard coal"], color: "#686e73"},
		{name: "Other", sources: ["Nuclear", "Biomass", "Waste", "Others"], color: "#c3c9b9"},
	];
	const data = groups.map((group) => ({
		...group,
		value: group.sources.reduce(
			(total, name) =>
				total +
				Math.max(0, average(snapshot.generation.series.find((series) => series.name === name)?.data ?? []) ?? 0),
			0,
		),
	}));
	const total = data.reduce((sum, group) => sum + group.value, 0);
	return data.map((group) => ({...group, share: total ? (group.value / total) * 100 : 0}));
}
