import {ArrowUpRight, Check, CircleHelp, Clock3, Leaf, ShieldCheck, Sparkles, Unplug, Wallet} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {Icon} from "./components/brand.jsx";
import {Drawer} from "./components/controls.jsx";
import {CostChart} from "./components/cost-chart.jsx";
import {EnergyChart} from "./components/energy-chart.jsx";
import {GroningenMap} from "./components/energy-map.jsx";
import {Badge} from "./components/ui/badge";
import {Button} from "./components/ui/button";
import {Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter} from "./components/ui/card";
import {SidebarProvider, SidebarTrigger} from "./components/ui/sidebar";
import {WorkspaceSidebar} from "./components/workspace-sidebar.jsx";
import {autopilotPlan} from "./lib/autopilot-plan.js";

const DAY = "2026-11-12";
const PAGES = {dashboard: "Overview", activity: "Activity", explore: "Energy network", myspace: "Your setup"};
const euro = (value) => new Intl.NumberFormat("en-GB", {style: "currency", currency: "EUR"}).format(value);
const number = (value) => new Intl.NumberFormat("en-GB", {maximumFractionDigits: 1}).format(value);
async function read(path, signal) {
	const response = await fetch(path, {signal});
	if (!response.ok) throw Error("We couldn’t load your energy overview. Please try again.");
	return response.json();
}
function Panel({title, description, action, className = "", children, footer}) {
	return (
		<Card className={`overview-panel ${className}`}>
			<CardHeader>
				<div>
					<CardTitle>{title}</CardTitle>
					{description && <CardDescription>{description}</CardDescription>}
				</div>
				{action}
			</CardHeader>
			<CardContent>{children}</CardContent>
			{footer && <CardFooter>{footer}</CardFooter>}
		</Card>
	);
}
function ActivityFeed({plan, onSelect, compact = false}) {
	const items = compact
		? ["solar", "battery", "demand"].map((kind) => plan.find((item) => item.kind === kind)).filter(Boolean)
		: plan;
	if (!items.length)
		return <p className="quiet empty-copy">Your daily plan is being prepared. Check back in a moment.</p>;
	return (
		<div className="autopilot-feed">
			{items.map((item) => (
				<button key={item.id} className="autopilot-action" onClick={() => onSelect(item)}>
					<span className="action-symbol">
						<Icon name={item.kind} size={18} />
					</span>
					<span className="action-copy">
						<strong>
							{item.kind === "solar"
								? "Put local solar to work"
								: item.kind === "battery"
									? "Store energy for the busy hours"
									: item.kind === "demand"
										? "Move charging to quieter hours"
										: "Keep the neighbourhood in balance"}
						</strong>
						<small>
							{item.listing_name} → {item.partner}
						</small>
						<span>
							{item.window} · {number(item.quantity)} {item.unit}
						</span>
					</span>
					<span className="action-benefit">
						<strong>{euro(item.estimated_savings_eur)}</strong>
						<small>estimated benefit</small>
						<Badge variant="secondary">{item.review ? "Supplier review" : "Planned"}</Badge>
					</span>
					<ArrowUpRight size={15} />
				</button>
			))}
		</div>
	);
}
export default function App() {
	const [page, setPage] = useState("dashboard");
	const [data, setData] = useState({profile: null, listings: [], requests: []});
	const [forecast, setForecast] = useState(null);
	const [matches, setMatches] = useState([]);
	const [error, setError] = useState("");
	const [reload, setReload] = useState(0);
	const [selected, setSelected] = useState("solar-1");
	const [filter, setFilter] = useState("all");
	const [search, setSearch] = useState("");
	const [drawer, setDrawer] = useState("");
	const [dealsOpen, setDealsOpen] = useState(false);
	const [detail, setDetail] = useState(null);
	useEffect(() => {
		const controller = new AbortController();
		Promise.all([
			read("/api/bootstrap", controller.signal),
			read(`/api/forecast?date=${DAY}&mode=gridshare_ai`, controller.signal),
			read(`/api/matches?date=${DAY}`, controller.signal),
		])
			.then(([bootstrap, prediction, suggestions]) => {
				setData(bootstrap);
				setForecast(prediction);
				setMatches(suggestions.matches);
			})
			.catch((err) => {
				if (err.name !== "AbortError")
					setError("We couldn’t load your energy overview. Check the local connection and try again.");
			});
		return () => controller.abort();
	}, [reload]);
	const plan = useMemo(() => autopilotPlan(matches, data.listings, DAY), [matches, data.listings]);
	// Keep actual saved drafts separate from generated previews; neither is a settled transaction.
	const mapDeals = data.requests.length ? data.requests : plan;
	const chosen = data.listings.find((item) => item.id === selected);
	const profile = data.profile;
	const navigate = (next) => {
		setPage(next);
		window.scrollTo({top: 0, behavior: "instant"});
	};
	const inspect = (item) => {
		setDetail(item);
		setDrawer("activity");
	};
	const showOnMap = (item) => {
		setSelected(item.listing_id);
		setDrawer("");
		navigate("explore");
	};
	const map = (compact) => (
		<GroningenMap
			compact={compact}
			congestion={false}
			dealsOpen={dealsOpen}
			dealsTitle={data.requests.length ? "Saved drafts" : "Autopilot deals"}
			filter={filter}
			listings={data.listings}
			requests={mapDeals}
			search={search}
			selected={selected}
			setFilter={setFilter}
			setSearch={setSearch}
			showGIS={false}
			onDealsOpenChange={setDealsOpen}
			onSelect={(id) => {
				setSelected(id);
				if (compact) navigate("explore");
			}}
		/>
	);
	return (
		<SidebarProvider className="layout" style={{"--sidebar-width-icon": "3.75rem"}}>
			<WorkspaceSidebar page={page} pages={PAGES} onNavigate={navigate} onSources={() => setDrawer("about")} />
			<div className="content autopilot-workspace">
				<header className="topbar">
					<SidebarTrigger />
					<span className="top-breadcrumb">{PAGES[page]}</span>
					<div className="top-actions">
						<span className="header-location">Groningen</span>
						<Badge variant="secondary">
							<span className="status-dot" />
							Autopilot preview
						</Badge>
						<Button aria-label="Your setup" size="icon" variant="ghost" onClick={() => navigate("myspace")}>
							<span className="account-avatar">{profile?.name?.charAt(0) || "G"}</span>
						</Button>
					</div>
				</header>
				<main>
					{error ? (
						<div className="load-error" role="alert">
							<CircleHelp size={20} />
							<p>{error}</p>
							<Button
								onClick={() => {
									setError("");
									setReload((value) => value + 1);
								}}>
								Try again
							</Button>
						</div>
					) : (
						<>
							{page === "dashboard" && (
								<>
									<div className="autopilot-heading">
										<div>
											<p className="eyebrow">LESS TO MANAGE. MORE TO GAIN.</p>
											<h1>Your energy, on autopilot.</h1>
											<p>A quieter grid. Better use of local energy. A little more peace of mind.</p>
										</div>
										<span className="day-label">
											<Clock3 size={14} />
											12 Nov 2026 · demo day
										</span>
									</div>
									<div className="autopilot-stats">
										<Card>
											<CardContent>
												<span>
													<Wallet size={16} />
													Neighbourhood savings
												</span>
												<strong>{forecast ? euro(forecast.savings_eur) : "—"}</strong>
												<small>Estimated for this demo day</small>
											</CardContent>
										</Card>
										<Card>
											<CardContent>
												<span>
													<Leaf size={16} />A flatter evening peak
												</span>
												<strong>{forecast ? `${number(forecast.peak_reduction_kw)} kW` : "—"}</strong>
												<small>Less demand at the busiest moment</small>
											</CardContent>
										</Card>
										<Card>
											<CardContent>
												<span>
													<Sparkles size={16} />
													Planned automatically
												</span>
												<strong>
													{plan.length || "—"}
													<em> opportunities</em>
												</strong>
												<small>No manual matching needed</small>
											</CardContent>
										</Card>
									</div>
									<div className="autopilot-grid">
										<Panel
											className="autopilot-plan-panel"
											description="A look at the neighbourhood plan"
											footer="Illustrative plans · supplier checks still required."
											title="What Autopilot is planning"
											action={
												<Button size="sm" variant="ghost" onClick={() => navigate("activity")}>
													View activity
													<ArrowUpRight size={14} />
												</Button>
											}>
											<ActivityFeed compact plan={plan} onSelect={inspect} />
										</Panel>
										<Panel
											className="autopilot-map-panel"
											description="Solar, batteries and flexible use in Groningen"
											title="Energy around you"
											action={
												<Button
													aria-label="Open energy network"
													size="icon"
													variant="ghost"
													onClick={() => navigate("explore")}>
													<ArrowUpRight size={16} />
												</Button>
											}>
											{map(true)}
										</Panel>
										<Panel
											className="autopilot-cost-panel"
											description="Neighbourhood energy costs · 12 Nov"
											footer="Estimated neighbourhood totals, rather than your personal bill."
											title="The difference Autopilot makes">
											<div className="cost-comparison">
												<span>
													Without Autopilot<strong>{forecast ? euro(forecast.before.cost_eur) : "—"}</strong>
												</span>
												<span>
													With Autopilot<strong>{forecast ? euro(forecast.after.cost_eur) : "—"}</strong>
												</span>
											</div>
											<CostChart forecast={forecast} />
										</Panel>
										<Panel
											className="autopilot-energy-panel"
											description="Energy use spread across the day · kW"
											footer="Lower peaks by shifting flexible use to better moments."
											title="A more balanced neighbourhood">
											<div className="chart-legend">
												<span className="line-key before" />
												Without Autopilot
												<span className="line-key after" />
												With Autopilot
											</div>
											<EnergyChart forecast={forecast} />
										</Panel>
									</div>
								</>
							)}
							{page === "activity" && (
								<>
									<div className="autopilot-heading">
										<div>
											<p className="eyebrow">WORKING IN THE BACKGROUND</p>
											<h1>A little less work for you.</h1>
											<p>See what’s planned, why it makes sense and the estimated benefit.</p>
										</div>
										<Badge variant="secondary">12 Nov · demo plan</Badge>
									</div>
									<Panel
										description="Prepared automatically from available solar, storage and flexible demand"
										footer="These are simulated opportunities. Nothing has been booked or sent to a device."
										title="Your neighbourhood’s daily plan">
										<ActivityFeed plan={plan} onSelect={inspect} />
									</Panel>
									{!!data.requests.length && (
										<Panel description="Your earlier manual choices are kept here" title="Previously saved drafts">
											<div className="saved-drafts">
												{data.requests.map((request) => (
													<Button
														key={request.id}
														variant="outline"
														onClick={() => {
															showOnMap(request);
															setDealsOpen(true);
														}}>
														{request.listing_name}
														<Badge variant="secondary">Draft</Badge>
														<ArrowUpRight size={14} />
													</Button>
												))}
											</div>
										</Panel>
									)}
								</>
							)}
							{page === "explore" && (
								<>
									<div className="autopilot-heading">
										<div>
											<p className="eyebrow">BETTER TOGETHER</p>
											<h1>Your local energy network.</h1>
											<p>Meet the solar roofs, batteries and flexible businesses in the neighbourhood.</p>
										</div>
										<Badge variant="secondary">Groningen</Badge>
									</div>
									<div className="network-layout">
										{map(false)}
										{chosen && (
											<Panel
												title={chosen.name}
												description={
													<span className="resource-kind-label">
														<Icon name={chosen.kind} size={16} />
														{chosen.kind === "solar"
															? "Local solar"
															: chosen.kind === "battery"
																? "Battery storage"
																: chosen.kind === "demand"
																	? "Flexible charging"
																	: "Flexible business"}
													</span>
												}>
												<dl className="read-only-details">
													<div>
														<dt>Available energy</dt>
														<dd>{chosen.kind === "mcc" ? `${chosen.power_kw} kW` : `${chosen.energy_kwh} kWh`}</dd>
													</div>
													<div>
														<dt>Available hours</dt>
														<dd>{chosen.window}</dd>
													</div>
													<div>
														<dt>Energy supplier</dt>
														<dd>{chosen.supplier}</dd>
													</div>
												</dl>
												<p className="quiet">
													Autopilot looks for useful matches in the background. You don’t need to contact or book
													individual resources.
												</p>
												{plan.find((item) => item.listing_id === chosen.id) && (
													<Button
														className="network-explanation"
														variant="secondary"
														onClick={() => inspect(plan.find((item) => item.listing_id === chosen.id))}>
														Why this is in the plan
														<ArrowUpRight size={14} />
													</Button>
												)}
											</Panel>
										)}
									</div>
									<p className="section-note">
										Illustrative resources and locations. Supplier participation is not verified.
									</p>
								</>
							)}
							{page === "myspace" && (
								<>
									<div className="autopilot-heading">
										<div>
											<p className="eyebrow">SET ONCE. CHECK WHEN YOU LIKE.</p>
											<h1>Your setup.</h1>
											<p>The essentials, without the technical settings.</p>
										</div>
									</div>
									<div className="setup-grid">
										<Panel description="Details from your local demo profile" title="Your account">
											<div className="account-identity">
												<span className="account-avatar large">{profile?.name?.charAt(0) || "G"}</span>
												<div>
													<strong>{profile?.name || "Explore as a guest"}</strong>
													<p>{profile?.location_area || "Groningen"}</p>
												</div>
											</div>
											<dl className="read-only-details">
												<div>
													<dt>Energy supplier</dt>
													<dd>{profile?.supplier || "Not connected"}</dd>
												</div>
												<div>
													<dt>Account</dt>
													<dd>
														{profile
															? profile.account_type === "business"
																? "Business"
																: "Household"
															: "Demo preview"}
													</dd>
												</div>
												<div>
													<dt>Meter connection</dt>
													<dd>Not connected</dd>
												</div>
											</dl>
											<p className="quiet">
												Supplier and device connections will be part of onboarding. No account details need changing to
												explore this demo.
											</p>
										</Panel>
										<Panel description="A simple view of what Autopilot can work with" title="Your devices">
											<div className="device-empty">
												<Unplug size={26} />
												<strong>No devices connected yet</strong>
												<p>
													In the full app, your meter, solar panels and battery are connected once through your
													supplier.
												</p>
											</div>
											{profile && (profile.solar_kwp > 0 || profile.battery_kwh > 0) && (
												<p className="quiet">
													Your profile mentions {number(profile.solar_kwp || 0)} kWp of solar and{" "}
													{number(profile.battery_kwh || 0)} kWh of storage. These are self-reported, rather than live
													device readings.
												</p>
											)}
										</Panel>
										<Panel
											className="setup-promises"
											description="What the setup experience is designed around"
											title="You set the limits. Autopilot does the rest.">
											<div className="promise-grid">
												{[
													"Keep energy aside for yourself",
													"Charge before you need to leave",
													"Stay inside your price range",
													"Take back control whenever you want",
												].map((text) => (
													<span key={text}>
														<ShieldCheck size={19} />
														{text}
													</span>
												))}
											</div>
											<p className="quiet">
												Preferences and device controls will become available after a real connection. This preview
												doesn’t operate your devices.
											</p>
										</Panel>
									</div>
								</>
							)}
						</>
					)}
					<div className="demo-disclosure">
						<span>Demo preview · plans and savings are simulated.</span>
						<Button size="sm" variant="link" onClick={() => setDrawer("about")}>
							About this data
							<CircleHelp size={13} />
						</Button>
					</div>
				</main>
			</div>
			{drawer === "activity" && detail && (
				<Drawer eyebrow="INSIDE THE AUTOPILOT PLAN" title={detail.listing_name} onClose={() => setDrawer("")}>
					<Badge variant="secondary">Planned · demo</Badge>
					<h3 className="deal-detail-benefit">
						{euro(detail.estimated_savings_eur)}
						<small> estimated benefit</small>
					</h3>
					<p className="detail-explanation">{detail.explanation}</p>
					<dl className="read-only-details">
						<div>
							<dt>Local partner</dt>
							<dd>{detail.partner}</dd>
						</div>
						<div>
							<dt>Energy</dt>
							<dd>
								{number(detail.quantity)} {detail.unit}
							</dd>
						</div>
						<div>
							<dt>Available hours</dt>
							<dd>{detail.window}</dd>
						</div>
						<div>
							<dt>Day</dt>
							<dd>12 November 2026</dd>
						</div>
					</dl>
					<div className="plan-reason">
						<Check size={17} />
						<p>
							{detail.review
								? "This opportunity needs a supplier settlement check before it could go ahead."
								: "The model found overlapping availability and matching supplier labels. Participation still needs verification."}
						</p>
					</div>
					<Button onClick={() => showOnMap(detail)}>
						View location
						<ArrowUpRight size={15} />
					</Button>
					<p className="quiet">An illustrative plan, rather than a completed trade or personal bill saving.</p>
				</Drawer>
			)}
			{drawer === "about" && (
				<Drawer eyebrow="ABOUT YOUR DATA" title="A clear view of the demo." onClose={() => setDrawer("")}>
					<div className="about-data">
						<h3>What you’re looking at</h3>
						<p>
							A read-only preview of an automatic energy service in Groningen, using a fixed demo day: 12 November 2026.
						</p>
						<h3>Neighbourhood totals</h3>
						<p>
							The charts and headline savings cover the simulated neighbourhood. They aren’t measured results from your
							account or a personal energy bill.
						</p>
						<h3>Planned, rather than completed</h3>
						<p>
							Activity comes from model suggestions. Deals haven’t been settled, approved by suppliers or sent to
							devices. Previously saved drafts remain separate.
						</p>
						<h3>The map</h3>
						<p>
							OpenStreetMap and CARTO provide the basemap. The energy resources, availability and network relationships
							are illustrative.
						</p>
					</div>
				</Drawer>
			)}
		</SidebarProvider>
	);
}
