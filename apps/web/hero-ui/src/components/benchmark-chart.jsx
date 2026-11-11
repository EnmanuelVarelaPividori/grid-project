import {Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis} from "recharts";
import {ChartContainer, ChartTooltip, ChartTooltipContent} from "./ui/chart";
export function BenchmarkChart({backtest}) {
	if (!backtest?.scores?.length) return <p className="quiet">Loading benchmark…</p>;
	return (
		<ChartContainer className="h-64 w-full" config={{cost_eur: {label: "Modelled cost", color: "#4a7a35"}}}>
			<BarChart
				accessibilityLayer
				data={backtest.scores}
				layout="vertical"
				margin={{left: 0, right: 20, top: 8, bottom: 0}}>
				<CartesianGrid horizontal={false} />
				<XAxis tickFormatter={(value) => `€${value}`} type="number" />
				<YAxis dataKey="label" tick={{fontSize: 11}} tickLine={false} type="category" width={120} />
				<ChartTooltip
					content={
						<ChartTooltipContent
							formatter={(value) =>
								new Intl.NumberFormat("nl-NL", {style: "currency", currency: "EUR"}).format(Number(value))
							}
						/>
					}
				/>
				<Bar dataKey="cost_eur" radius={4}>
					{backtest.scores.map((score) => (
						<Cell key={score.key} fill={score.key === "gridshare_ai" ? "#4a7a35" : "#a6b598"} />
					))}
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}
