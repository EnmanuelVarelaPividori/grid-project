import {Check, Minus, Plus, Target} from "@gravity-ui/icons";
import {Button, Card} from "@heroui/react";
import {useState} from "react";
import {neighboursFor} from "@/lib/autopilot";
import type {Asset, Neighbour, TradeMode} from "@/lib/autopilot";
import {AssetIcon} from "./asset-icon";

const extras: Neighbour[] = [
	{
		id: "local-roof",
		name: "Rooftop solar · Stadspark",
		asset: "solar",
		group: "household",
		price: 0.15,
		quantity: 3,
		time: "12:00",
		battery: false,
		sameGrid: true,
		x: 68,
		y: 13,
		distance: 460,
	},
	{
		id: "home-storage",
		name: "Home battery · Kerkstraat",
		asset: "battery",
		group: "household",
		price: 0.27,
		quantity: 2,
		time: "18:00",
		battery: true,
		sameGrid: true,
		x: 74,
		y: 72,
		distance: 390,
	},
	{
		id: "local-solar",
		name: "Solar roof · Diepkade",
		asset: "solar",
		group: "business",
		price: 0.17,
		quantity: 2,
		time: "13:30",
		battery: false,
		sameGrid: true,
		x: 60,
		y: 61,
		distance: 280,
	},
];
const filters: {id: Asset | "all"; label: string}[] = [
	{id: "all", label: "All"},
	{id: "solar", label: "Solar"},
	{id: "battery", label: "Batteries"},
	{id: "ev", label: "EV & flexible"},
	{id: "business", label: "Businesses"},
];
const blocks = Array.from({length: 72}, (_, index) => ({
	x: 20 + (index % 12) * 83,
	y: 8 + Math.floor(index / 12) * 74,
	w: 64 + (index % 3) * 4,
	h: 49 + (index % 4) * 3,
}));

export function EnergyMap({
	mode,
	preferred,
	onPrefer,
}: {
	mode: TradeMode;
	preferred: ReadonlySet<string>;
	onPrefer: (id: string) => void;
}) {
	const [filter, setFilter] = useState<Asset | "all">("all");
	const [gridVisible, setGridVisible] = useState(true);
	const [selectedId, setSelectedId] = useState("bakery");
	const [zoom, setZoom] = useState(1);
	const all = [...neighboursFor(mode), ...extras];
	const visible = all.filter(
		(item) =>
			filter === "all" || (filter === "ev" ? item.asset === "ev" || item.asset === "flex" : item.asset === filter),
	);
	const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
	const isPreferred = selected && preferred.has(selected.id);
	return (
		<div aria-label="Illustrative Oosterpoort neighbourhood energy map" className="gs-map">
			<div className="gs-map-scene" style={{transform: `scale(${zoom})`}}>
				<svg aria-hidden="true" className="gs-map-base" preserveAspectRatio="none" viewBox="0 0 1000 440">
					<rect fill="#f0f1ea" height="440" width="1000" />
					{blocks.map((block, index) => (
						<rect
							key={`${block.x}:${block.y}`}
							fill={index % 5 === 0 ? "#e7ebdf" : "#e4e8dd"}
							height={block.h}
							rx="6"
							width={block.w}
							x={block.x}
							y={block.y}
						/>
					))}
					<rect fill="#dce6cf" height="125" rx="12" width="245" x="610" y="-7" />
					{[0, 1, 2, 3, 4, 5, 6].map((index) => (
						<circle
							key={index}
							cx={640 + (index % 3) * 73}
							cy={22 + Math.floor(index / 3) * 38}
							fill="#cedcbe"
							r={8 + (index % 3)}
						/>
					))}
					<g fill="none" stroke="#fcfdf9" strokeWidth="13">
						<path d="M0 180H1000M0 280H1000M110 0V440M275 0V440M505 0V440M700 100V440M885 0V440" />
						<path d="M70 -40L880 460" strokeWidth="12" />
						<path d="M0 400C280 322 450 450 680 425S870 387 1000 387" stroke="#d5e2df" strokeWidth="34" />
					</g>
					<g fill="#9ca68d" fontFamily="Inter, sans-serif" fontSize="10" letterSpacing="1.4">
						<text x="55" y="169">
							OOSTERWEG
						</text>
						<text x="125" y="320">
							DIEPKADE
						</text>
						<text x="570" y="410">
							KERKSTRAAT
						</text>
						<text x="630" y="32">
							STADSPARK
						</text>
					</g>
					{gridVisible && (
						<path
							d="M125 0L132 420L636 440L890 401L870 0"
							fill="none"
							stroke="#7a9162"
							strokeDasharray="5 6"
							strokeWidth="1.3"
						/>
					)}
					<g fill="none" stroke="#bec9b2" strokeDasharray="2 7" strokeWidth="1">
						<path d="M480 226L425 20M480 226L670 60M480 226L215 171M480 226L755 315M480 226L600 270" />
					</g>
				</svg>
				{visible.map((item) => (
					<Button
						key={item.id}
						aria-label={`${item.name}, €${item.price.toFixed(2)} per kWh`}
						aria-pressed={selected?.id === item.id}
						className={`gs-map-pin ${selected?.id === item.id ? "is-selected" : ""} ${preferred.has(item.id) ? "is-preferred" : ""}`}
						style={{left: `${item.x}%`, top: `${item.y}%`}}
						variant="tertiary"
						onPress={() => setSelectedId(item.id)}>
						<span className={`gs-asset-icon gs-asset-${item.asset}`}>
							<AssetIcon asset={item.asset} size={15} />
						</span>
						<span>€{item.price.toFixed(2)}</span>
						{preferred.has(item.id) && <span className="gs-pin-star">★</span>}
					</Button>
				))}
				<span className="gs-map-you">
					<i />
					<span>You</span>
				</span>
			</div>
			<div className="gs-map-toolbar">
				<div aria-label="Filter map by energy asset" className="gs-map-filters">
					{filters.map((item) => (
						<Button
							key={item.id}
							aria-pressed={filter === item.id}
							className={filter === item.id ? "is-selected" : ""}
							size="sm"
							variant="tertiary"
							onPress={() => setFilter(item.id)}>
							{item.label}
						</Button>
					))}
				</div>
				<Button
					aria-pressed={gridVisible}
					className={`gs-grid-filter ${gridVisible ? "is-selected" : ""}`}
					size="sm"
					variant="tertiary"
					onPress={() => setGridVisible(!gridVisible)}>
					<svg aria-hidden="true" fill="none" height="16" viewBox="0 0 20 20" width="16">
						<path d="m10 2-5 16m5-16 5 16M6 8h8M4 13h12M7 4h6M10 2v16" stroke="currentColor" strokeWidth="1.3" />
					</svg>
					Grid capacity
				</Button>
			</div>
			<div className="gs-map-zoom">
				<Button
					isIconOnly
					aria-label="Zoom in on map"
					isDisabled={zoom >= 1.4}
					variant="tertiary"
					onPress={() => setZoom(Math.min(1.4, zoom + 0.1))}>
					<Plus height={15} width={15} />
				</Button>
				<Button
					isIconOnly
					aria-label="Zoom out of map"
					isDisabled={zoom <= 1}
					variant="tertiary"
					onPress={() => setZoom(Math.max(1, zoom - 0.1))}>
					<Minus height={15} width={15} />
				</Button>
				<Button
					isIconOnly
					aria-label="Reset map view"
					variant="tertiary"
					onPress={() => {
						setZoom(1);
						setSelectedId("bakery");
						setFilter("all");
					}}>
					<Target height={16} width={16} />
				</Button>
			</div>
			{selected && (
				<Card className="gs-map-detail">
					<div className="gs-map-detail-top">
						<div>
							<span className={`gs-mini-label gs-label-${selected.asset}`}>
								{selected.asset === "business"
									? "Business demand"
									: selected.asset === "solar"
										? "Solar supply"
										: selected.asset === "battery"
											? "Battery storage"
											: "Flexible demand"}
							</span>
							<span className="gs-mini-label gs-type-label">
								{selected.group === "business" ? "Small business" : "Household"}
							</span>
						</div>
						<div>
							<strong>€{selected.price.toFixed(2)}</strong>
							<small>{selected.asset === "solar" || selected.asset === "battery" ? "asks" : "pays up to"} /kWh</small>
						</div>
					</div>
					<h3>{selected.name}</h3>
					<p>
						{selected.distance} m away · Tomorrow {selected.battery ? "17–20h" : "11–16h"}
					</p>
					<span className={selected.sameGrid ? "gs-grid-match" : "gs-grid-mismatch"}>
						{selected.sameGrid ? <Check height={13} width={13} /> : <span>↗</span>}
						{selected.sameGrid
							? "Same grid area: a possible autopilot match"
							: "Other grid area: outside this demo’s trading area"}
					</span>
					<Button
						aria-pressed={Boolean(isPreferred)}
						className={`gs-button gs-button-soft gs-prefer-button ${isPreferred ? "is-preferred" : ""}`}
						isDisabled={!selected.sameGrid}
						onPress={() => onPrefer(selected.id)}>
						{isPreferred && <Check height={14} width={14} />}
						{isPreferred ? "Preferred neighbour" : "Prefer this neighbour"}
					</Button>
				</Card>
			)}
			<span className="gs-map-disclaimer">Illustrative map · grid capacity not integrated</span>
		</div>
	);
}
