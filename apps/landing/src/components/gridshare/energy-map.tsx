import {useRef, useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import type {Asset} from "@/lib/autopilot";
import {KindIcon} from "./icons";

// Map coordinates: the SVG view box starts at (-400, -260), so a point (x, y) sits at (x + 400, y + 260) px in the layer.
const offsetX = 400;
const offsetY = 260;
const minZoom = 0.8;
const maxZoom = 1.8;

const kinds: Record<Asset, {label: string; verb: string}> = {
	solar: {label: "Solar surplus", verb: "shares at"},
	battery: {label: "Battery", verb: "shares at"},
	ev: {label: "EV charging", verb: "pays up to"},
	flex: {label: "Flexible use", verb: "pays up to"},
	business: {label: "Business demand", verb: "pays up to"},
};

interface Listing {
	id: string;
	kind: Asset;
	who: string;
	name: string;
	place: string;
	x: number;
	y: number;
	distance: string;
	window: string;
	price: number;
	inArea: boolean;
}

const listings: Listing[] = [
	{
		id: "s1",
		kind: "solar",
		who: "Household",
		name: "Rooftop solar",
		place: "Lindenstraat",
		x: 360,
		y: 220,
		distance: "350 m",
		window: "Midday",
		price: 0.16,
		inArea: true,
	},
	{
		id: "s2",
		kind: "solar",
		who: "Small business",
		name: "Office roof",
		place: "Schoolplein",
		x: 690,
		y: 170,
		distance: "900 m",
		window: "Weekdays 10–16h",
		price: 0.15,
		inArea: true,
	},
	{
		id: "s3",
		kind: "solar",
		who: "Household",
		name: "Balcony solar",
		place: "Oosterkade",
		x: 585,
		y: 400,
		distance: "220 m",
		window: "Midday",
		price: 0.17,
		inArea: true,
	},
	{
		id: "s4",
		kind: "solar",
		who: "Business",
		name: "Solar field",
		place: "Polderweg",
		x: 930,
		y: 580,
		distance: "2.8 km",
		window: "09–17h",
		price: 0.12,
		inArea: false,
	},
	{
		id: "b1",
		kind: "battery",
		who: "Household",
		name: "Home battery",
		place: "Kerkweg",
		x: 300,
		y: 420,
		distance: "500 m",
		window: "Evenings",
		price: 0.25,
		inArea: true,
	},
	{
		id: "b2",
		kind: "battery",
		who: "Community",
		name: "Community battery",
		place: "Parkzijde",
		x: 770,
		y: 450,
		distance: "1.2 km",
		window: "Any time",
		price: 0.27,
		inArea: true,
	},
	{
		id: "e1",
		kind: "ev",
		who: "Household",
		name: "EV charger",
		place: "Molenlaan",
		x: 200,
		y: 300,
		distance: "400 m",
		window: "Ready by 07:00",
		price: 0.22,
		inArea: true,
	},
	{
		id: "e2",
		kind: "ev",
		who: "Small business",
		name: "Sports club chargers",
		place: "Sportpark",
		x: 840,
		y: 300,
		distance: "1.1 km",
		window: "09–17h",
		price: 0.17,
		inArea: true,
	},
	{
		id: "f1",
		kind: "flex",
		who: "Household",
		name: "Heat pump",
		place: "Linnaeusstraat",
		x: 420,
		y: 470,
		distance: "300 m",
		window: "Shifts 10–16h",
		price: 0.19,
		inArea: true,
	},
	{
		id: "c1",
		kind: "business",
		who: "Small business",
		name: "Bakery",
		place: "Marktplein",
		x: 450,
		y: 130,
		distance: "650 m",
		window: "Ovens, cold room",
		price: 0.24,
		inArea: true,
	},
	{
		id: "c2",
		kind: "business",
		who: "Small business",
		name: "Corner shop",
		place: "Oosterstraat",
		x: 620,
		y: 250,
		distance: "450 m",
		window: "Fridges all day",
		price: 0.21,
		inArea: true,
	},
];

type FilterId = "all" | "solar" | "battery" | "ev" | "business";
const filters: {id: FilterId; label: string; test: (listing: Listing) => boolean}[] = [
	{id: "all", label: "All", test: () => true},
	{id: "solar", label: "Solar", test: (listing) => listing.kind === "solar"},
	{id: "battery", label: "Batteries", test: (listing) => listing.kind === "battery"},
	{id: "ev", label: "EV & flexible", test: (listing) => listing.kind === "ev" || listing.kind === "flex"},
	{id: "business", label: "Businesses", test: (listing) => listing.who !== "Household"},
];

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
	return `M${x + r},${y}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`;
}
const blocksPath = (() => {
	let d = "";
	for (let i = -4; i < 14; i++)
		for (let j = -3; j < 10; j++) {
			const x = i * 104 + 8;
			const y = j * 94 + 8;
			if (x > 600 && x < 860 && y > -10 && y < 220) continue;
			d += roundedRect(x, y, 90, 80, 6);
		}
	return d;
})();
const treesPath = [
	[650, 60],
	[700, 110],
	[760, 70],
	[820, 140],
	[680, 170],
	[800, 190],
]
	.map(([x, y]) => `M${x - 9},${y}a9,9 0 1 0 18,0a9,9 0 1 0 -18,0z`)
	.join("");

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const stopDrag = (event: ReactPointerEvent) => event.stopPropagation();

export function EnergyMap() {
	const [filter, setFilter] = useState<FilterId>("all");
	const [selectedId, setSelectedId] = useState<string | null>("c1");
	const [view, setView] = useState({x: 0, y: 0, zoom: 1});
	const [dragging, setDragging] = useState(false);
	const [showGrid, setShowGrid] = useState(false);
	const drag = useRef<{startX: number; startY: number; x: number; y: number; moved: boolean} | null>(null);

	const active = filters.find((item) => item.id === filter) ?? filters[0];
	const visible = listings.filter(active.test);
	const selected = visible.find((listing) => listing.id === selectedId) ?? null;

	const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		drag.current = {startX: event.clientX, startY: event.clientY, x: view.x, y: view.y, moved: false};
	};
	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const current = drag.current;
		if (!current) return;
		const dx = event.clientX - current.startX;
		const dy = event.clientY - current.startY;
		if (!current.moved && Math.abs(dx) + Math.abs(dy) > 4) {
			current.moved = true;
			event.currentTarget.setPointerCapture(event.pointerId);
			setDragging(true);
		}
		if (current.moved)
			setView((value) => ({...value, x: clamp(current.x + dx, -260, 260), y: clamp(current.y + dy, -200, 200)}));
	};
	const endDrag = () => {
		drag.current = null;
		setDragging(false);
	};
	const zoomBy = (delta: number) =>
		setView((value) => ({...value, zoom: clamp(Number((value.zoom + delta).toFixed(2)), minZoom, maxZoom)}));

	return (
		<div
			aria-label="Illustrative Oosterpoort energy map. Drag to move around."
			className={dragging ? "gs-map is-dragging" : "gs-map"}
			role="region"
			onPointerCancel={endDrag}
			onPointerDown={onPointerDown}
			onPointerLeave={endDrag}
			onPointerMove={onPointerMove}
			onPointerUp={endDrag}>
			<div
				className="gs-map-layer"
				style={{
					transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px)) scale(${view.zoom})`,
				}}>
				<svg aria-hidden="true" className="gs-map-base" height="1160" viewBox="-400 -260 1800 1160" width="1800">
					<rect fill="#F3F4EF" height="1160" width="1800" x="-400" y="-260" />
					<path d={blocksPath} fill="#E6E9E0" />
					<rect fill="#DDE6D2" height="196" rx="18" width="250" x="612" y="16" />
					<path d={treesPath} fill="#CFDCC1" />
					<path
						d="M-420,560 C-100,420 250,450 450,520 S900,430 1420,500"
						fill="none"
						stroke="#D5E1DE"
						strokeWidth="34"
					/>
					<g stroke="#FFFFFF">
						<path d="M-400,283 L1400,283" strokeWidth="14" />
						<path d="M519,-260 L519,900" strokeWidth="14" />
						<path d="M-300,-92 L1300,772" strokeWidth="12" />
						<path d="M-400,-50 L1400,-50" strokeWidth="10" />
					</g>
					<g fontSize="11" letterSpacing="1.5">
						<text fill="#9AA192" x="40" y="276">
							OOSTERWEG
						</text>
						<text fill="#9AA192" x="530" y="620">
							KERKSTRAAT
						</text>
						<text fill="#8FA5A1" x="80" y="478">
							DIEPKADE
						</text>
						<text fill="#7F9572" x="690" y="40">
							STADSPARK
						</text>
					</g>
					<polygon
						className="gs-map-zone"
						fill="#7FA35F"
						opacity={showGrid ? 0.16 : 0}
						points="110,70 500,65 520,545 120,540"
					/>
					<polygon
						className="gs-map-zone"
						fill="#E0A23A"
						opacity={showGrid ? 0.16 : 0}
						points="500,65 880,60 900,520 640,560 520,545"
					/>
					<polygon
						fill="none"
						points="110,70 880,60 900,520 640,560 120,540"
						stroke="#4A7A35"
						strokeDasharray="6 6"
						strokeWidth="1.5"
					/>
					<circle cx="480" cy="330" fill="none" r="150" stroke="#4A7A35" strokeDasharray="2 6" strokeOpacity=".25" />
				</svg>
				{showGrid && (
					<>
						<span className="gs-map-feeder gs-rise" style={{left: 700, top: 360}}>
							West feeder · spare capacity
						</span>
						<span className="gs-map-feeder gs-map-feeder-busy gs-rise" style={{left: 1110, top: 360}}>
							East feeder · busy 17–20h
						</span>
					</>
				)}
				<div className="gs-map-you" style={{left: 480 + offsetX, top: 330 + offsetY}}>
					<span className="gs-ping" />
					<span className="gs-map-you-dot" />
					<span className="gs-map-you-label" style={{transform: `translateX(-50%) scale(${1 / view.zoom})`}}>
						You
					</span>
				</div>
				{visible.map((listing) => {
					const isSelected = listing.id === selected?.id;
					return (
						<button
							key={listing.id}
							aria-label={`${kinds[listing.kind].label}: ${listing.name}, ${listing.place}, €${listing.price.toFixed(2)} per kWh`}
							aria-pressed={isSelected}
							className={`gs-pin${isSelected ? " is-selected" : ""}${listing.inArea ? "" : " is-outside"}`}
							type="button"
							style={{
								left: listing.x + offsetX,
								top: listing.y + offsetY,
								transform: `translate(-50%, -100%) scale(${(isSelected ? 1.12 : 1) / view.zoom})`,
								zIndex: isSelected ? 5 : 1,
							}}
							onClick={() => setSelectedId(listing.id)}
							onPointerDown={stopDrag}>
							<span className="gs-pin-pill gs-num">
								<span className={`gs-kind gs-kind-${listing.kind}`}>
									<KindIcon kind={listing.kind} size={14} />
								</span>
								<span>€{listing.price.toFixed(2)}</span>
							</span>
							<span className="gs-pin-tip" />
						</button>
					);
				})}
			</div>
			<div className="gs-map-toolbar" onPointerDown={stopDrag}>
				<div aria-label="Show on the map" className="gs-map-filters" role="group">
					{filters.map((item) => (
						<button
							key={item.id}
							aria-pressed={item.id === filter}
							className="gs-btn gs-map-filter"
							type="button"
							onClick={() => {
								setFilter(item.id);
								setSelectedId(listings.find(item.test)?.id ?? null);
							}}>
							{item.label}
						</button>
					))}
				</div>
				<button
					aria-pressed={showGrid}
					className="gs-btn gs-map-grid-toggle"
					type="button"
					onClick={() => setShowGrid(!showGrid)}>
					<svg
						aria-hidden="true"
						fill="none"
						height="16"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="1.8"
						viewBox="0 0 24 24"
						width="16">
						<path d="M12 2 7 22M12 2l5 20M8 9h8M6.5 15h11M12 2v20" />
					</svg>
					Grid capacity
				</button>
			</div>
			<div className="gs-map-zoom" onPointerDown={stopDrag}>
				<button
					aria-label="Zoom in"
					className="gs-btn"
					disabled={view.zoom >= maxZoom}
					type="button"
					onClick={() => zoomBy(0.2)}>
					+
				</button>
				<button
					aria-label="Zoom out"
					className="gs-btn"
					disabled={view.zoom <= minZoom}
					type="button"
					onClick={() => zoomBy(-0.2)}>
					−
				</button>
				<button
					aria-label="Back to my location"
					className="gs-btn"
					type="button"
					onClick={() => setView({x: 0, y: 0, zoom: 1})}>
					<svg
						aria-hidden="true"
						fill="none"
						height="16"
						stroke="currentColor"
						strokeLinecap="round"
						strokeWidth="2"
						viewBox="0 0 24 24"
						width="16">
						<circle cx="12" cy="12" r="3" />
						<path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
					</svg>
				</button>
			</div>
			{selected && (
				<div key={selected.id} aria-live="polite" className="gs-map-detail gs-rise" onPointerDown={stopDrag}>
					<div className="gs-map-detail-top">
						<div>
							<div className="gs-map-detail-tags">
								<span className={`gs-tag gs-kind-${selected.kind}`}>{kinds[selected.kind].label}</span>
								<span className="gs-tag gs-tag-neutral">{selected.who}</span>
							</div>
							<h3 className="gs-display">
								{selected.name} · {selected.place}
							</h3>
							<p>
								{selected.distance} away · {selected.window}
							</p>
						</div>
						<div className="gs-map-detail-price">
							<div className="gs-display gs-num">€{selected.price.toFixed(2)}</div>
							<div>{kinds[selected.kind].verb} /kWh</div>
						</div>
					</div>
					<p className={selected.inArea ? "gs-area gs-area-in" : "gs-area gs-area-out"}>
						{selected.inArea
							? "✓ Same grid area: Autopilot can include them"
							: "✕ Different grid area: outside your local network"}
					</p>
				</div>
			)}
		</div>
	);
}
