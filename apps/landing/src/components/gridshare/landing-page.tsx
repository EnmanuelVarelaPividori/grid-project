import {ArrowRight, ArrowUpRight, Check, CircleInfo, Xmark} from "@gravity-ui/icons";
import {Button, Input, Label, Modal, TextField} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {useState, useSyncExternalStore} from "react";
import type {FormEvent} from "react";
import {dayFeed, predictSavings, profiles, suppliers} from "@/lib/autopilot";
import type {Asset, CustomerType, SupplierId} from "@/lib/autopilot";
import {average, fetchLocation, fetchWeather, snapshot} from "@/lib/energy-data";
import {DotField} from "./dot-field";
import {EnergyMap} from "./energy-map";
import {Brand, CheckIcon, KindIcon} from "./icons";
import {StreetChart} from "./street-chart";

const subscribeHydrated = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;
const money = (value: number) => Math.round(value).toLocaleString("en-GB");
const formatDate = (value: string) =>
	new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Europe/Amsterdam",
	}).format(new Date(value));
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const flattenSteps = [
	["EVs charge at night or in the sun,", "not when everyone gets home."],
	["Heat pumps pre-heat in the afternoon,", "so homes are warm without running at 18:00."],
	["Businesses pre-cool and run batches early,", "before homes wake up or after shops close."],
	["Batteries fill with midday sun", "and cover the dinner peak."],
	["Everyone shares the savings,", "so nobody is worse off for moving."],
];
const features: {asset: Asset; title: string; text: string}[] = [
	{asset: "solar", title: "Solar", text: "Shared above feed-in"},
	{asset: "battery", title: "Batteries", text: "Store midday, cover dinner time"},
	{asset: "ev", title: "EV charging", text: "Charges when the grid is quiet"},
	{asset: "flex", title: "Flexible use", text: "Heat pumps and cold rooms shift"},
];
const supplierBenefits = [
	["Keep customers longer", "A feature that pays your customers back every day, inside your app."],
	[
		"Turn feed-in losses into value",
		"Surplus solar goes into batteries, EVs and neighbours instead of the market at negative prices.",
	],
	["Unlock flexibility", "Flatter streets can be offered to grid operators as congestion relief."],
];

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
	const close = () => {
		setRequest(null);
		onClose();
	};
	return (
		<Modal
			isOpen={kind !== null}
			onOpenChange={(open) => {
				if (!open) close();
			}}>
			<Modal.Backdrop className="gs-modal-backdrop">
				<Modal.Container className="gs-modal-container" placement="center" size="md">
					<Modal.Dialog className="gs-modal">
						<Modal.CloseTrigger aria-label="Close dialog" className="gs-modal-close">
							<Xmark height={18} width={18} />
						</Modal.CloseTrigger>
						<Brand />
						<Modal.Header>
							<span className="gs-eyebrow">The Groningen pilot</span>
							<Modal.Heading className="gs-display">
								{request
									? "A first step towards a flatter street."
									: supplier
										? "Offer Autopilot to your customers."
										: "Say yes once. We run your energy."}
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
									<Button className="gs-btn gs-btn-primary gs-btn-lg" onPress={close}>
										Back to exploring <ArrowRight height={15} width={15} />
									</Button>
								</div>
							) : (
								<>
									<p>
										{supplier
											? "Preview an enquiry about offering Autopilot in your app. GridShare manages devices and local sharing; settlement and customer relationships stay with you."
											: "Join as a home or business in Oosterpoort. Connect your meter and devices once, and Autopilot keeps your street flat while you save."}
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
										<Button className="gs-btn gs-btn-primary gs-btn-lg" type="submit">
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

function AutopilotDemo() {
	const [type, setType] = useState<CustomerType>("home");
	const [supplier, setSupplier] = useState<SupplierId>("vattenfall");
	const [use, setUse] = useState(profiles.home.defaults.use);
	const [price, setPrice] = useState(profiles.home.defaults.price);
	const profile = profiles[type];
	const feed = dayFeed(type);
	// No Dutch supplier offers energy sharing yet: the prediction counts steering only and shows sharing as an outline.
	const prediction = predictSavings(type, false, Number(use), Number(price));
	const pickType = (next: CustomerType) => {
		setType(next);
		setUse(profiles[next].defaults.use);
		setPrice(profiles[next].defaults.price);
	};
	return (
		<div className="gs-autopilot-grid">
			<div className="gs-card gs-setup">
				<div aria-label="I’m a" className="gs-segment gs-segment-fill" role="group">
					<button aria-pressed={type === "home"} className="gs-btn" type="button" onClick={() => pickType("home")}>
						Household
					</button>
					<button aria-pressed={type === "biz"} className="gs-btn" type="button" onClick={() => pickType("biz")}>
						Business
					</button>
				</div>
				<div>
					<p className="gs-field-caption">{profile.assetsLabel}</p>
					<div className="gs-assets">
						{profile.assets.map(([asset, label]) => (
							<span key={label} className="gs-asset-chip">
								<span className={`gs-kind gs-kind-${asset}`}>
									<KindIcon kind={asset} size={11} />
								</span>
								{label}
							</span>
						))}
					</div>
				</div>
				<div>
					<div className="gs-field-pair">
						<div>
							<label className="gs-field-label" htmlFor="ap-use">
								Yearly use
							</label>
							<span className="gs-field">
								<input
									id="ap-use"
									inputMode="numeric"
									min="0"
									step="100"
									type="number"
									value={use}
									onChange={(event) => setUse(event.target.value)}
								/>
								<span>kWh</span>
							</span>
						</div>
						<div>
							<label className="gs-field-label" htmlFor="ap-price">
								You pay
							</label>
							<span className="gs-field">
								<span>€</span>
								<input
									id="ap-price"
									inputMode="decimal"
									min="0"
									step="0.01"
									type="number"
									value={price}
									onChange={(event) => setPrice(event.target.value)}
								/>
								<span className="gs-nowrap">/kWh</span>
							</span>
						</div>
					</div>
					<p className="gs-hint">{profile.hint}</p>
				</div>
				<div>
					<label className="gs-field-label" htmlFor="ap-supplier">
						Energy supplier
					</label>
					<div className="gs-select-wrap">
						<select
							className="gs-select"
							id="ap-supplier"
							value={supplier}
							onChange={(event) => setSupplier(event.target.value as SupplierId)}>
							{(Object.keys(suppliers) as SupplierId[]).map((id) => (
								<option key={id} value={id}>
									{suppliers[id]}
								</option>
							))}
						</select>
						<svg
							aria-hidden="true"
							fill="none"
							height="12"
							stroke="currentColor"
							strokeLinecap="round"
							strokeWidth="2.5"
							viewBox="0 0 24 24"
							width="12">
							<path d="m6 9 6 6 6-6" />
						</svg>
					</div>
					<p className="gs-hint">
						Works alongside {supplier === "other" ? "your supplier" : suppliers[supplier]}: your contract and bill stay
						the same.
					</p>
				</div>
				<ul className="gs-promises">
					{profile.promises.map((promise) => (
						<li key={promise}>
							<CheckIcon size={14} />
							<span>{promise}</span>
						</li>
					))}
				</ul>
			</div>

			<div className="gs-card gs-feed-card">
				<div aria-live="polite" className="gs-prediction">
					<div className="gs-prediction-copy">
						<div className="gs-prediction-top">
							<p className="gs-prediction-label">Predicted savings · next 12 months</p>
							<span className="gs-status">Autopilot on</span>
						</div>
						<p className="gs-display gs-num gs-prediction-total">€{money(prediction.total)}</p>
						<p className="gs-num gs-prediction-range">
							≈ €{money(prediction.monthly)}/month · about {prediction.percentOfBill}% of your €{money(prediction.bill)}{" "}
							bill
						</p>
						<div className="gs-prediction-legend">
							<span>
								<i className="gs-legend-steer" />
								Steering €{money(prediction.steer)}
							</span>
							<span>
								<i className="gs-legend-share" />
								Sharing, once it opens +€{money(prediction.share)}
							</span>
						</div>
					</div>
					<div className="gs-prediction-chart">
						<div aria-hidden="true" className="gs-month-bars">
							{prediction.bars.map((bar) => (
								<div key={bar.month}>
									<span className="gs-bar-ghost" style={{height: percent(bar.ghost)}} />
									<span className="gs-bar-share" style={{height: percent(bar.share)}} />
									<span className="gs-bar-steer" style={{height: percent(bar.steer)}} />
								</div>
							))}
						</div>
						<div aria-hidden="true" className="gs-month-labels">
							{prediction.bars.map((bar) => (
								<span key={bar.month}>{bar.month[0]}</span>
							))}
						</div>
					</div>
				</div>
				<div className="gs-feed-heading">
					<p>
						Yesterday on Autopilot <span>· {profile.feedName} · Oosterpoort, Groningen · simulated</span>
					</p>
					<p className="gs-num">
						<b>+€{feed.money.toFixed(2)}</b> · peak use −{profile.peak}%
					</p>
				</div>
				<ul aria-label="Autopilot actions yesterday" className="gs-feed">
					{feed.items.map((item) => (
						<li key={`${type}-${item.time}`}>
							<span className="gs-num gs-feed-time">{item.time}</span>
							<span className={`gs-feed-icon gs-kind gs-kind-${item.kind}`}>
								<KindIcon kind={item.kind} size={13} />
							</span>
							<span className="gs-feed-body">
								<span className="gs-feed-title">{item.title}</span>
								<span className="gs-num gs-feed-detail">{item.detail}</span>
							</span>
							<span className="gs-feed-value">
								<span className="gs-display gs-num">{item.save > 0 ? `+€${item.save.toFixed(2)}` : ""}</span>
								<span className="gs-feed-tag">{item.tag}</span>
							</span>
						</li>
					))}
					<li key={`${type}-soon`} className="is-soon">
						<span className="gs-num gs-feed-time">Soon</span>
						<span className="gs-feed-icon gs-kind gs-kind-blocked">
							<KindIcon kind="share" size={13} />
						</span>
						<span className="gs-feed-body">
							<span className="gs-feed-title">Sharing with neighbours</span>
							<span className="gs-feed-detail">Starts once Dutch suppliers offer energy sharing</span>
						</span>
						<span className="gs-feed-value">
							<span className="gs-display gs-num">+€{feed.potential.toFixed(2)}</span>
							<span className="gs-feed-tag">potential</span>
						</span>
					</li>
				</ul>
			</div>
		</div>
	);
}

export function LandingPage() {
	const [dialog, setDialog] = useState<"pilot" | "supplier" | null>(null);
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
	const weatherLive = Boolean(weather.data && !weather.isError);
	const temperature = average((weather.data?.hourly ?? snapshot.weather).temperature_2m);
	const marketPrice = average(snapshot.prices.values);

	return (
		<div className="gridshare-page">
			<DotField />
			<a className="gs-skip-link" href="#autopilot">
				Skip to the Autopilot demo
			</a>
			<div className="gs-container">
				<header className="gs-header">
					<a aria-label="GridShare home" className="gs-logo-link" href="#home">
						<Brand />
					</a>
					<nav aria-label="Main navigation" className="gs-nav">
						<a href="#autopilot">Autopilot</a>
						<a href="#map">Energy map</a>
						<a href="#grid">Flat grid</a>
						<a href="#suppliers">For energy suppliers</a>
					</nav>
					<Button className="gs-btn gs-btn-primary gs-header-cta" onPress={() => setDialog("pilot")}>
						Join the pilot
					</Button>
				</header>

				<main id="home">
					<section aria-labelledby="hero-title" className="gs-hero">
						<p className="gs-badge">
							<span className="gs-live-dot" />
							Autopilot · works with your energy supplier
						</p>
						<h1 className="gs-display" id="hero-title">
							Turn it on once.
							<br />
							We run your energy.
						</h1>
						<p className="gs-hero-lede">
							Say yes to Autopilot and GridShare manages your solar, battery, EV and heat pump together with your
							neighbours: cheaper for you, calmer for the grid. You never end up worse off.
						</p>
						<div className="gs-actions">
							<a className="gs-btn gs-btn-primary gs-btn-lg" href="#autopilot">
								Turn on Autopilot
							</a>
							<a className="gs-btn gs-btn-soft gs-btn-lg" href="#grid">
								See how it flattens the grid
							</a>
						</div>
						<ol className="gs-steps">
							<li>
								<span className="gs-display">1</span>Connect your meter and devices
							</li>
							<li>
								<span className="gs-display">2</span>Autopilot starts on its own
							</li>
							<li>
								<span className="gs-display">3</span>We manage it, you save
							</li>
						</ol>
					</section>

					<section aria-labelledby="autopilot-title" className="gs-section gs-section-tight" id="autopilot">
						<div className="gs-autopilot-heading">
							<div>
								<p className="gs-eyebrow gs-display">01 · Autopilot</p>
								<h2 className="gs-display" id="autopilot-title">
									One yes. We handle the rest.
								</h2>
							</div>
							<p>
								On from day one. We plan every device on your street together, so the grid stays calm and you pay less.
							</p>
						</div>
						<AutopilotDemo />
					</section>

					<section aria-labelledby="grid-title" className="gs-section gs-split" id="grid">
						<div className="gs-split-copy">
							<p className="gs-eyebrow gs-display">02 · Households + businesses</p>
							<h2 className="gs-display" id="grid-title">
								Don’t all use power at once.
							</h2>
							<p className="gs-lede gs-lede-narrow">
								Businesses run during the day, homes peak at breakfast and dinner. Around 17:00 they overlap and the
								street hits its limit. Because Autopilot manages both, it spreads the flexible part so the line stays
								flat.
							</p>
							<ol className="gs-numbered">
								{flattenSteps.map(([lead, rest], index) => (
									<li key={lead}>
										<span className="gs-display">{index + 1}</span>
										<span>
											<b>{lead}</b> {rest}
										</span>
									</li>
								))}
							</ol>
						</div>
						<StreetChart />
					</section>

					<section aria-labelledby="map-title" className="gs-section" id="map">
						<div className="gs-map-heading">
							<div>
								<p className="gs-eyebrow gs-display">03 · Interactive energy map</p>
								<h2 className="gs-display" id="map-title">
									See who’s on your street.
								</h2>
							</div>
							<p>
								Solar, batteries, EVs and businesses around you. Autopilot works with all of them inside your grid area;
								you don’t have to pick.
							</p>
						</div>
						<EnergyMap />
					</section>

					<section aria-labelledby="beyond-title" className="gs-section gs-split gs-beyond">
						<div className="gs-split-copy">
							<p className="gs-eyebrow gs-display">04 · Beyond solar</p>
							<h2 className="gs-display gs-h3" id="beyond-title">
								Everything that makes, stores or uses energy.
							</h2>
							<p className="gs-lede gs-lede-narrow">
								Autopilot shares solar surplus, uses battery space, and times EV charging and heat pumps, for homes and
								local businesses alike.
							</p>
						</div>
						<div className="gs-feature-grid">
							{features.map((feature) => (
								<div key={feature.asset} className="gs-card gs-feature">
									<span className={`gs-kind gs-kind-${feature.asset}`}>
										<KindIcon kind={feature.asset} size={20} />
									</span>
									<h3>{feature.title}</h3>
									<p>{feature.text}</p>
								</div>
							))}
						</div>
					</section>

					<section aria-labelledby="suppliers-title" className="gs-section" id="suppliers">
						<div className="gs-suppliers">
							<div className="gs-suppliers-intro">
								<div>
									<p className="gs-eyebrow gs-display">For energy suppliers</p>
									<h2 className="gs-display" id="suppliers-title">
										Offer Autopilot to your customers.
									</h2>
									<p className="gs-lede">
										Your customers say yes once; GridShare manages their devices and local sharing, and settlement stays
										with you. Midday solar you’d otherwise take back at a loss gets used where it’s worth more.
									</p>
								</div>
								<Button className="gs-btn gs-btn-primary gs-btn-md" onPress={() => setDialog("supplier")}>
									Talk to us
								</Button>
							</div>
							<div className="gs-benefits">
								{supplierBenefits.map(([title, text]) => (
									<div key={title}>
										<h3 className="gs-display">{title}</h3>
										<p>{text}</p>
									</div>
								))}
							</div>
						</div>
					</section>

					<section aria-labelledby="data-title" className="gs-section gs-section-tight" id="data-sources">
						<div className="gs-honest">
							<p className="gs-honest-eyebrow">Honest data</p>
							<h2 className="gs-display" id="data-title">
								Always clear what’s real and what’s simulated.
							</h2>
							<div className="gs-honest-grid">
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
									<span className="gs-honest-detail">
										{temperature === null ? "Weather unavailable" : `${temperature.toFixed(1)} °C day average`} ·{" "}
										{formatDate(`${snapshot.date}T12:00:00Z`)} · PDOK{" "}
										{location.data ? "verified" : location.isFetching ? "connecting" : "bundled location"}
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
										, dated.
									</p>
									<span className="gs-honest-detail">
										{formatDate(snapshot.retrievedAt)}
										{marketPrice === null ? "" : ` · ${(marketPrice / 10).toFixed(1)} ct/kWh daily average`}
									</span>
								</div>
								<div>
									<h3>
										<i className="gs-dot-estimated" />
										Estimated
									</h3>
									<p>Solar output per roof, calculated from radiation and panel size.</p>
								</div>
								<div>
									<h3>
										<i className="gs-dot-simulated" />
										Simulated
									</h3>
									<p>
										Neighbours, Autopilot actions, street load and savings. Grid capacity data is not yet integrated.
									</p>
									<a
										className="gs-honest-detail"
										href="https://capaciteitskaart.netbeheernederland.nl/"
										rel="noreferrer"
										target="_blank">
										Official capacity map <ArrowUpRight height={11} width={11} />
									</a>
								</div>
							</div>
						</div>
					</section>

					<section aria-labelledby="join-title" className="gs-closing" id="join">
						<h2 className="gs-display" id="join-title">
							Say yes once. Keep the street flat.
						</h2>
						<p>Join the Groningen pilot as a home or business, or bring GridShare to your customers.</p>
						<div className="gs-actions">
							<Button className="gs-btn gs-btn-primary gs-btn-lg" onPress={() => setDialog("pilot")}>
								Join the pilot
							</Button>
							<Button className="gs-btn gs-btn-soft gs-btn-lg" onPress={() => setDialog("supplier")}>
								I’m an energy supplier
							</Button>
						</div>
					</section>
				</main>

				<footer className="gs-footer">
					<Brand small />
					<p>
						Proof of concept. Neighbours, businesses, prices and savings shown here are fictional. Supplier names are
						listed for illustration only; GridShare is not affiliated with them. The “AI” is a simplified rule set that
						stands in for real forecasting and optimisation models.
					</p>
				</footer>
			</div>
			<SignupDialog kind={dialog} onClose={() => setDialog(null)} />
		</div>
	);
}
