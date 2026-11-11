import {useState} from "react";
import type {CSSProperties} from "react";
import {energyMoved, streetLimitKw, streetLoad, streetStats} from "@/lib/autopilot";

const x = (hour: number) => (40 + (hour * 660) / 23).toFixed(1);
const y = (kw: number) => (220 - (kw * 200) / 120).toFixed(1);

function chart(homes: number[], businesses: number[]) {
	const hours = homes.map((_, hour) => hour);
	const top = (hour: number) => `${x(hour)},${y(homes[hour] + businesses[hour])}`;
	const businessArea = `M${x(0)},${y(0)} ${hours.map((hour) => `L${x(hour)},${y(businesses[hour])}`).join(" ")} L${x(23)},${y(0)} Z`;
	const homeArea = `M${top(0)} ${hours
		.slice(1)
		.map((hour) => `L${top(hour)}`)
		.join(" ")} ${[...hours]
		.reverse()
		.map((hour) => `L${x(hour)},${y(businesses[hour])}`)
		.join(" ")} Z`;
	const total = hours.map((hour) => `${hour ? "L" : "M"}${top(hour)}`).join(" ");
	return {businessArea, homeArea, total, ...streetStats(homes, businesses)};
}

const scenarios = {
	before: {
		...chart(streetLoad.before.homes, streetLoad.before.businesses),
		lineColor: "#B5541C",
		moved: 0,
	},
	after: {
		...chart(streetLoad.after.homes, streetLoad.after.businesses),
		lineColor: "#141A13",
		moved: Math.round(energyMoved()),
	},
};

// The CSS `d` property animates between scenarios where supported; the attribute is the fallback.
const morph = (d: string, extra: CSSProperties = {}) => ({d, style: {d: `path('${d}')`, ...extra} as CSSProperties});

export function StreetChart() {
	const [withAutopilot, setWithAutopilot] = useState(false);
	const scenario = withAutopilot ? scenarios.after : scenarios.before;
	const label = withAutopilot
		? `Street power use over a day with Autopilot: flexible use is spread out and the total stays flat, peaking at ${scenario.peak} kW, under the ${streetLimitKw} kW limit.`
		: `Street power use over a day without coordination: households and businesses overlap around 17:00 and the total peaks at ${scenario.peak} kW, above the ${streetLimitKw} kW limit.`;
	return (
		<div className="gs-card gs-street-card">
			<div className="gs-card-heading">
				<div>
					<p className="gs-card-title">One street in Oosterpoort</p>
					<p className="gs-card-sub">40 homes + 4 businesses · power use over a day (kW)</p>
				</div>
				<div aria-label="Scenario" className="gs-segment gs-segment-small" role="group">
					<button
						aria-pressed={!withAutopilot}
						className="gs-btn"
						type="button"
						onClick={() => setWithAutopilot(false)}>
						Everyone at once
					</button>
					<button aria-pressed={withAutopilot} className="gs-btn" type="button" onClick={() => setWithAutopilot(true)}>
						With Autopilot
					</button>
				</div>
			</div>
			<svg aria-label={label} className="gs-street-svg" role="img" viewBox="0 0 720 250">
				<line stroke="#E6E8E2" x1="40" x2="700" y1="220" y2="220" />
				{[153.3, 86.7, 20].map((line) => (
					<line key={line} stroke="#F1F2EE" x1="40" x2="700" y1={line} y2={line} />
				))}
				{[0, 40, 80, 120].map((kw) => (
					<text key={kw} fill="#6B7366" fontSize="11" textAnchor="end" x="32" y={Number(y(kw)) + 4}>
						{kw}
					</text>
				))}
				<path className="gs-morph" fill="#9FB7C4" fillOpacity=".7" {...morph(scenario.businessArea)} />
				<path className="gs-morph" fill="#A6D884" fillOpacity=".8" {...morph(scenario.homeArea)} />
				<line
					stroke="#B5541C"
					strokeDasharray="6 5"
					strokeWidth="1.5"
					x1="40"
					x2="700"
					y1={y(streetLimitKw)}
					y2={y(streetLimitKw)}
				/>
				<text fill="#9A4416" fontSize="11" textAnchor="end" x="700" y="72">
					Street limit {streetLimitKw} kW
				</text>
				<path
					className="gs-morph"
					fill="none"
					stroke={scenario.lineColor}
					strokeLinejoin="round"
					strokeWidth="2.5"
					{...morph(scenario.total, {stroke: scenario.lineColor})}
				/>
			</svg>
			<div aria-hidden="true" className="gs-street-hours">
				<span>00:00</span>
				<span>06:00</span>
				<span>12:00</span>
				<span>18:00</span>
				<span>23:00</span>
			</div>
			<div className="gs-legend">
				<span>
					<i className="gs-swatch" style={{background: "#A6D884"}} />
					Households
				</span>
				<span>
					<i className="gs-swatch" style={{background: "#9FB7C4"}} />
					Businesses
				</span>
				<span>
					<i className="gs-swatch gs-swatch-line" />
					Street total
				</span>
			</div>
			<div aria-live="polite" className="gs-stat-grid gs-stat-grid-small">
				<div className="gs-stat">
					<p>Highest peak</p>
					<p className="gs-display gs-num">
						{scenario.peak}
						<small>kW</small>
					</p>
				</div>
				<div className="gs-stat">
					<p>Peak vs average</p>
					<p className="gs-display gs-num">{scenario.ratio.toFixed(2)}×</p>
				</div>
				<div className="gs-stat">
					<p>Hours over the limit</p>
					<p className="gs-display gs-num">{scenario.hoursOver}</p>
				</div>
				<div className="gs-stat">
					<p>Energy moved</p>
					<p className="gs-display gs-num">
						{scenario.moved}
						<small>kWh</small>
					</p>
				</div>
			</div>
			<p className="gs-fine">
				Simulated. Same total energy in both scenarios, only moved in time. Physically every kWh still flows through the
				public grid.
			</p>
		</div>
	);
}
