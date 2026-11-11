import {useId, useState} from "react";
import {localTime} from "@/lib/simulation";

export interface ChartSeries {
	name: string;
	color: string;
	values: number[];
	dashed?: boolean;
	fill?: boolean;
}

const noLimits: {value: number; label: string}[] = [];

export function EnergyChart({
	timestamps,
	series,
	limits = noLimits,
	unit = "kW",
	compact = false,
}: {
	timestamps: number[];
	series: ChartSeries[];
	limits?: {value: number; label: string}[];
	unit?: string;
	compact?: boolean;
}) {
	const gradient = useId().replaceAll(":", "");
	const [hover, setHover] = useState<number | null>(null);
	const width = 900;
	const height = compact ? 200 : 310;
	const padding = {left: 49, right: 22, top: 26, bottom: 34};
	const all = series.flatMap((item) => item.values).filter(Number.isFinite);
	const rawMax = Math.max(1, ...all, ...limits.map((limit) => limit.value));
	const rawMin = Math.min(0, ...all, ...limits.map((limit) => limit.value));
	const step = Math.max(unit === "%" ? 20 : 5, Math.ceil((rawMax - rawMin) / 5 / 10) * 10);
	const max = Math.ceil(rawMax / step) * step || step;
	const min = Math.floor(rawMin / step) * step;
	const innerWidth = width - padding.left - padding.right;
	const innerHeight = height - padding.top - padding.bottom;
	const x = (index: number) => padding.left + (index / Math.max(1, timestamps.length - 1)) * innerWidth;
	const y = (value: number) => padding.top + ((max - value) / (max - min)) * innerHeight;
	const ticks = Array.from({length: Math.round((max - min) / step) + 1}, (_, index) => min + index * step);
	const selected = hover === null ? null : Math.min(timestamps.length - 1, hover);
	return (
		<div
			className={`energy-chart ${compact ? "compact-chart" : ""}`}
			onPointerLeave={() => setHover(null)}
			onPointerMove={(event) => {
				const bounds = event.currentTarget.getBoundingClientRect();
				const position = ((event.clientX - bounds.left) / bounds.width) * width;
				setHover(
					Math.max(
						0,
						Math.min(
							timestamps.length - 1,
							Math.round(((position - padding.left) / innerWidth) * (timestamps.length - 1)),
						),
					),
				);
			}}>
			<svg
				aria-label={`${series.map((item) => item.name).join(" and ")} in ${unit} over the day. Positive grid exchange is import; negative is export.`}
				role="img"
				viewBox={`0 0 ${width} ${height}`}>
				<defs>
					{series.map((item, index) => (
						<linearGradient key={item.name} id={`${gradient}-${index}`} x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stopColor={item.color} stopOpacity="0.16" />
							<stop offset="100%" stopColor={item.color} stopOpacity="0.015" />
						</linearGradient>
					))}
				</defs>
				<text className="axis-unit" x="10" y="14">
					{unit}
				</text>
				{ticks.map((value) => (
					<g key={value}>
						<line
							className={value === 0 ? "chart-zero" : "chart-grid"}
							x1={padding.left}
							x2={width - padding.right}
							y1={y(value)}
							y2={y(value)}
						/>
						<text className="axis-label" textAnchor="end" x={padding.left - 14} y={y(value) + 4}>
							{value}
						</text>
					</g>
				))}
				{limits.map((limit) => (
					<g key={limit.label}>
						<line
							className="limit-line"
							x1={padding.left}
							x2={width - padding.right}
							y1={y(limit.value)}
							y2={y(limit.value)}
						/>
						<text className="limit-label" textAnchor="end" x={width - padding.right - 5} y={y(limit.value) - 7}>
							{limit.label} · {Math.abs(limit.value)} {unit}
						</text>
					</g>
				))}
				{series.map((item, index) => {
					const points = item.values.map((value, i) => `${x(i)},${y(value)}`).join(" ");
					return (
						<g key={item.name}>
							{item.fill && (
								<polygon
									fill={`url(#${gradient}-${index})`}
									points={`${x(0)},${y(0)} ${points} ${x(item.values.length - 1)},${y(0)}`}
								/>
							)}
							<polyline
								fill="none"
								points={points}
								stroke={item.color}
								strokeDasharray={item.dashed ? "6 6" : undefined}
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={item.dashed ? 2 : 2.8}
							/>
						</g>
					);
				})}
				{timestamps.map((timestamp, index) =>
					index % 16 === 0 ? (
						<text key={timestamp} className="axis-label" textAnchor="middle" x={x(index)} y={height - 7}>
							{localTime(timestamp)}
						</text>
					) : null,
				)}
				{selected !== null && (
					<g>
						<line
							className="hover-line"
							x1={x(selected)}
							x2={x(selected)}
							y1={padding.top}
							y2={height - padding.bottom}
						/>
						{series.map((item) => (
							<circle
								key={item.name}
								cx={x(selected)}
								cy={y(item.values[selected])}
								fill={item.color}
								r="4"
								stroke="white"
								strokeWidth="2"
							/>
						))}
					</g>
				)}
			</svg>
			{selected !== null && (
				<div className="chart-tooltip" style={{left: `${Math.min(72, Math.max(8, (x(selected) / width) * 100))}%`}}>
					<strong>
						{localTime(timestamps[selected])} <span>Amsterdam</span>
					</strong>
					{series.map((item) => (
						<div key={item.name}>
							<span>
								<i style={{background: item.color}} />
								{item.name}
							</span>
							<b>
								{item.values[selected]?.toFixed(1)} {unit}
							</b>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export function Sparkline({values, color = "#69865a"}: {values: number[]; color?: string}) {
	const max = Math.max(1, ...values);
	const min = Math.min(0, ...values);
	const points = values
		.map(
			(value, index) => `${(index / Math.max(1, values.length - 1)) * 104},${33 - ((value - min) / (max - min)) * 28}`,
		)
		.join(" ");
	return (
		<svg aria-hidden="true" className="sparkline" viewBox="0 0 104 38">
			<polyline
				fill="none"
				points={points}
				stroke={color}
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.8"
			/>
		</svg>
	);
}
