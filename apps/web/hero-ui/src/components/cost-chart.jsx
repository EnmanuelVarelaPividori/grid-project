import {useMemo, useState} from "react";
import {CartesianGrid, Line, LineChart, XAxis, YAxis} from "recharts";
import {costSeries} from "../lib/cost-series.js";
import {Button} from "./ui/button";
import {ChartContainer, ChartTooltip} from "./ui/chart";

const euro = (value) => new Intl.NumberFormat("nl-NL", {style: "currency", currency: "EUR"}).format(value);
function CostTooltip({active, payload, label}) {
	if (!active || !payload?.length) return null;
	return (
		<div className="cost-tooltip">
			<strong>{label} · cumulative cost</strong>
			{payload.map((item) => (
				<div key={item.dataKey}>
					<span style={{color: item.color}}>{item.name}</span>
					<b>{euro(item.value)}</b>
				</div>
			))}
		</div>
	);
}
export function CostChart({forecast}) {
	const [visible, setVisible] = useState({before: true, after: true});
	const data = useMemo(() => costSeries(forecast), [forecast]);
	if (!forecast) return <p className="quiet">Loading cost comparison…</p>;
	return (
		<div className="interactive-cost-chart">
			<div className="cost-series-toggles">
				{[
					["before", "Without Autopilot"],
					["after", "With Autopilot"],
				].map(([key, label]) => (
					<Button
						key={key}
						aria-pressed={visible[key]}
						size="sm"
						variant={visible[key] ? "secondary" : "ghost"}
						onClick={() => setVisible((current) => ({...current, [key]: !current[key]}))}>
						<i style={{background: key === "before" ? "#a6b598" : "#4a7a35"}} />
						{label}
					</Button>
				))}
			</div>
			<div
				aria-label={`Cumulative modelled costs. Without Autopilot ${euro(forecast.before.cost_eur)}, with Autopilot ${euro(forecast.after.cost_eur)}. Hover, touch or use arrow keys for time intervals.`}
				className="cost-chart-canvas"
				role="img">
				<ChartContainer
					className="size-full"
					config={{
						before: {label: "Without Autopilot", color: "#a6b598"},
						after: {label: "With Autopilot", color: "#4a7a35"},
					}}>
					<LineChart accessibilityLayer data={data} margin={{top: 12, right: 15, bottom: 0, left: 0}}>
						<CartesianGrid stroke="#e5e8df" vertical={false} />
						<XAxis dataKey="time" interval="preserveStartEnd" minTickGap={45} tick={{fontSize: 10}} tickLine={false} />
						<YAxis tick={{fontSize: 10}} tickFormatter={(value) => `€${value}`} tickLine={false} width={48} />
						<ChartTooltip content={<CostTooltip />} />
						<Line
							dataKey="before"
							dot={false}
							hide={!visible.before}
							isAnimationActive={false}
							name="Without Autopilot"
							stroke="#a6b598"
							strokeWidth={2}
							type="monotone"
						/>
						<Line
							dataKey="after"
							dot={false}
							hide={!visible.after}
							isAnimationActive={false}
							name="With Autopilot"
							stroke="#4a7a35"
							strokeWidth={2}
							type="monotone"
						/>
					</LineChart>
				</ChartContainer>
			</div>
			<p className="quiet">Explore the day: hover, touch or use the arrow keys. Values add up through the day.</p>
		</div>
	);
}
