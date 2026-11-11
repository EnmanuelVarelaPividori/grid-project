import {mkdir, writeFile} from "node:fs/promises";

// Run before a demo to refresh the bundled, attributed public-data fallback.
const date = process.argv[2] ?? new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Amsterdam"}).format(new Date());
const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=53.2194&longitude=6.5665&hourly=temperature_2m,shortwave_radiation,cloud_cover&start_date=${date}&end_date=${date}&timezone=Europe%2FAmsterdam&timeformat=unixtime`;
async function read(url) {
	const response = await fetch(url, {signal: AbortSignal.timeout(20000)});
	if (!response.ok) throw new Error(`${response.status}: ${url}`);
	return response.json();
}
const [weather, prices, generation] = await Promise.all([
	read(weatherUrl),
	read(`https://api.energy-charts.info/price?bzn=NL&start=${date}&end=${date}`),
	read(`https://api.energy-charts.info/public_power?country=nl&start=${date}&end=${date}`),
]);
if (!weather.hourly?.time?.length || !prices.unix_seconds?.length || !generation.production_types?.length) {
	throw new Error("Source returned an empty dataset; the existing snapshot has been preserved.");
}
const snapshot = {
	date,
	retrievedAt: new Date().toISOString(),
	weather: weather.hourly,
	prices: {timestamps: prices.unix_seconds, values: prices.price, license: prices.license_info, unit: prices.unit},
	generation: {timestamps: generation.unix_seconds, series: generation.production_types},
};
await mkdir(new URL("../src/data/", import.meta.url), {recursive: true});
await writeFile(new URL("../src/data/snapshot.json", import.meta.url), `${JSON.stringify(snapshot, null, "\t")}\n`);
console.log(
	`Saved ${date}: ${weather.hourly.time.length} weather hours, ${prices.price.length} prices, ${generation.production_types.length} generation series.`,
);
