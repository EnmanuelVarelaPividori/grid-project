import {
	ArrowDownToLine,
	ArrowRight,
	ArrowUpRight,
	ArrowsRotateRight,
	Calendar,
	ChartLine,
	Check,
	ChevronDown,
	CircleInfo,
	Cloud,
	Database,
	LayoutCellsLarge,
	LocationArrow,
	PlugConnection,
	Sliders,
	Sun,
	Thunderbolt,
	Xmark,
} from "@gravity-ui/icons";
import {useQuery} from "@tanstack/react-query";
import {useState, useSyncExternalStore} from "react";
import type {ComponentType, SVGProps} from "react";
import {EnergyChart, Sparkline} from "@/components/energy-chart";
import {average, fetchLocation, fetchWeather, generationMix, snapshot} from "@/lib/energy-data";
import {
	browserSnapshot,
	persistScenario,
	readSavedScenario,
	serverBrowserSnapshot,
	serverScenario,
	subscribeBrowser,
	subscribeScenario,
} from "@/lib/scenario-store";
import {defaultScenario, localTime, simulate, summarize} from "@/lib/simulation";
import type {BusinessProfile, Interval, Scenario} from "@/lib/simulation";

type View = "overview" | "simulator" | "market" | "sources";
type Icon = ComponentType<SVGProps<SVGSVGElement>>;
const number = (value: number, digits = 0) =>
	new Intl.NumberFormat("en-GB", {maximumFractionDigits: digits, minimumFractionDigits: digits}).format(value);
const dateLabel = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "long",
	year: "numeric",
	timeZone: "Europe/Amsterdam",
}).format(new Date(`${snapshot.date}T12:00:00Z`));
const nav: {id: View; name: string; icon: Icon}[] = [
	{id: "overview", name: "Overview", icon: LayoutCellsLarge},
	{id: "simulator", name: "Scenario studio", icon: Sliders},
	{id: "market", name: "Energy market", icon: ChartLine},
	{id: "sources", name: "Data sources", icon: Database},
];

function BatteryIcon({size = 20}: {size?: number}) {
	return (
		<svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
			<rect height="12" rx="2" stroke="currentColor" strokeWidth="1.7" width="17" x="2" y="6" />
			<path d="M22 10v4M6 10v4m4-4v4m4-4v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
		</svg>
	);
}

function Status({children, tone = "green"}: {children: React.ReactNode; tone?: "green" | "amber" | "neutral"}) {
	return (
		<span className={`status status-${tone}`}>
			<i />
			{children}
		</span>
	);
}

function RangeControl({
	label,
	value,
	unit,
	min = 0,
	max,
	step = 5,
	onChange,
}: {
	label: string;
	value: number;
	unit: string;
	min?: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
}) {
	return (
		<label className="range-control">
			<span>
				<span>{label}</span>
				<b>
					{value} <small>{unit}</small>
				</b>
			</span>
			<input
				aria-label={label}
				max={max}
				min={min}
				step={step}
				style={{"--range-progress": `${((value - min) / (max - min)) * 100}%`} as React.CSSProperties}
				type="range"
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
			/>
		</label>
	);
}

function ScenarioControls({
	scenario,
	setScenario,
	studio = false,
}: {
	scenario: Scenario;
	setScenario: (value: Scenario) => void;
	studio?: boolean;
}) {
	const update = (key: keyof Scenario, value: number) => setScenario({...scenario, [key]: value});
	return (
		<section className={`card scenario-card ${studio ? "studio-controls" : ""}`}>
			<div className="card-title">
				<div>
					<span className="eyebrow">MAKE IT YOURS</span>
					<h2>Your energy setup</h2>
				</div>
				<Sliders height={19} width={19} />
			</div>
			<label className="profile-control">
				Business profile
				<select
					value={scenario.profile}
					onChange={(event) => setScenario({...scenario, profile: event.target.value as BusinessProfile})}>
					<option value="workshop">Workshop & light industry</option>
					<option value="office">Office & workspace</option>
					<option value="warehouse">Warehouse & logistics</option>
				</select>
			</label>
			<div className="control-group">
				<h3>
					<Sun height={16} width={16} /> Solar installation
				</h3>
				<RangeControl
					label="Installed capacity"
					max={700}
					step={10}
					unit="kWp"
					value={scenario.solarKw}
					onChange={(value) => update("solarKw", value)}
				/>
			</div>
			<div className="control-group">
				<h3>
					<BatteryIcon size={16} /> Battery storage
				</h3>
				<RangeControl
					label="Battery capacity"
					max={400}
					step={10}
					unit="kWh"
					value={scenario.batteryKwh}
					onChange={(value) => update("batteryKwh", value)}
				/>
				<RangeControl
					label="Charge / discharge power"
					max={150}
					unit="kW"
					value={scenario.batteryKw}
					onChange={(value) => update("batteryKw", value)}
				/>
			</div>
			<div className="control-group">
				<h3>
					<PlugConnection height={16} width={16} /> Grid connection
				</h3>
				<RangeControl
					label="Import target"
					max={120}
					min={10}
					unit="kW"
					value={scenario.importLimit}
					onChange={(value) => update("importLimit", value)}
				/>
				<RangeControl
					label="Export limit"
					max={100}
					unit="kW"
					value={scenario.exportLimit}
					onChange={(value) => update("exportLimit", value)}
				/>
			</div>
			<div className="setup-note">
				<CircleInfo height={15} width={15} />
				<span>Changes update the simulation instantly. No equipment is connected.</span>
			</div>
			<button className="button button-secondary reset-button" onClick={() => setScenario(defaultScenario)}>
				<ArrowsRotateRight height={15} width={15} />
				Reset to demo setup
			</button>
		</section>
	);
}

function Metric({
	label,
	value,
	unit,
	note,
	tag,
	icon: MetricIcon,
	values,
	color,
}: {
	label: string;
	value: string;
	unit: string;
	note: string;
	tag?: string;
	icon?: Icon;
	values: number[];
	color?: string;
}) {
	return (
		<article className="card metric">
			<div className="metric-label">
				{label}
				{MetricIcon ? <MetricIcon height={18} width={18} /> : <BatteryIcon size={18} />}
			</div>
			<div className="metric-value">
				{value}
				<span>{unit}</span>
			</div>
			<div className="metric-bottom">
				<div>
					{tag && <span className="metric-tag">{tag}</span>}
					<p>{note}</p>
				</div>
				<Sparkline color={color} values={values} />
			</div>
		</article>
	);
}

function exportCsv(points: Interval[], scenario: Scenario, weatherMode: string) {
	const rows = [
		["# Gridwise illustrative scenario; site demand and dispatch are simulated; PV is estimated."],
		[`# Weather: ${weatherMode}; market snapshot retrieved ${snapshot.retrievedAt}; profile: ${scenario.profile}`],
		[
			"timestamp_utc",
			"time_amsterdam",
			"demand_kw",
			"estimated_solar_kw",
			"baseline_grid_kw",
			"optimized_grid_kw",
			"charge_kw",
			"discharge_kw",
			"battery_soc_percent",
		],
		...points.map((point) => [
			new Date(point.timestamp * 1000).toISOString(),
			localTime(point.timestamp),
			...[point.load, point.solar, point.baseline, point.optimized, point.charge, point.discharge, point.soc].map(
				(value) => value.toFixed(3),
			),
		]),
	];
	const url = URL.createObjectURL(
		new Blob([rows.map((row) => row.join(",")).join("\n")], {type: "text/csv;charset=utf-8;"}),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = `gridwise-${snapshot.date}-${scenario.profile}.csv`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Dashboard() {
	const [view, setView] = useState<View>("overview");
	const savedScenario = useSyncExternalStore(subscribeScenario, readSavedScenario, serverScenario);
	const [draftScenario, setScenario] = useState<Scenario | null>(null);
	const scenario = draftScenario ?? savedScenario;
	const [compare, setCompare] = useState(true);
	const [showSolar, setShowSolar] = useState(false);
	const [helpOpen, setHelpOpen] = useState(false);
	const [saved, setSaved] = useState(false);
	const browserReady = useSyncExternalStore(subscribeBrowser, browserSnapshot, serverBrowserSnapshot);
	const settingsLoaded = browserReady;
	const weather = useQuery({
		queryKey: ["weather", snapshot.date],
		queryFn: ({signal}) => fetchWeather(signal),
		enabled: browserReady,
		staleTime: 600_000,
		retry: 1,
	});
	const location = useQuery({
		queryKey: ["location", "Groningen"],
		queryFn: ({signal}) => fetchLocation(signal),
		enabled: browserReady,
		staleTime: 86_400_000,
		retry: 1,
	});
	const weatherData = weather.data?.hourly ?? snapshot.weather;
	const points = simulate(weatherData, scenario);
	const summary = summarize(points);
	const mix = generationMix();
	const meanPrice = average(snapshot.prices.values);
	const weatherMode =
		weather.data && !weather.isError ? "Live forecast" : weather.isFetching ? "Connecting" : "Snapshot";
	const renewable = mix
		.filter((item) => item.name === "Solar" || item.name === "Wind")
		.reduce((sum, item) => sum + item.share, 0);
	const meanTemperature = average(weatherData.temperature_2m);
	const maxSolar = Math.max(0, ...points.map((point) => point.solar));
	const peakSolarPoint = points.find((point) => point.solar === maxSolar);
	const firstCharge = points.find((point) => point.charge > 0.1);
	const firstDischarge = points.find((point) => point.discharge > 0.1);
	const violations = points.filter(
		(point) => point.optimized > scenario.importLimit + 0.1 || -point.optimized > scenario.exportLimit + 0.1,
	).length;
	const series = [
		...(compare
			? [{name: "Without battery", color: "#bbb5a9", values: points.map((point) => point.baseline), dashed: true}]
			: []),
		{name: "With battery", color: "#688557", values: points.map((point) => point.optimized), fill: true},
		...(showSolar ? [{name: "Solar production", color: "#d9ab49", values: points.map((point) => point.solar)}] : []),
	];
	const saveScenario = () => {
		try {
			persistScenario(scenario);
			setSaved(true);
			setTimeout(() => setSaved(false), 2200);
		} catch {
			setHelpOpen(true);
		}
	};
	return (
		<div className="app-shell">
			<a className="skip-link" href="#main-content">
				Skip to dashboard
			</a>
			<aside className="sidebar">
				<a aria-label="Gridwise overview" className="brand" href="#main-content" onClick={() => setView("overview")}>
					<span className="brand-mark">
						<i />
						<i />
						<i />
						<i />
					</span>
					gridwise<span className="brand-dot">.</span>
				</a>
				<div className="workspace-label">WORKSPACE</div>
				<div className="workspace">
					<div className="workspace-icon">
						<LocationArrow height={18} width={18} />
					</div>
					<div>
						<strong>Groningen</strong>
						<span>Business energy demo</span>
					</div>
					<span className="workspace-nl">NL</span>
				</div>
				<div className="sidebar-label">PLATFORM</div>
				<nav aria-label="Main navigation">
					{nav.map((item) => (
						<button
							key={item.id}
							aria-current={view === item.id ? "page" : undefined}
							className={`nav-item ${view === item.id ? "active" : ""}`}
							onClick={() => setView(item.id)}>
							<item.icon height={19} width={19} />
							{item.name}
							{item.id === "sources" && <span className="nav-count">3</span>}
						</button>
					))}
				</nav>
				<div className="sidebar-bottom">
					<div className="sidebar-promo">
						<span className="promo-icon">
							<Sun height={22} width={22} />
						</span>
						<h3>
							Small shifts.
							<br />A bigger difference.
						</h3>
						<p>Make your energy work better for your business and your grid.</p>
						<button onClick={() => setHelpOpen(true)}>
							How it works <ArrowUpRight height={15} width={15} />
						</button>
					</div>
					<button className="sidebar-help" onClick={() => setHelpOpen(true)}>
						<CircleInfo height={17} width={17} />
						About this demo
						<ArrowUpRight height={14} width={14} />
					</button>
					<div className="profile">
						<span className="avatar">GW</span>
						<div>
							<strong>Demo workspace</strong>
							<span>Groningen, Netherlands</span>
						</div>
						<span className="profile-dot" />
					</div>
				</div>
			</aside>
			<div className="app-content">
				<header className="topbar">
					<div className="breadcrumb">
						Workspace <span>/</span> <strong>{nav.find((item) => item.id === view)?.name}</strong>
					</div>
					<div className="topbar-right">
						<span className="demo-pill">INTERACTIVE DEMO</span>
						<a
							className="topbar-location"
							href="https://www.openstreetmap.org/#map=12/53.2194/6.5665"
							rel="noreferrer"
							target="_blank">
							<LocationArrow height={14} width={14} /> Groningen, NL <ArrowUpRight height={13} width={13} />
						</a>
					</div>
				</header>
				<main id="main-content">
					<div className="page-heading">
						<div>
							<div className="eyebrow">A LITTLE SMARTER. A LOT MORE BALANCED.</div>
							<h1>
								{view === "overview"
									? "Your energy, in balance."
									: view === "simulator"
										? "Find your better balance."
										: view === "market"
											? "The bigger energy picture."
											: "Good decisions start with good data."}
							</h1>
							<p>
								{view === "overview"
									? "See what solar and storage can do for your business."
									: view === "simulator"
										? "Explore the impact of every panel, battery and kilowatt."
										: view === "market"
											? "Real Dutch market data, with the context that matters."
											: "A transparent look at what is live, recorded and simulated."}
							</p>
						</div>
						<button className="button button-secondary date-button" onClick={() => setView("sources")}>
							<Calendar height={16} width={16} />
							{dateLabel}
							<ChevronDown height={13} width={13} />
						</button>
					</div>
					<div className="demo-notice">
						<span className="notice-icon">
							<Thunderbolt height={16} width={16} />
						</span>
						<p>
							<strong>Real forecasts. Possible futures.</strong> Weather and market data are real. Business demand and
							battery operation are simulated.
						</p>
						<button onClick={() => setView("sources")}>
							Explore the data <ArrowRight height={14} width={14} />
						</button>
					</div>
					{(view === "overview" || view === "simulator") && (
						<>
							<div aria-live="polite" className="metrics-grid">
								<Metric
									icon={PlugConnection}
									label="Peak grid import"
									note={`was ${number(summary.peakBefore, 1)} kW without storage`}
									tag={`${number(summary.peakReduction)}% lower peak`}
									unit="kW"
									value={number(summary.peakAfter, 1)}
									values={points.map((point) => Math.max(0, point.optimized))}
								/>
								<Metric
									color="#dab15a"
									icon={Sun}
									label="Solar production"
									note="Weather-based estimate · full day"
									tag="Estimated"
									unit="kWh"
									value={number(summary.solar)}
									values={points.map((point) => point.solar)}
								/>
								<Metric
									icon={Thunderbolt}
									label="Solar captured onsite"
									note="Used directly or stored in your battery"
									unit="%"
									value={number(summary.selfConsumption)}
									values={points.map((point) => Math.min(point.solar, point.load) + point.charge)}
								/>
								<Metric
									color="#899ba3"
									label="Energy from battery"
									note={`${number(summary.storedAtEnd, 1)} kWh stored at end of day`}
									tag="Simulated"
									unit="kWh"
									value={number(summary.discharged, 1)}
									values={points.map((point) => point.discharge)}
								/>
							</div>
							<div className="dashboard-grid">
								<div className="dashboard-main">
									<section className="card exchange-card">
										<div className="chart-heading">
											<div>
												<h2>A flatter curve. A lighter grid.</h2>
												<p>Your business’s electricity import and export over 24 hours.</p>
											</div>
											<div className="chart-actions">
												<button
													aria-pressed={compare}
													className={`small-toggle ${compare ? "selected" : ""}`}
													onClick={() => setCompare(!compare)}>
													<ChartLine height={14} width={14} />
													Compare
												</button>
												<button
													aria-label="Export simulation as CSV"
													className="icon-button"
													title="Export simulation as CSV"
													onClick={() => exportCsv(points, scenario, weatherMode)}>
													<ArrowDownToLine height={17} width={17} />
												</button>
											</div>
										</div>
										<div className="chart-legend">
											{compare && (
												<span>
													<i className="legend-dashed" />
													Without battery
												</span>
											)}
											<span>
												<i className="legend-green" />
												With battery
											</span>
											<button
												aria-pressed={showSolar}
												className={showSolar ? "solar-toggle selected" : "solar-toggle"}
												onClick={() => setShowSolar(!showSolar)}>
												<i className="legend-solar" />
												Solar production
											</button>
											<span className="legend-meta">15-min intervals · simulated</span>
										</div>
										<EnergyChart
											series={series}
											timestamps={points.map((point) => point.timestamp)}
											limits={[
												{value: scenario.importLimit, label: "Import target"},
												{value: -scenario.exportLimit, label: "Export limit"},
											]}
										/>
										<div className="chart-footnote">
											<span>
												<ArrowUpRight height={14} width={14} />
												Above zero: grid import <span className="footnote-divider">·</span> Below zero: solar export
											</span>
											<span>Europe/Amsterdam</span>
										</div>
										<div className="chart-insight">
											<span className="insight-check">
												<Check height={15} width={15} />
											</span>
											<p>
												{summary.peakReduction > 0.1 ? (
													<>
														<strong>
															{number(summary.peakBefore - summary.peakAfter, 1)} kW less at your highest peak.
														</strong>{" "}
														Your battery shifts solar energy to when your business needs it.
													</>
												) : (
													<>
														<strong>Every setup tells a different story.</strong> Try more solar or storage to explore
														the effect on your grid peaks.
													</>
												)}
											</p>
										</div>
									</section>
									<div className="lower-grid">
										<section className="card solar-card">
											<div className="card-title">
												<div>
													<h2>A look at your solar day</h2>
													<p>Groningen weather & production</p>
												</div>
												<span className="sun-icon">
													<Sun height={23} width={23} />
												</span>
											</div>
											<div className="solar-summary">
												<div>
													<strong>
														{number(maxSolar, 1)}
														<small> kW</small>
													</strong>
													<span>Peak estimated production</span>
												</div>
												<div className="weather-reading">
													<Cloud height={25} width={25} />
													<strong>{meanTemperature === null ? "—" : number(meanTemperature, 1)}°</strong>
													<span>Day average</span>
												</div>
											</div>
											<div aria-label="Estimated hourly solar production" className="solar-bars">
												{weatherData.time.map((time, index) => (
													<div
														key={time}
														title={`${localTime(time)}: ${number(((weatherData.shortwave_radiation[index] ?? 0) / 1000) * scenario.solarKw * 0.85, 1)} kW`}>
														<span
															style={{
																height: `${Math.max(3, ((weatherData.shortwave_radiation[index] ?? 0) / Math.max(1, ...weatherData.shortwave_radiation.map((value) => value ?? 0))) * 100)}%`,
															}}
														/>
													</div>
												))}
											</div>
											<div className="mini-axis">
												<span>00:00</span>
												<span>06:00</span>
												<span>12:00</span>
												<span>18:00</span>
												<span>24:00</span>
											</div>
											<div className="solar-card-footer">
												<Status tone={weather.data && !weather.isError ? "green" : "amber"}>{weatherMode}</Status>
												<span>
													Open-Meteo <ArrowUpRight height={11} width={11} />
												</span>
											</div>
										</section>
										<section className="card market-card">
											<div className="card-title">
												<div>
													<h2>Meanwhile, on the grid</h2>
													<p>The Netherlands · recorded data</p>
												</div>
												<span className="neutral-icon">
													<PlugConnection height={21} width={21} />
												</span>
											</div>
											<div className="market-price">
												<strong>
													{meanPrice === null ? "—" : number(meanPrice / 10, 1)}
													<small> ct/kWh</small>
												</strong>
												<span>Average day-ahead wholesale price</span>
											</div>
											<div className="mix-bar">
												{mix.map((item) => (
													<span
														key={item.name}
														style={{background: item.color, width: `${item.share}%`}}
														title={`${item.name}: ${number(item.share, 1)}%`}
													/>
												))}
											</div>
											<div className="mix-labels">
												{mix.slice(0, 3).map((item) => (
													<span key={item.name}>
														<i style={{background: item.color}} />
														{item.name} <b>{number(item.share)}%</b>
													</span>
												))}
											</div>
											<button className="market-link" onClick={() => setView("market")}>
												Explore the energy market <ArrowRight height={15} width={15} />
											</button>
										</section>
									</div>
									{view === "simulator" && (
										<section className="card battery-chart-card">
											<div className="card-title">
												<div>
													<h2>Give your solar somewhere to go</h2>
													<p>Simulated battery charge level · 10% minimum reserve · 90% round-trip efficiency</p>
												</div>
												<BatteryIcon />
											</div>
											<EnergyChart
												compact
												timestamps={points.map((point) => point.timestamp)}
												unit="%"
												series={[
													{
														name: "Battery charge",
														color: "#688557",
														values: points.map((point) => point.soc),
														fill: true,
													},
												]}
											/>
										</section>
									)}
								</div>
								<div className="dashboard-aside">
									<ScenarioControls scenario={scenario} setScenario={setScenario} studio={view === "simulator"} />
									<div className="save-scenario">
										<span>Like this setup? Keep exploring later.</span>
										<button className="text-button" disabled={!settingsLoaded} onClick={saveScenario}>
											{saved ? (
												<>
													<Check height={14} width={14} />
													Saved to this browser
												</>
											) : (
												<>
													Save this scenario <ArrowRight height={14} width={14} />
												</>
											)}
										</button>
									</div>
								</div>
							</div>
							<section className="card daily-plan">
								<div className="plan-intro">
									<span className="eyebrow">YOUR DAY, REIMAGINED</span>
									<h2>A little planning goes a long way.</h2>
									<p>A preview of how this setup could work.</p>
								</div>
								<div className="plan-event">
									<span className="plan-event-icon sun">
										<Sun height={20} width={20} />
									</span>
									<div>
										<small>{firstCharge ? localTime(firstCharge.timestamp) : "SOLAR WINDOW"}</small>
										<h3>{firstCharge ? "Catch the surplus" : "Use solar directly"}</h3>
										<p>
											{firstCharge
												? "Store extra solar instead of sending it to the grid."
												: "Generation first covers your business’s demand."}
										</p>
									</div>
								</div>
								<div className="plan-event">
									<span className="plan-event-icon battery">
										<BatteryIcon />
									</span>
									<div>
										<small>{firstDischarge ? localTime(firstDischarge.timestamp) : "AFTER SUNSET"}</small>
										<h3>{firstDischarge ? "Take the peak off" : "Explore more storage"}</h3>
										<p>
											{firstDischarge
												? "Use stored energy when demand rises above your target."
												: "Try a different setup to shift solar into the evening."}
										</p>
									</div>
								</div>
								<div className={`plan-result ${violations ? "plan-warning" : ""}`}>
									<span>{violations ? `${number(violations * 0.25, 2)} h` : "All clear"}</span>
									<p>
										{violations
											? "outside your chosen connection targets. Adjust the setup to explore."
											: "within your chosen connection targets for this scenario."}
									</p>
									<button onClick={() => setView("simulator")}>
										Fine-tune setup <ArrowUpRight height={14} width={14} />
									</button>
								</div>
							</section>
						</>
					)}
					{view === "market" && (
						<>
							<div className="market-overview-grid">
								<Metric
									icon={ChartLine}
									label="Average wholesale price"
									note="Recorded NL day-ahead prices · excludes tariffs"
									unit="ct/kWh"
									value={meanPrice === null ? "—" : number(meanPrice / 10, 1)}
									values={snapshot.prices.values.map((value) => value ?? 0)}
								/>
								<Metric
									color="#d4aa55"
									icon={Sun}
									label="Wind & solar share"
									note="Share of mean domestic generation"
									unit="%"
									value={number(renewable, 1)}
									values={
										snapshot.generation.series
											.find((item) => item.name === "Renewable share of generation")
											?.data.map((value) => value ?? 0) ?? []
									}
								/>
								<Metric
									icon={Database}
									label="Published price intervals"
									note={`Recorded for ${dateLabel}`}
									unit="records"
									value={String(snapshot.prices.values.filter((value) => value !== null).length)}
									values={snapshot.prices.values.map((value) => value ?? 0)}
								/>
							</div>
							<section className="card market-full-chart">
								<div className="card-title">
									<div>
										<h2>The price of a kilowatt-hour</h2>
										<p>Dutch day-ahead wholesale prices · Energy-Charts / SMARD · recorded snapshot</p>
									</div>
									<Status tone="amber">Snapshot</Status>
								</div>
								<EnergyChart
									timestamps={snapshot.prices.timestamps}
									unit="ct/kWh"
									series={[
										{
											name: "Wholesale price",
											color: "#688557",
											values: snapshot.prices.values.map((value) => (value === null ? 0 : value / 10)),
											fill: true,
										},
									]}
								/>
								<p className="panel-note">
									Wholesale prices give market context. Your business’s actual energy bill also depends on its supply
									contract, taxes and network tariffs.
								</p>
							</section>
							<section className="card generation-card">
								<div className="card-title">
									<div>
										<h2>Where Dutch electricity comes from</h2>
										<p>Mean reported domestic generation over available intervals · not the consumption mix</p>
									</div>
								</div>
								<div className="generation-list">
									{mix.map((item) => (
										<div key={item.name}>
											<span>
												<i style={{background: item.color}} />
												{item.name}
											</span>
											<div className="generation-track">
												<span style={{background: item.color, width: `${item.share}%`}} />
											</div>
											<b>{number(item.share, 1)}%</b>
											<small>{number(item.value)} MW</small>
										</div>
									))}
								</div>
								<p className="panel-note">
									Period:{" "}
									{snapshot.generation.timestamps.length
										? `${localTime(snapshot.generation.timestamps[0])}–${localTime(snapshot.generation.timestamps.at(-1) ?? 0)}`
										: "unavailable"}{" "}
									on {dateLabel}. Imports and exports are excluded from these shares.
								</p>
							</section>
						</>
					)}
					{view === "sources" && (
						<div className="sources-grid">
							<section className="card source-card">
								<div className="source-icon">
									<Cloud height={25} width={25} />
								</div>
								<Status tone={weather.data && !weather.isError ? "green" : "amber"}>{weatherMode}</Status>
								<h2>Weather & solar radiation</h2>
								<p>
									Open-Meteo forecasts for Groningen. Hourly radiation feeds the illustrative solar model. When the API
									is unavailable, a bundled forecast keeps the demo usable.
								</p>
								<dl>
									<div>
										<dt>Forecast date</dt>
										<dd>{dateLabel}</dd>
									</div>
									<div>
										<dt>Retrieved</dt>
										<dd>
											{weather.data && !weather.isError
												? new Date(weather.data.retrievedAt).toLocaleString("en-GB", {timeZone: "Europe/Amsterdam"})
												: new Date(snapshot.retrievedAt).toLocaleString("en-GB", {timeZone: "Europe/Amsterdam"})}
										</dd>
									</div>
									<div>
										<dt>Resolution</dt>
										<dd>Hourly · held over four 15-min intervals</dd>
									</div>
								</dl>
								{weather.isError && (
									<p className="source-warning">Live refresh unavailable. Showing the bundled Groningen forecast.</p>
								)}
								<a href="https://open-meteo.com/en/docs" rel="noreferrer" target="_blank">
									Open-Meteo documentation <ArrowUpRight height={15} width={15} />
								</a>
							</section>
							<section className="card source-card">
								<div className="source-icon">
									<ChartLine height={25} width={25} />
								</div>
								<Status tone="amber">Snapshot</Status>
								<h2>Dutch electricity market</h2>
								<p>
									Real day-ahead prices and reported national generation from Fraunhofer’s Energy-Charts API. Bundled
									records avoid browser CORS restrictions and remain available offline.
								</p>
								<dl>
									<div>
										<dt>Market date</dt>
										<dd>{dateLabel}</dd>
									</div>
									<div>
										<dt>Retrieved</dt>
										<dd>{new Date(snapshot.retrievedAt).toLocaleString("en-GB", {timeZone: "Europe/Amsterdam"})}</dd>
									</div>
									<div>
										<dt>Licence</dt>
										<dd>CC BY 4.0 · Energy-Charts / SMARD</dd>
									</div>
								</dl>
								<a href="https://api.energy-charts.info/" rel="noreferrer" target="_blank">
									Energy-Charts documentation <ArrowUpRight height={15} width={15} />
								</a>
							</section>
							<section className="card source-card">
								<div className="source-icon">
									<LocationArrow height={25} width={25} />
								</div>
								<Status tone={location.data ? "green" : "neutral"}>
									{location.data ? "Live lookup" : location.isFetching ? "Connecting" : "Bundled location"}
								</Status>
								<h2>Groningen location</h2>
								<p>
									PDOK’s Dutch public geocoding service verifies the workspace location. The weather model uses the
									fixed Groningen city coordinates below.
								</p>
								<dl>
									<div>
										<dt>Location</dt>
										<dd>{location.data?.weergavenaam ?? "Groningen, Netherlands"}</dd>
									</div>
									<div>
										<dt>Weather coordinates</dt>
										<dd>53.2194° N, 6.5665° E</dd>
									</div>
									<div>
										<dt>Access</dt>
										<dd>Public · no API key</dd>
									</div>
								</dl>
								<a href="https://www.pdok.nl/pdok-locatieserver" rel="noreferrer" target="_blank">
									PDOK documentation <ArrowUpRight height={15} width={15} />
								</a>
							</section>
							<section className="card model-card">
								<span className="eyebrow">WHAT THE DEMO MODELS</span>
								<h2>Real inputs. Transparent assumptions.</h2>
								<p>
									The business profiles are synthetic. Solar output uses horizontal irradiance × installed capacity × an
									illustrative 85% performance ratio, without roof geometry or shading. Battery dispatch captures solar
									surplus, then discharges above the import target, subject to its power, capacity and reserve.
								</p>
								<p>
									The battery starts at its 10% reserve and has 90% round-trip efficiency. Export limits are monitored,
									not enforced through curtailment. This is a demonstration of peak shaving, not an optimal dispatch
									solver or a live control system.
								</p>
								<a href="https://capaciteitskaart.netbeheernederland.nl/" rel="noreferrer" target="_blank">
									View official local grid capacity context <ArrowUpRight height={15} width={15} />
								</a>
							</section>
						</div>
					)}
					<footer className="page-footer">
						<span>
							<span className="footer-brand">gridwise.</span> Better energy starts with a little balance.
						</span>
						<button
							disabled={weather.isFetching || location.isFetching}
							onClick={() => {
								void weather.refetch();
								void location.refetch();
							}}>
							<ArrowsRotateRight className={weather.isFetching ? "spin" : ""} height={13} width={13} />
							{weather.isFetching ? "Refreshing sources…" : "Refresh live sources"}
						</button>
					</footer>
				</main>
			</div>
			{helpOpen && (
				<div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
					<section
						aria-labelledby="about-title"
						aria-modal="true"
						className="about-dialog"
						role="dialog"
						onClick={(event) => event.stopPropagation()}
						onKeyDown={(event) => {
							if (event.key === "Escape") setHelpOpen(false);
						}}>
						<button
							autoFocus
							aria-label="Close about this demo"
							className="icon-button modal-close"
							onClick={() => setHelpOpen(false)}>
							<Xmark height={20} width={20} />
						</button>
						<span className="large-sun">
							<Sun height={32} width={32} />
						</span>
						<span className="eyebrow">A SMARTER ENERGY DAY</span>
						<h2 id="about-title">Make room for a better balance.</h2>
						<p>
							Solar panels, batteries and your business can work together. Store solar surplus at midday, then use it to
							reduce demand peaks later in the day.
						</p>
						<ol>
							<li>
								<strong>Start with real inputs.</strong> We bring in Groningen weather forecasts and Dutch electricity
								data.
							</li>
							<li>
								<strong>Try your setup.</strong> Adjust solar, storage and connection targets to compare possible
								futures.
							</li>
							<li>
								<strong>See the difference.</strong> Explore grid exchange, solar capture and battery use. All business
								results are simulated.
							</li>
						</ol>
						<button
							className="button button-primary"
							onClick={() => {
								setHelpOpen(false);
								setView("simulator");
							}}>
							Explore a scenario <ArrowRight height={16} width={16} />
						</button>
					</section>
				</div>
			)}
			<span className="sr-only">
				Peak solar forecast at {peakSolarPoint ? localTime(peakSolarPoint.timestamp) : "unavailable"}. Settings{" "}
				{settingsLoaded ? "ready" : "loading"}.
			</span>
		</div>
	);
}
