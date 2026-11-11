import {ArrowRight, ArrowUpRight, Bars, Check, CircleInfo, Xmark} from "@gravity-ui/icons";
import {Button, Card, Input, Label, Link, Modal, Slider, Switch, Tabs, TextField} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {useState, useSyncExternalStore} from "react";
import type {FormEvent} from "react";
import {baselineLoad, feederProfile, initialPreferences, planTrades} from "@/lib/autopilot";
import type {Asset, Hours, Preferences, TradeMode} from "@/lib/autopilot";
import {average, fetchLocation, fetchWeather, snapshot} from "@/lib/energy-data";
import {AssetIcon, Brand} from "./asset-icon";
import {EnergyMap} from "./energy-map";

const hourSlots = baselineLoad.map((_, hour) => ({hour, id: `${String(hour).padStart(2, "0")}:00`}));
const subscribeHydrated = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;
const euro = (value: number) =>
	new Intl.NumberFormat("en-IE", {style: "currency", currency: "EUR", minimumFractionDigits: 2}).format(value);
const formatDate = (value: string) =>
	new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Europe/Amsterdam",
	}).format(new Date(value));
const hours: {id: Hours; label: string}[] = [
	{id: "daytime", label: "10–16h"},
	{id: "extended", label: "10–22h"},
	{id: "all", label: "All day"},
];
const suppliers: {id: Preferences["supplier"]; label: string; sharing: boolean}[] = [
	{id: "noordstroom", label: "Noordstroom", sharing: true},
	{id: "polder", label: "Polder Energie", sharing: true},
	{id: "vast", label: "Vast & Groen", sharing: false},
];
const features: {asset: Asset; title: string; text: string}[] = [
	{asset: "solar", title: "Solar", text: "Sells surplus above feed-in"},
	{asset: "battery", title: "Batteries", text: "Store midday, sell at dinner time"},
	{asset: "ev", title: "EV charging", text: "Charges when it’s cheap and local"},
	{asset: "flex", title: "Flexible use", text: "Heat pumps shift to sunny hours"},
];

function Range({
	label,
	value,
	min,
	max,
	step,
	format,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	format: (value: number) => string;
	onChange: (value: number) => void;
}) {
	return (
		<Slider
			aria-label={label}
			className="gs-slider"
			maxValue={max}
			minValue={min}
			step={step}
			value={value}
			onChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}>
			<Label>{label}</Label>
			<Slider.Output>{format(value)}</Slider.Output>
			<Slider.Track>
				<Slider.Fill />
				<Slider.Thumb />
			</Slider.Track>
		</Slider>
	);
}

function SignupDialog({kind, onClose}: {kind: "pilot" | "supplier" | null; onClose: () => void}) {
	const [request, setRequest] = useState<{name: string; email: string; company: string} | null>(null);
	const supplier = kind === "supplier";
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const fields = new FormData(event.currentTarget);
		setRequest({
			name: String(fields.get("name") ?? ""),
			email: String(fields.get("email") ?? ""),
			company: String(fields.get("company") ?? ""),
		});
	};
	return (
		<Modal
			isOpen={kind !== null}
			onOpenChange={(open) => {
				if (!open) {
					setRequest(null);
					onClose();
				}
			}}>
			<Modal.Backdrop className="gs-modal-backdrop">
				<Modal.Container className="gs-modal-container" placement="center" size="md">
					<Modal.Dialog className="gs-modal">
						<Modal.CloseTrigger aria-label="Close pilot dialog" className="gs-modal-close">
							<Xmark height={19} width={19} />
						</Modal.CloseTrigger>
						<Brand small />
						<Modal.Header>
							<span className="gs-eyebrow">THE GRONINGEN PILOT</span>
							<Modal.Heading>
								{request
									? "A first step towards sharing."
									: supplier
										? "Bring GridShare to your customers."
										: "A little more local. A lot more possibility."}
							</Modal.Heading>
						</Modal.Header>
						<Modal.Body>
							{request ? (
								<div className="gs-signup-result" role="status">
									<span className="gs-success-icon">
										<Check height={24} width={24} />
									</span>
									<p>
										Thanks, <strong>{request.name}</strong>. Here’s your demo{" "}
										{supplier ? "supplier enquiry" : "pilot request"}.
									</p>
									<dl>
										<div>
											<dt>Email</dt>
											<dd>{request.email}</dd>
										</div>
										{request.company && (
											<div>
												<dt>Organisation</dt>
												<dd>{request.company}</dd>
											</div>
										)}
										<div>
											<dt>Location</dt>
											<dd>Groningen, Netherlands</dd>
										</div>
									</dl>
									<p className="gs-demo-form-note">
										Preview only. This is not a submitted registration; your details remain in this page and disappear
										when you close it.
									</p>
									<Button
										className="gs-button gs-button-primary"
										onPress={() => {
											setRequest(null);
											onClose();
										}}>
										Back to exploring <ArrowRight height={15} width={15} />
									</Button>
								</div>
							) : (
								<>
									<p>
										{supplier
											? "Preview an enquiry about a white-label energy-sharing module, with settlement and customer relationships staying with you."
											: "Explore a pilot for homes and local businesses. Set your limits, choose your neighbours and see what a smarter energy day could look like."}
									</p>
									<form className="gs-signup-form" onSubmit={submit}>
										<TextField isRequired className="gs-text-field" name="name">
											<Label>Your name</Label>
											<Input autoComplete="name" placeholder="Alex de Vries" />
										</TextField>
										<TextField isRequired className="gs-text-field" name="email" type="email">
											<Label>Email address</Label>
											<Input autoComplete="email" placeholder="alex@example.com" />
										</TextField>
										{supplier && (
											<TextField isRequired className="gs-text-field" name="company">
												<Label>Energy supplier / organisation</Label>
												<Input autoComplete="organization" placeholder="Your organisation" />
											</TextField>
										)}
										<p className="gs-demo-form-note">
											<CircleInfo height={14} width={14} />
											This is a demo signup preview. No request is sent.
										</p>
										<Button className="gs-button gs-button-primary" type="submit">
											Preview my {supplier ? "enquiry" : "pilot request"} <ArrowRight height={15} width={15} />
										</Button>
									</form>
								</>
							)}
						</Modal.Body>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}

export function LandingPage() {
	const [preferences, setPreferences] = useState(initialPreferences);
	const [preferred, setPreferred] = useState<Set<string>>(() => new Set());
	const [autopilot, setAutopilot] = useState(false);
	const [optimized, setOptimized] = useState(false);
	const [dialog, setDialog] = useState<"pilot" | "supplier" | null>(null);
	const [mobileNav, setMobileNav] = useState(false);
	const hydrated = useSyncExternalStore(subscribeHydrated, browserSnapshot, serverSnapshot);
	const weather = useQuery({
		queryKey: ["gridshare-weather", snapshot.date],
		queryFn: ({signal}) => fetchWeather(signal),
		enabled: hydrated,
		staleTime: 600_000,
		retry: 1,
	});
	const location = useQuery({
		queryKey: ["gridshare-location"],
		queryFn: ({signal}) => fetchLocation(signal),
		enabled: hydrated,
		staleTime: 86_400_000,
		retry: 1,
	});
	const plan = planTrades(preferences, preferred);
	const feeder = feederProfile(plan.energy);
	const load = optimized ? feeder.values : baselineLoad;
	const peak = Math.max(...load);
	const canShare = preferences.supplier !== "vast";
	const active = autopilot && canShare;
	const weatherLive = Boolean(weather.data && !weather.isError);
	const weatherValues = weather.data?.hourly ?? snapshot.weather;
	const temperature = average(weatherValues.temperature_2m);
	const marketPrice = average(snapshot.prices.values);
	const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
		setPreferences((current) => ({...current, [key]: value}));
	const selectMode = (mode: TradeMode) =>
		setPreferences((current) => ({...current, mode, price: mode === "sell" ? 0.17 : 0.2}));
	const togglePreferred = (id: string) =>
		setPreferred((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	const jump = (id: string) => {
		document.getElementById(id)?.scrollIntoView({
			behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
			block: "start",
		});
		setMobileNav(false);
	};
	return (
		<div className="gridshare-page">
			<a className="gs-skip-link" href="#autopilot">
				Skip to autopilot demo
			</a>
			<header className="gs-header gs-container">
				<a aria-label="GridShare home" className="gs-logo-link" href="#home">
					<Brand />
				</a>
				<nav aria-label="Main navigation" className={mobileNav ? "gs-main-nav is-open" : "gs-main-nav"}>
					<Link href="#autopilot" onPress={() => setMobileNav(false)}>
						Autopilot
					</Link>
					<Link href="#energy-map" onPress={() => setMobileNav(false)}>
						Energy map
					</Link>
					<Link href="#grid-aware" onPress={() => setMobileNav(false)}>
						Grid-aware
					</Link>
					<Link href="#suppliers" onPress={() => setMobileNav(false)}>
						For energy suppliers
					</Link>
				</nav>
				<Button className="gs-button gs-button-primary gs-header-cta" onPress={() => setDialog("pilot")}>
					Join the pilot
				</Button>
				<Button
					isIconOnly
					aria-expanded={mobileNav}
					aria-label={mobileNav ? "Close navigation" : "Open navigation"}
					className="gs-mobile-menu"
					variant="tertiary"
					onPress={() => setMobileNav(!mobileNav)}>
					{mobileNav ? <Xmark height={21} width={21} /> : <Bars height={21} width={21} />}
				</Button>
			</header>
			<main className="gs-container" id="home">
				<section aria-labelledby="hero-title" className="gs-hero">
					<span className="gs-hero-badge">
						<i />
						Autopilot · offered through your energy supplier
					</span>
					<h1 id="hero-title">
						Set your limits.
						<br />
						Your energy trades itself.
					</h1>
					<p>
						Tell GridShare your price, your hours and how much to keep. AI finds buyers and sellers on your street and
						makes the deals for you, every day, inside your limits.
					</p>
					<div className="gs-hero-actions">
						<Button className="gs-button gs-button-primary" onPress={() => jump("autopilot")}>
							Set up autopilot
						</Button>
						<Button className="gs-button gs-button-soft" onPress={() => jump("energy-map")}>
							See who’s around you
						</Button>
					</div>
					<ol className="gs-steps">
						<li>
							<span>1</span>Set your range once
						</li>
						<li>
							<span>2</span>AI picks the deals
						</li>
						<li>
							<span>3</span>Your supplier settles them
						</li>
					</ol>
				</section>
				<section aria-labelledby="autopilot-title" className="gs-autopilot-section gs-section" id="autopilot">
					<div className="gs-section-heading">
						<span className="gs-eyebrow">01 · Autopilot</span>
						<h2 id="autopilot-title">Agree on a range. AI does the deals.</h2>
						<p>
							No tapping, no haggling. Move the limits and see which of tomorrow’s deals your AI would take, and why it
							skips the rest.
						</p>
					</div>
					<div className="gs-autopilot-grid">
						<Card className="gs-preferences">
							<div className="gs-preferences-body">
								<span className="gs-field-caption">I want to</span>
								<Tabs
									className="gs-mode-tabs"
									selectedKey={preferences.mode}
									onSelectionChange={(key) => {
										if (key === "sell" || key === "buy") selectMode(key);
									}}>
									<Tabs.ListContainer>
										<Tabs.List aria-label="Energy trading direction">
											<Tabs.Tab id="sell">
												Sell energy
												<Tabs.Indicator />
											</Tabs.Tab>
											<Tabs.Tab id="buy">
												Buy energy
												<Tabs.Indicator />
											</Tabs.Tab>
										</Tabs.List>
									</Tabs.ListContainer>
									<Tabs.Panel id="sell">
										<p className="gs-setup-description">You: 4 kWp rooftop solar and a 10 kWh home battery.</p>
									</Tabs.Panel>
									<Tabs.Panel id="buy">
										<p className="gs-setup-description">You: a flexible household with a 10 kWh home battery.</p>
									</Tabs.Panel>
								</Tabs>
								<div className="gs-ranges">
									<Range
										format={(value) => `${euro(value)} /kWh`}
										label={preferences.mode === "sell" ? "Sell for at least" : "Buy for at most"}
										max={0.3}
										min={0.05}
										step={0.01}
										value={preferences.price}
										onChange={(value) => update("price", value)}
									/>
									<Range
										format={(value) => `${value} kWh a day`}
										label={preferences.mode === "sell" ? "Sell up to" : "Buy up to"}
										max={15}
										min={0}
										step={0.5}
										value={preferences.dailyLimit}
										onChange={(value) => update("dailyLimit", value)}
									/>
									<Range
										format={(value) => `${value}%`}
										label="Keep in my battery"
										max={90}
										min={0}
										step={5}
										value={preferences.reserve}
										onChange={(value) => update("reserve", value)}
									/>
								</div>
								<div className="gs-setting-block">
									<span className="gs-field-label">Trading hours</span>
									<div aria-label="Trading hours" className="gs-segmented" role="group">
										{hours.map((item) => (
											<Button
												key={item.id}
												aria-pressed={preferences.hours === item.id}
												className={preferences.hours === item.id ? "is-selected" : ""}
												variant="tertiary"
												onPress={() => update("hours", item.id)}>
												{item.label}
											</Button>
										))}
									</div>
								</div>
								<div className="gs-setting-block">
									<span className="gs-field-label">Trade with</span>
									<div aria-label="Trading partner types" className="gs-peer-options" role="group">
										<Button
											aria-pressed={preferences.households}
											className={`gs-button gs-peer ${preferences.households ? "is-selected" : ""}`}
											size="sm"
											onPress={() => update("households", !preferences.households)}>
											Households
										</Button>
										<Button
											aria-pressed={preferences.businesses}
											className={`gs-button gs-peer ${preferences.businesses ? "is-selected" : ""}`}
											size="sm"
											onPress={() => update("businesses", !preferences.businesses)}>
											Local businesses
										</Button>
									</div>
								</div>
								<div className="gs-setting-block">
									<span className="gs-field-label">Your energy supplier</span>
									<div aria-label="Your energy supplier" className="gs-suppliers" role="group">
										{suppliers.map((item) => (
											<Button
												key={item.id}
												aria-pressed={preferences.supplier === item.id}
												className={`gs-supplier-option ${preferences.supplier === item.id ? "is-selected" : ""}`}
												variant="tertiary"
												onPress={() => update("supplier", item.id)}>
												<span>{item.label}</span>
												<span className={item.sharing ? "gs-sharing-label" : "gs-no-sharing-label"}>
													{item.sharing ? "Sharing ✓" : "No sharing"}
												</span>
											</Button>
										))}
									</div>
								</div>
							</div>
							<div className="gs-autopilot-toggle">
								<div>
									<strong>Autopilot</strong>
									<span>
										{!canShare
											? "Choose a sharing supplier"
											: active
												? "On · running a simulation"
												: "Off · showing a preview"}
									</span>
								</div>
								<Switch
									aria-label="Run autopilot simulation"
									className="gs-switch"
									isDisabled={!canShare}
									isSelected={active}
									onChange={(value) => {
										setAutopilot(value);
										setOptimized(value);
									}}>
									<Switch.Content>
										<Switch.Control>
											<Switch.Thumb />
										</Switch.Control>
									</Switch.Content>
								</Switch>
							</div>
						</Card>
						<Card className="gs-deals-card">
							<div className="gs-deals-heading">
								<div>
									<h3>Deals your AI would make tomorrow</h3>
									<p>Tomorrow · Oosterpoort, Groningen</p>
								</div>
								<span className={`gs-preview-label ${active ? "is-running" : ""}`}>
									{active ? "Simulation on" : "Preview"}
								</span>
							</div>
							<div aria-live="polite" className="gs-deal-metrics">
								<div>
									<span>Deals</span>
									<strong>{plan.accepted.length}</strong>
								</div>
								<div>
									<span>Energy traded</span>
									<strong>
										{plan.energy.toFixed(1)}
										<small> kWh</small>
									</strong>
								</div>
								<div>
									<span>{preferences.mode === "sell" ? "Extra vs feed-in" : "Saved vs grid rate"}</span>
									<strong>{euro(plan.extra)}</strong>
								</div>
								<div>
									<span>Grid peak*</span>
									<strong>
										{feeder.reduction > 0 ? "−" : ""}
										{Math.round(feeder.reduction * 100)}
										<small> %</small>
									</strong>
								</div>
							</div>
							<div aria-label="Simulated trade decisions" aria-live="polite" className="gs-deal-list">
								{plan.decisions.map((decision) => (
									<div
										key={decision.neighbour.id}
										className={`gs-deal-row ${decision.quantity > 0 ? "is-accepted" : "is-skipped"} ${preferred.has(decision.neighbour.id) ? "is-preferred" : ""}`}>
										<time>{decision.neighbour.time}</time>
										<div>
											<strong>
												{decision.neighbour.name}
												{preferred.has(decision.neighbour.id) && (
													<span aria-label="Preferred neighbour" className="gs-deal-favourite">
														★
													</span>
												)}
											</strong>
											<span>
												{(decision.quantity || decision.neighbour.quantity).toFixed(1)} kWh ·{" "}
												{euro(decision.neighbour.price)}/kWh
												{decision.neighbour.battery
													? preferences.mode === "sell"
														? " · from your battery"
														: " · into your battery"
													: ""}
											</span>
										</div>
										<span className="gs-decision-badge">
											{decision.reason === "Partly"
												? `Partly · ${decision.quantity.toFixed(1)} of ${decision.neighbour.quantity.toFixed(1)}`
												: decision.reason}
										</span>
									</div>
								))}
							</div>
							<div className="gs-deals-note">
								{!canShare ? (
									<p>
										<strong>This supplier does not support sharing.</strong> Choose Noordstroom or Polder Energie to
										explore the autopilot preview.
									</p>
								) : (
									<p>
										{preferences.mode === "sell"
											? `${plan.surplus.toFixed(1)} kWh of midday surplus goes to your supplier at the feed-in tariff. `
											: "Autopilot chooses local offers below your maximum price. "}
										It plans for the next day, inside your limits, and you can pause the simulation any time.
									</p>
								)}
								<details>
									<summary>
										Preview assumptions <CircleInfo height={12} width={12} />
									</summary>
									<p>
										Fictional offers, a 6 kWh daytime budget and a full 10 kWh battery before evening, protected by your
										reserve. Comparison tariffs: €0.06/kWh feed-in and €0.30/kWh import. *Grid peak is an illustrative
										feeder scenario, not a measured effect or guaranteed saving.
									</p>
								</details>
							</div>
						</Card>
					</div>
				</section>
				<section aria-labelledby="map-title" className="gs-section gs-map-section" id="energy-map">
					<div className="gs-split-heading">
						<div>
							<span className="gs-eyebrow">02 · Interactive energy map</span>
							<h2 id="map-title">
								See who your autopilot trades
								<br className="gs-desktop-break" /> with.
							</h2>
						</div>
						<p>
							Solar, batteries, EVs and businesses around you. Mark neighbours you prefer; autopilot favours them when
							the deal fits your limits.
						</p>
					</div>
					<EnergyMap mode={preferences.mode} preferred={preferred} onPrefer={togglePreferred} />
				</section>
				<section aria-labelledby="beyond-title" className="gs-section gs-beyond">
					<div>
						<span className="gs-eyebrow">03 · Beyond solar</span>
						<h2 id="beyond-title">Everything that makes, stores or uses energy.</h2>
						<p>
							Autopilot trades solar surplus, rents out battery space, and times EV charging and heat pumps, for homes
							and local businesses alike.
						</p>
					</div>
					<div className="gs-feature-grid">
						{features.map((feature) => (
							<Card key={feature.asset} className="gs-feature-card">
								<span className={`gs-asset-icon gs-asset-${feature.asset}`}>
									<AssetIcon asset={feature.asset} size={21} />
								</span>
								<h3>{feature.title}</h3>
								<p>{feature.text}</p>
							</Card>
						))}
					</div>
				</section>
				<section aria-labelledby="grid-title" className="gs-section gs-grid-aware" id="grid-aware">
					<Card className="gs-feeder-card">
						<div className="gs-feeder-heading">
							<div>
								<h3>East feeder · Oosterpoort</h3>
								<p>Load as % of capacity, tomorrow</p>
							</div>
							<div aria-label="Compare feeder load" className="gs-segmented" role="group">
								<Button
									aria-pressed={!optimized}
									className={!optimized ? "is-selected" : ""}
									variant="tertiary"
									onPress={() => setOptimized(false)}>
									Without autopilot
								</Button>
								<Button
									aria-pressed={optimized}
									className={optimized ? "is-selected" : ""}
									variant="tertiary"
									onPress={() => setOptimized(true)}>
									With autopilot
								</Button>
							</div>
						</div>
						<div
							aria-label={`Simulated feeder load: peak ${peak.toFixed(1)}% of capacity, ${load.filter((value) => value > 85).length} hours above the illustrative limit`}
							className="gs-feeder-chart"
							role="img">
							<div className="gs-capacity-line">
								<span>Capacity limit</span>
							</div>
							<div className="gs-feeder-bars">
								{hourSlots.map(({hour, id}) => (
									<div
										key={id}
										className={load[hour] > 85 ? "over-limit" : load[hour] >= 80 ? "near-limit" : ""}
										style={{height: `${load[hour]}%`}}
										title={`${id} · ${load[hour].toFixed(1)}%`}
									/>
								))}
							</div>
						</div>
						<div className="gs-chart-hours">
							<span>00:00</span>
							<span>06:00</span>
							<span>12:00</span>
							<span>18:00</span>
							<span>23:00</span>
						</div>
						<div aria-live="polite" className="gs-feeder-stats">
							<span>
								Peak <strong>{peak.toFixed(peak % 1 ? 1 : 0)}%</strong> of capacity
							</span>
							<span>
								Hours over the limit <strong>{load.filter((value) => value > 85).length}</strong>
							</span>
							<span className="gs-simulated-tag">Simulated</span>
						</div>
					</Card>
					<div className="gs-grid-copy">
						<span className="gs-eyebrow">04 · Grid-aware</span>
						<h2 id="grid-title">Deals that respect the grid.</h2>
						<p>
							Autopilot sees when your feeder is busy and moves charging and selling to quieter, sunnier hours, without
							breaking your limits.
						</p>
						<p className="gs-fine-copy">
							Physically, every kWh still flows through the public grid. GridShare matches agreements, settled with
							smart-meter data, only inside the same grid area and with a supplier that supports sharing.
						</p>
						<p className="gs-prototype-note">
							This chart illustrates the concept. Live feeder loading and grid capacity are not connected to this
							prototype.
						</p>
					</div>
				</section>
				<section aria-labelledby="suppliers-title" className="gs-section gs-supplier-section" id="suppliers">
					<span className="gs-eyebrow">For energy suppliers</span>
					<div className="gs-supplier-intro">
						<div>
							<h2 id="suppliers-title">
								Offer autopilot energy sharing
								<br className="gs-desktop-break" /> under your own brand.
							</h2>
							<p>
								GridShare plugs into your app and billing. Your customers set their limits, our AI makes the local
								deals, and settlement stays with you.
							</p>
						</div>
						<Button className="gs-button gs-button-primary" onPress={() => setDialog("supplier")}>
							Talk to us
						</Button>
					</div>
					<div className="gs-supplier-benefits">
						<Card>
							<h3>Keep customers longer</h3>
							<p>A feature that pays your customers back every day, inside your app.</p>
						</Card>
						<Card>
							<h3>Balance locally</h3>
							<p>
								Forecasts for every connected roof, battery and EV help you plan your portfolio and limit imbalance.
							</p>
						</Card>
						<Card>
							<h3>Unlock flexibility</h3>
							<p>Lower peaks on busy feeders can be offered to grid operators as congestion relief.</p>
						</Card>
					</div>
					<div className="gs-supplier-pills">
						<span>White-label module for your app</span>
						<span>Settlement and billing stay with you</span>
						<span>Priced per active customer</span>
					</div>
				</section>
				<section aria-labelledby="data-title" className="gs-section gs-honest-data" id="data-sources">
					<span className="gs-eyebrow">HONEST DATA</span>
					<h2 id="data-title">Always clear what’s real and what’s simulated.</h2>
					<div className="gs-data-grid">
						<div>
							<h3>
								<i className={weatherLive ? "gs-dot-live" : "gs-dot-recorded"} />
								{weatherLive ? "Live" : weather.isFetching ? "Connecting" : "Recorded fallback"}
							</h3>
							<p>
								Groningen weather, cloud cover and solar radiation from{" "}
								<a href="https://open-meteo.com/" rel="noreferrer" target="_blank">
									Open-Meteo
								</a>
								. Location lookup through{" "}
								<a href="https://www.pdok.nl/pdok-locatieserver" rel="noreferrer" target="_blank">
									PDOK Locatieserver
								</a>
								.
							</p>
							<span className="gs-data-detail">
								{temperature === null ? "Weather unavailable" : `${temperature.toFixed(1)}°C day average`} ·{" "}
								{formatDate(`${snapshot.date}T12:00:00Z`)}
								<br />
								PDOK:{" "}
								{location.data
									? "live lookup verified"
									: location.isFetching
										? "connecting"
										: "bundled Groningen location"}
							</span>
						</div>
						<div>
							<h3>
								<i className="gs-dot-recorded" />
								Recorded snapshot
							</h3>
							<p>
								Dutch electricity prices, demand and generation mix from{" "}
								<a href="https://api.energy-charts.info/" rel="noreferrer" target="_blank">
									Energy-Charts
								</a>
								, dated. Market context is separate from the fictional neighbour offers.
							</p>
							<span className="gs-data-detail">
								{formatDate(snapshot.retrievedAt)}
								{marketPrice === null ? "" : ` · ${(marketPrice / 10).toFixed(1)} ct/kWh daily average`}
							</span>
						</div>
						<div>
							<h3>
								<i className="gs-dot-estimated" />
								Estimated
							</h3>
							<p>
								Solar output per roof can be estimated from radiation and panel size. The trade preview currently uses
								the stated illustrative energy budgets.
							</p>
							<a className="gs-data-detail" href="#autopilot">
								Explore the assumptions <ArrowUpRight height={11} width={11} />
							</a>
						</div>
						<div>
							<h3>
								<i className="gs-dot-simulated" />
								Simulated
							</h3>
							<p>
								Neighbours, deals, business demand, battery behaviour and feeder load. Grid capacity data is not yet
								integrated.
							</p>
							<a
								className="gs-data-detail"
								href="https://capaciteitskaart.netbeheernederland.nl/"
								rel="noreferrer"
								target="_blank">
								Official capacity map <ArrowUpRight height={11} width={11} />
							</a>
						</div>
					</div>
				</section>
				<section aria-labelledby="closing-title" className="gs-closing">
					<h2 id="closing-title">
						Set it once. Share energy every
						<br className="gs-desktop-break" /> day.
					</h2>
					<p>Join the Groningen pilot, or bring GridShare to your customers.</p>
					<div className="gs-hero-actions">
						<Button className="gs-button gs-button-primary" onPress={() => setDialog("pilot")}>
							Join the pilot
						</Button>
						<Button className="gs-button gs-button-soft" onPress={() => setDialog("supplier")}>
							I’m an energy supplier
						</Button>
					</div>
				</section>
			</main>
			<footer className="gs-footer gs-container">
				<a aria-label="GridShare home" href="#home">
					<Brand small />
				</a>
				<p>
					Proof of concept. Neighbours, businesses, suppliers and offers are fictional. The “AI” is a simplified rule
					set that stands in for real forecasting and optimisation models. Real source data is labelled separately.
				</p>
			</footer>
			<SignupDialog kind={dialog} onClose={() => setDialog(null)} />
		</div>
	);
}
