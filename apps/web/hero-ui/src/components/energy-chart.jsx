import {CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis} from "recharts";
import {ChartContainer, ChartTooltip, ChartTooltipContent} from "./ui/chart";
const config = {
	net_before: {label: "Without Autopilot", color: "#a6b598"},
	net_after: {label: "With Autopilot", color: "#4a7a35"},
};
export function EnergyChart({forecast}) {
	if (!forecast) return <div className="chart-loading">Loading energy forecast…</div>;
	return (
		<ChartContainer className="energy-chart" config={config}>
			<LineChart accessibilityLayer data={forecast.timeseries} margin={{top: 15, right: 15, left: 0, bottom: 0}}>
				<CartesianGrid vertical={false} />
				<XAxis dataKey="time" interval="preserveStartEnd" minTickGap={45} tickLine={false} />
				<YAxis tickFormatter={(value) => `${value}`} tickLine={false} width={40} />
				<ChartTooltip content={<ChartTooltipContent labelFormatter={(label) => `${label} · kW`} />} />
				<ReferenceLine
					label={{value: "Neighbourhood limit", position: "insideTopRight", fontSize: 10}}
					stroke="#b69b67"
					strokeDasharray="4 4"
					y={forecast.feeder_limit_kw}
				/>
				<Line
					dataKey="net_before"
					dot={false}
					isAnimationActive={false}
					stroke="var(--color-net_before)"
					strokeWidth={2}
				/>
				<Line
					dataKey="net_after"
					dot={false}
					isAnimationActive={false}
					stroke="var(--color-net_after)"
					strokeWidth={2}
				/>
			</LineChart>
		</ChartContainer>
	);
}
