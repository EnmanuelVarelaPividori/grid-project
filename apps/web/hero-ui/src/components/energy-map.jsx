import {Component, useEffect, useRef, useState} from "react";
import {chosenDeals} from "../lib/chosen-deals.js";
import {Icon} from "./brand.jsx";
import {ChosenDeals, money} from "./chosen-deals.jsx";
import {Button} from "./ui/button";
import {Input} from "./ui/input";
import {Map, MapControls, MapMarker, MarkerContent, MarkerTooltip, useMap} from "./ui/map";

class MapBoundary extends Component {
	state = {failed: false};
	static getDerivedStateFromError() {
		return {failed: true};
	}
	render() {
		return this.state.failed ? (
			<div className="map-unavailable">
				<strong>Map unavailable</strong>
				<p>The map needs WebGL and an internet connection. Your resources remain available in the dashboard.</p>
			</div>
		) : (
			this.props.children
		);
	}
}
function GridLayers({showGIS, congestion, listings}) {
	const {map, isLoaded} = useMap();
	useEffect(() => {
		if (!map || !isLoaded || !congestion) return;
		map.addSource("demo-congestion", {
			type: "geojson",
			data: {
				type: "FeatureCollection",
				features: listings
					.filter((item) => item.kind === "mcc")
					.map((item) => ({
						type: "Feature",
						geometry: {type: "Point", coordinates: [item.lon, item.lat]},
						properties: {},
					})),
			},
		});
		map.addLayer({
			id: "demo-congestion",
			type: "circle",
			source: "demo-congestion",
			paint: {"circle-radius": 65, "circle-color": "#b69b67", "circle-opacity": 0.2, "circle-blur": 0.6},
		});
		return () => {
			if (map.getLayer("demo-congestion")) map.removeLayer("demo-congestion");
			if (map.getSource("demo-congestion")) map.removeSource("demo-congestion");
		};
	}, [map, isLoaded, congestion, listings]);
	useEffect(() => {
		if (!map || !isLoaded || !showGIS) return;
		const url =
			"https://geoservices.provinciegroningen.nl/server/rest/services/BasisdataExtern/EnergieEnexis/MapServer/export?bbox=6.5,53.185,6.64,53.248&bboxSR=4326&imageSR=4326&size=1400,1000&format=png32&transparent=true&layers=show:1,2&f=image";
		map.addSource("public-cables", {
			type: "image",
			url,
			coordinates: [
				[6.5, 53.248],
				[6.64, 53.248],
				[6.64, 53.185],
				[6.5, 53.185],
			],
		});
		map.addLayer({id: "public-cables", type: "raster", source: "public-cables", paint: {"raster-opacity": 0.7}});
		return () => {
			if (map.getLayer("public-cables")) map.removeLayer("public-cables");
			if (map.getSource("public-cables")) map.removeSource("public-cables");
		};
	}, [map, isLoaded, showGIS]);
	return null;
}
function FocusDeal({deal}) {
	const {map, isLoaded} = useMap();
	const lat = deal?.resource?.lat;
	const lon = deal?.resource?.lon;
	const id = deal?.id;
	useEffect(() => {
		if (!map || !isLoaded || lat == null || lon == null) return;
		map.flyTo({
			center: [lon, lat],
			zoom: 14,
			padding: {bottom: 150},
			duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 850,
		});
	}, [map, isLoaded, lat, lon, id]);
	return null;
}
const noRequests = [];
const noop = () => {};
const categories = {all: "All", solar: "Solar", battery: "Batteries", mcc: "Capacity", demand: "Demand"};
export function GroningenMap({
	compact = false,
	requests = noRequests,
	dealsOpen = false,
	dealsTitle = "Chosen deals",
	onDealsOpenChange = noop,
	listings,
	selected,
	onSelect,
	filter,
	setFilter,
	search,
	setSearch,
	congestion,
	showGIS,
}) {
	const recent = chosenDeals(requests, listings);
	const dealsTrigger = useRef(null);
	const changeDealsOpen = (open) => {
		onDealsOpenChange(open);
		if (!open) dealsTrigger.current?.focus({preventScroll: true});
	};
	const [activeDealId, setActiveDealId] = useState(null);
	const activeDeal = recent.find((deal) => deal.id === activeDealId);
	const chosenByListing = new globalThis.Map();
	for (const deal of recent) {
		if (deal.resource && !chosenByListing.has(deal.listing_id)) chosenByListing.set(deal.listing_id, deal);
	}
	const selectDeal = (deal) => {
		setActiveDealId(deal.id);
		onSelect(deal.listing_id);
		changeDealsOpen(false);
	};
	const visible = listings.filter(
		(item) =>
			(compact || chosenByListing.has(item.id) || filter === "all" || item.kind === filter) &&
			(compact ||
				chosenByListing.has(item.id) ||
				[item.name, item.owner, item.supplier].join(" ").toLowerCase().includes(search.toLowerCase())),
	);
	return (
		<div className={`mapcn-frame ${compact ? "mapcn-compact" : ""}`}>
			<MapBoundary>
				<Map
					center={[6.575, 53.218]}
					className="energy-basemap"
					maxZoom={17}
					minZoom={9}
					theme="light"
					zoom={compact ? 10.5 : 12}>
					<MapControls position="bottom-right" />
					<FocusDeal
						deal={
							activeDeal ?? (!compact ? {id: selected, resource: listings.find((item) => item.id === selected)} : null)
						}
					/>
					<GridLayers congestion={congestion} listings={listings} showGIS={showGIS} />
					{visible.map((item) => (
						<MapMarker key={item.id} latitude={item.lat} longitude={item.lon}>
							<MarkerContent>
								<Button
									aria-label={`${item.name}: ${item.kind === "mcc" ? item.power_kw + " kW" : item.energy_kwh + " kWh"}${chosenByListing.get(item.id)?.estimate != null ? `, ${money(chosenByListing.get(item.id).estimate)} estimated savings` : ""}`}
									aria-pressed={selected === item.id}
									className={`resource-marker resource-marker-${item.kind} ${!compact && chosenByListing.has(item.id) ? "chosen-resource-marker" : ""}`}

									size="sm"
									variant={selected === item.id ? "default" : "secondary"}
									onClick={() =>
										chosenByListing.has(item.id) && !compact
											? selectDeal(chosenByListing.get(item.id))
											: onSelect(item.id)
									}>
									<Icon name={item.kind} size={15} />
									{!compact && (
										<span>
											{chosenByListing.get(item.id)?.estimate != null
												? `${money(chosenByListing.get(item.id).estimate)} est.`
												: item.kind === "mcc"
													? item.power_kw
													: item.energy_kwh}
										</span>
									)}
								</Button>
							</MarkerContent>
							<MarkerTooltip>
								{item.name} · {item.supplier}
							</MarkerTooltip>
						</MapMarker>
					))}
				</Map>
			</MapBoundary>
			{!compact && (
				<div className="mapcn-toolbar">
					<Input
						aria-label="Search local resources"
						placeholder="Search Groningen resources…"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					<div>
						{Object.entries(categories).map(([key, label]) => (
							<Button
								key={key}
								aria-pressed={filter === key}
								size="sm"
								variant={filter === key ? "default" : "secondary"}
								onClick={() => setFilter(key)}>
								{label}
							</Button>
						))}
					</div>
				</div>
			)}
			{!compact && (
				<>
					<Button
						ref={dealsTrigger}
						aria-expanded={dealsOpen}
						className="map-deals-trigger"
						variant="secondary"
						onClick={() => changeDealsOpen(!dealsOpen)}>
						{dealsTitle} <span>{recent.length}</span>
					</Button>
					<ChosenDeals
						deals={recent}
						open={dealsOpen}
						title={dealsTitle}
						onChoose={selectDeal}
						onOpenChange={changeDealsOpen}
					/>
					{activeDeal?.resource && !dealsOpen && (
						<div className="map-deal-preview" role="status">
							<div>
								<strong>{activeDeal.listing_name}</strong>
								<Button
									aria-label="Close chosen deal"
									size="icon"
									variant="ghost"
									onClick={() => setActiveDealId(null)}>
									×
								</Button>
							</div>
							<p>
								{activeDeal.date} · {activeDeal.quantity} {activeDeal.unit} · {activeDeal.preview ? "Planned" : "Draft"}
							</p>
							<b>
								{activeDeal.estimate === null
									? "Estimate unavailable"
									: `${money(activeDeal.estimate)} estimated savings`}
							</b>
							<small>Modelled benefit · not realized bill savings</small>
						</div>
					)}
				</>
			)}
			<span className="mapcn-demo-label">Illustrative resources{congestion ? " · simulated congestion" : ""}</span>
		</div>
	);
}
