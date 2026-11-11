/** Cumulative 15-minute import costs less export credit, matching the Python demo tariff. */
export function costSeries(forecast) {
	return (forecast?.timeseries || []).reduce(
		(points, row, index) => {
			const previous = points.at(-1);
			const cost = (power) => (Math.max(0, power) * row.price - Math.max(0, -power) * 0.045) * 0.25;
			const minutes = (index + 1) * 15;
			points.push({
				time: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
				before: previous.before + cost(row.net_before),
				after: previous.after + cost(row.net_after),
			});
			return points;
		},
		[{time: "00:00", before: 0, after: 0}],
	);
}
