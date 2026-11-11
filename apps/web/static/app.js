/* GridShare Groningen: a single-page, offline-first demonstration.
   No UI frameworks, external JavaScript, API keys, cookies or login services.
   If internet is available only, OSM tiles load beneath the local schematic.
*/
"use strict";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const escapeHTML = (value) =>
	String(value ?? "").replace(
		/[&<>"']/g,
		(c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c],
	);
const fmt = (num, max = 0) =>
	Number(num || 0).toLocaleString("en-NL", {minimumFractionDigits: 0, maximumFractionDigits: max});
const euro = (num) =>
	"€" + Number(num || 0).toLocaleString("en-NL", {minimumFractionDigits: 2, maximumFractionDigits: 2});
const types = {
	solar: {label: "Surplus electricity", glyph: "☀", unit: "kWh", color: "#fb735e"},
	battery: {label: "Battery storage", glyph: "▰", unit: "kWh", color: "#1c967b"},
	demand: {label: "Flexible demand", glyph: "↯", unit: "kWh", color: "#f7b949"},
	mcc: {label: "MCC flexibility", glyph: "⌁", unit: "kW", color: "#8875e9"},
};
const state = {
	profile: null,
	listings: [],
	requests: [],
	matches: [],
	filter: "all",
	selected: null,
	forecast: null,
	backtest: null,
	page: "explore",
	date: "2026-11-12",
	mode: "gridshare_ai",
	pendingRequest: null,
	camera: {x: 0, y: 0, scale: 1},
	congestion: false,
	search: "",
	activeDrawer: null,
	toastTimer: null,
};
const BBOX = {west: 6.5, east: 6.64, north: 53.248, south: 53.185};
const MAP_W = 1400,
	MAP_H = 1000;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
function project(lat, lon) {
	return {
		x: ((lon - BBOX.west) / (BBOX.east - BBOX.west)) * MAP_W,
		y: ((mercY(BBOX.north) - mercY(lat)) / (mercY(BBOX.north) - mercY(BBOX.south))) * MAP_H,
	};
}
async function api(path, options = {}) {
	let response;
	try {
		response = await fetch(path, {headers: {"Content-Type": "application/json"}, ...options});
	} catch (err) {
		throw new Error("Could not reach the local GridShare server. Please restart python app.py.");
	}
	let data;
	try {
		data = await response.json();
	} catch (err) {
		throw new Error("The server returned an unreadable response.");
	}
	if (!response.ok) throw new Error(data.error || "Request failed.");
	return data;
}
function toast(message) {
	const el = $("#toast");
	el.textContent = message;
	el.classList.add("show");
	clearTimeout(state.toastTimer);
	state.toastTimer = setTimeout(() => el.classList.remove("show"), 4100);
}
function showPage(name) {
	state.page = name;
	$$(".page-view").forEach((el) => el.classList.toggle("active", el.id === "page-" + name));
	$$(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.page === name));
	if (name === "intelligence") loadForecast();
	if (name === "backtest") loadBacktest();
	if (name === "myspace") renderMyspace();
	window.scrollTo({top: 0, behavior: "smooth"});
}
function renderStatistics() {
	const sum = (kind) =>
		state.listings
			.filter((x) => x.kind === kind)
			.reduce((a, b) => a + Number(b[kind === "mcc" ? "power_kw" : "energy_kwh"] || 0), 0);
	$("#stat-solar").textContent = fmt(sum("solar")) + " kWh";
	$("#stat-battery").textContent = fmt(sum("battery")) + " kWh";
	$("#stat-mcc").textContent = fmt(sum("mcc")) + " kW";
	["solar", "battery", "mcc", "demand"].forEach(
		(t) => ($("#side-count-" + t).textContent = state.listings.filter((l) => l.kind === t).length),
	);
	$("#filter-all-count").textContent = state.listings.length;
}
function filteredListings() {
	return state.listings.filter(
		(l) =>
			(state.filter === "all" || l.kind === state.filter) &&
			(!state.search ||
				[l.name, l.owner, l.kind, l.supplier, l.details].join(" ").toLowerCase().includes(state.search.toLowerCase())),
	);
}
function markCamera() {
	const c = state.camera;
	$("#map-stage").style.transform = `translate(${c.x}px,${c.y}px) scale(${c.scale})`;
}
function fitMap() {
	const map = $("#map-viewport");
	if (!map) return;
	const w = map.clientWidth,
		h = map.clientHeight;
	const scale = Math.max(0.64, Math.min(0.94, w / 1020));
	// Center on Groningen, with Euvelgunne reachable by dragging.
	const center = project(53.2178, 6.572);
	state.camera.scale = scale;
	state.camera.x = w * 0.49 - center.x * scale;
	state.camera.y = h * 0.54 - center.y * scale;
	markCamera();
}
function panToListing(l) {
	const c = state.camera,
		viewport = $("#map-viewport"),
		p = project(l.lat, l.lon);
	const targetX = viewport.clientWidth * 0.43;
	const targetY = viewport.clientHeight * 0.54;
	c.x = targetX - p.x * c.scale;
	c.y = targetY - p.y * c.scale;
	markCamera();
}
function zoom(factor) {
	const view = $("#map-viewport");
	const c = state.camera;
	const newScale = Math.min(2.4, Math.max(0.49, c.scale * factor));
	const cx = view.clientWidth * 0.5,
		cy = view.clientHeight * 0.5;
	c.x = cx - ((cx - c.x) * newScale) / c.scale;
	c.y = cy - ((cy - c.y) * newScale) / c.scale;
	c.scale = newScale;
	markCamera();
}
function initMapControls() {
	const viewport = $("#map-viewport");
	let dragging = false,
		last = {x: 0, y: 0},
		moved = false;
	viewport.addEventListener("pointerdown", (e) => {
		if (e.target.closest("button,input,.floating-search,.filter-chips,.map-controls,a")) return;
		dragging = true;
		moved = false;
		last = {x: e.clientX, y: e.clientY};
		try {
			viewport.setPointerCapture(e.pointerId);
		} catch (_) {}
	});
	viewport.addEventListener("pointermove", (e) => {
		if (!dragging) return;
		const dx = e.clientX - last.x,
			dy = e.clientY - last.y;
		if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
		state.camera.x += dx;
		state.camera.y += dy;
		last = {x: e.clientX, y: e.clientY};
		markCamera();
	});
	["pointerup", "pointercancel", "lostpointercapture"].forEach((type) =>
		viewport.addEventListener(type, () => {
			dragging = false;
		}),
	);
	viewport.addEventListener(
		"wheel",
		(e) => {
			e.preventDefault();
			zoom(e.deltaY > 0 ? 0.87 : 1.15);
		},
		{passive: false},
	);
	$("#zoom-in").addEventListener("click", () => zoom(1.23));
	$("#zoom-out").addEventListener("click", () => zoom(0.81));
	$("#zoom-home").addEventListener("click", fitMap);
	$("#zoom-reset").addEventListener("click", fitMap);
	let publicLayerRequested = false;
	$("#toggle-gis").addEventListener("click", () => {
		const img = $("#published-gis");
		publicLayerRequested = !publicLayerRequested;
		img.hidden = !publicLayerRequested;
		$("#toggle-gis").textContent = publicLayerRequested ? "⌁  Hide public cable layer" : "⌁  Public cable layer";
		if (publicLayerRequested) {
			if (!img.src) {
				// ArcGIS export from a *published* provincial GIS service, requested
				// only on user click. Layer 1: medium-voltage stations; layer 2: cables.
				// This is not real-time loading, contracts, or verified connectivity.
				const base =
					"https://geoservices.provinciegroningen.nl/server/rest/services/BasisdataExtern/EnergieEnexis/MapServer/export";
				const params = new URLSearchParams({
					bbox: `${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`,
					bboxSR: "4326",
					imageSR: "4326",
					size: "1400,1000",
					format: "png32",
					transparent: "true",
					layers: "show:1,2",
					f: "image",
				});
				img.onerror = () => {
					publicLayerRequested = false;
					img.hidden = true;
					$("#toggle-gis").textContent = "⌁  Public cable layer";
					toast("The published GIS overlay is unavailable. The offline schematic still works.");
				};
				img.src = base + "?" + params.toString();
			}
			toast("Public GIS geography only — this is NOT live capacity and does not prove two users can share power.");
		}
	});
	$("#toggle-congestion").addEventListener("click", () => {
		state.congestion = !state.congestion;
		$("#congestion-layer").classList.toggle("on", state.congestion);
		$("#toggle-congestion").textContent = state.congestion
			? "◉  Hide simulated congestion"
			: "◌  Demo congestion overlay";
		toast("Congestion colors are deliberately simulated — check the official capacity map for real area status.");
	});
	$$("#filter-chips button").forEach((btn) =>
		btn.addEventListener("click", () => {
			state.filter = btn.dataset.filter;
			$$("#filter-chips button").forEach((x) => x.classList.toggle("selected", x === btn));
			renderMarkers();
		}),
	);
	$("#map-search").addEventListener("input", (e) => {
		state.search = e.target.value;
		renderMarkers();
	});
	$("#select-first").addEventListener("click", () => selectListing(state.listings[0]?.id));
	window.addEventListener("resize", () => {
		if (state.page === "explore") fitMap();
	});
}
function addOSMTiles() {
	// Real basemap tiles appear when online, fallback SVG remains usable offline.
	// Map is restricted to Groningen. No real congestion or cable layer is ingested.
	const z = 14,
		world = 256 * 2 ** z;
	const toPX = (lon) => ((lon + 180) / 360) * world;
	const toPY = (lat) =>
		((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * world;
	const xStart = toPX(BBOX.west),
		xEnd = toPX(BBOX.east);
	const yStart = toPY(BBOX.north),
		yEnd = toPY(BBOX.south);
	const factorX = MAP_W / (xEnd - xStart),
		factorY = MAP_H / (yEnd - yStart);
	const layer = $("#tile-layer");
	const fragment = document.createDocumentFragment();
	for (let x = Math.floor(xStart / 256); x <= Math.floor(xEnd / 256); x++) {
		for (let y = Math.floor(yStart / 256); y <= Math.floor(yEnd / 256); y++) {
			const img = document.createElement("img");
			img.alt = "";
			img.loading = "lazy";
			img.decoding = "async";
			Object.assign(img.style, {
				left: (x * 256 - xStart) * factorX + "px",
				top: (y * 256 - yStart) * factorY + "px",
				width: 256 * factorX + 1 + "px",
				height: 256 * factorY + 1 + "px",
			});
			img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
			img.onerror = () => img.remove();
			fragment.append(img);
		}
	}
	layer.append(fragment);
}
function renderMarkers() {
	const parent = $("#markers");
	parent.replaceChildren();
	const filtered = filteredListings();
	for (const l of filtered) {
		const p = project(l.lat, l.lon),
			type = types[l.kind] || types.solar;
		const el = document.createElement("button");
		el.type = "button";
		el.className = "marker " + l.kind + (state.selected === l.id ? " active" : "");
		el.style.left = p.x + "px";
		el.style.top = p.y + "px";
		el.title = `${l.name} · ${fmt(l.kind === "mcc" ? l.power_kw : l.energy_kwh)} ${type.unit}`;
		el.innerHTML = `<span class="marker-head"><span class="small-symbol">${type.glyph}</span>${fmt(l.kind === "mcc" ? l.power_kw : l.energy_kwh)}</span><span class="marker-label">${escapeHTML(l.name)}</span>`;
		el.addEventListener("click", (e) => {
			e.stopPropagation();
			selectListing(l.id);
		});
		parent.append(el);
	}
	if (filtered.length === 0) {
		$("#details-panel").innerHTML =
			'<div class="details-placeholder"><h3>No matching places</h3><p>Try changing your filters or search terms.</p></div>';
	}
}
function sampleSpark(listing) {
	const array = Array.from({length: 35}, (_, i) => {
		let v = 0;
		if (listing.kind === "solar") v = 11 + 38 * Math.max(0, Math.sin((i / 34) * Math.PI * 1.4));
		else if (listing.kind === "battery") v = 27 + 7 * Math.cos(i * 0.38) + i * 0.38;
		else if (listing.kind === "mcc") v = 20 + 14 * Math.sin((i / 34) * Math.PI * 2 + 0.65);
		else v = 20 + 15 * Math.cos((i / 34) * Math.PI * 2 + 2.5);
		return Math.max(4, v);
	});
	const coords = array.map((v, i) => `${((i / 34) * 300).toFixed(1)},${(74 - v * 1.08).toFixed(1)}`).join(" ");
	const col = types[listing.kind].color;
	return `<svg class="detail-chart" viewBox="0 0 300 80" preserveAspectRatio="none" aria-label="illustrative availability shape"><path d="M0 65H300" stroke="#e2eae3"/><polyline points="${coords}" stroke="${col}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function selectListing(id, shouldPan = true) {
	const l = state.listings.find((x) => x.id === id);
	if (!l) return;
	state.selected = l.id;
	renderMarkers();
	if (shouldPan) panToListing(l);
	const t = types[l.kind],
		volume = l.kind === "mcc" ? Number(l.power_kw) : Number(l.energy_kwh);
	const eligibility =
		l.kind === "mcc"
			? "MCC requires qualifying businesses and an approved GTO. Same-station connection not verified."
			: l.kind === "battery"
				? "Storage service, battery losses, taxes and supplier settlement must be checked."
				: "Electricity arrangements need compatible supplier settlement, metering and contracts.";
	const supplierMatch =
		state.profile?.supplier === l.supplier
			? "Provider name matches; participation is unverified"
			: "Supplier compatibility not checked";
	$("#details-panel").innerHTML =
		`<div class="detail-inner"><div class="detail-top"><span class="detail-badge ${l.kind}">${escapeHTML(t.glyph + " " + t.label)}</span><span class="status-chip">◌ Unverified</span></div>
     <h3>${escapeHTML(l.name)}</h3><div class="owner">⌖ Groningen · ${escapeHTML(l.owner)}</div>
     <div class="detail-amount"><span>${l.kind === "mcc" ? "POTENTIAL FLEXIBLE POWER" : l.kind === "battery" ? "AVAILABLE STORAGE (DEMO)" : l.kind === "solar" ? "FORECAST SURPLUS (DEMO)" : "FLEXIBLE ENERGY REQUEST"}</span><strong>${fmt(volume, 1)} ${t.unit}</strong><small>Future window: ${escapeHTML(l.window)}</small></div>
     <div class="two-detail"><div class="mini-info"><span>POWER / LIMIT</span><strong>${fmt(l.power_kw, 1)} kW</strong></div><div class="mini-info"><span>${l.kind === "mcc" ? "CONTRACT" : "INDICATIVE RATE"}</span><strong>${l.kind === "mcc" ? escapeHTML(l.connection || "Unknown") : euro(l.price) + "/kWh"}</strong></div><div class="mini-info"><span>ELECTRICITY PROVIDER</span><strong>${escapeHTML(l.supplier)}</strong></div><div class="mini-info"><span>NETWORK SEGMENT</span><strong>${escapeHTML(l.feeder === "Unknown" ? "Unverified" : l.feeder.replace("GRN-DEMO-", "Demo "))}</strong></div></div>
     ${sampleSpark(l)}<p class="detail-description">${escapeHTML(l.details || "Illustrative listing; participant eligibility is not verified.")}</p>
     <div class="detail-legal">⚠ ${escapeHTML(eligibility)}<br>${escapeHTML(supplierMatch)}</div>
     <div class="detail-action"><button class="button-primary" id="request-selected">Plan an opportunity ↗</button><button class="detail-secondary" id="see-selected-match">View AI match explanation</button></div></div>`;
	$("#request-selected").addEventListener("click", () => openRequest(l.id));
	$("#see-selected-match").addEventListener("click", () => {
		const m = state.matches.find((m) => m.listing_id === l.id);
		toast(m?.explanation || "Matching calculations are being loaded.");
	});
}
async function refreshBootstrap(keepSelection = true) {
	const boot = await api("/api/bootstrap");
	state.profile = boot.profile;
	state.listings = boot.listings;
	state.requests = boot.requests;
	if (!keepSelection || !state.selected || !state.listings.some((x) => x.id === state.selected))
		state.selected = "solar-2";
	renderStatistics();
	renderMarkers();
	selectListing(state.selected, false);
	renderProfileButton();
	const supplier = $("#supplier-select");
	supplier.replaceChildren();
	boot.providers.forEach((p) => {
		const opt = document.createElement("option");
		opt.value = p;
		opt.textContent = p;
		supplier.append(opt);
	});
	if (state.profile) loadProfileIntoForm();
	renderMyspace();
}
function renderProfileButton() {
	$("#profile-initial").textContent = state.profile?.name?.trim()?.[0]?.toUpperCase() || "+";
	$("#profile-btn").title = state.profile
		? `Edit ${state.profile.name}'s local demo profile`
		: "Create a local account";
}
async function loadMatches() {
	try {
		const x = await api("/api/matches?date=" + encodeURIComponent(state.date));
		state.matches = x.matches;
		renderMatches();
	} catch (err) {
		$("#match-grid").innerHTML = `<div class="empty-state">${escapeHTML(err.message)}</div>`;
	}
}
function renderMatches() {
	const ids = ["solar-2", "battery-2", "mcc-1"];
	const entries = ids
		.map((id) => ({l: state.listings.find((x) => x.id === id), m: state.matches.find((x) => x.listing_id === id)}))
		.filter((x) => x.l && x.m);
	$("#match-grid").innerHTML = entries
		.map(({l, m}) => {
			const type = types[l.kind];
			return `<article class="match-card"><div class="match-top"><div class="match-symbol" style="color:${type.color}">${type.glyph}</div><span class="match-type">${escapeHTML(type.label.toUpperCase())}</span></div><h3>${escapeHTML(m.title)}</h3><p>${escapeHTML(m.explanation)}</p><div style="font-size:10px;color:#268e77;font-weight:700;line-height:1.45">↔ ${escapeHTML(m.partner_name || "No partner found")}</div><div class="match-footer"><div><span class="match-value">${fmt(m.quantity, 1)} ${escapeHTML(m.unit)}</span><div style="font-size:10px;color:#89a095;margin-top:4px">Potential: ${euro(m.illustrative_value_eur)}*</div></div><button class="match-click" data-match="${escapeHTML(l.id)}">Explore ↗</button></div></article>`;
		})
		.join("");
	$$("#match-grid button[data-match]").forEach((btn) =>
		btn.addEventListener("click", () => {
			showPage("explore");
			selectListing(btn.dataset.match);
			window.scrollTo({top: 280, behavior: "smooth"});
		}),
	);
}
function showOverlay() {
	$("#overlay").hidden = false;
}
function closeDrawers() {
	$$(".drawer").forEach((x) => (x.hidden = true));
	$("#overlay").hidden = true;
	state.activeDrawer = null;
}
function openDrawer(id) {
	$("#sources-modal").hidden = true;
	closeDrawers();
	showOverlay();
	const el = $("#" + id);
	el.hidden = false;
	state.activeDrawer = id;
	const first = el.querySelector("input:not([type=hidden]),select");
	if (first) setTimeout(() => first.focus(), 50);
}
function openAccount() {
	if (state.profile) loadProfileIntoForm();
	$("#profile-error").textContent = "";
	openDrawer("account-drawer");
}
function openListing() {
	if (!state.profile) {
		toast("Create a local profile to publish a resource first.");
		openAccount();
		return;
	}
	if (!state.profile.share_public) {
		toast("Enable demo listing visibility in your account first.");
		openAccount();
		return;
	}
	$("#listing-error").textContent = "";
	openDrawer("listing-drawer");
}
function openRequest(id) {
	const l = state.listings.find((x) => x.id === id);
	if (!l) return;
	if (!state.profile) {
		state.pendingRequest = id;
		toast("Create a local profile before saving a planning request.");
		openAccount();
		return;
	}
	const t = types[l.kind];
	$("#request-summary").innerHTML =
		`<strong>${escapeHTML(l.name)}</strong>${escapeHTML(t.label)} • ${escapeHTML(l.window)}<br><span style="font-size:11px;color:#7a9887">Demo listing · No verified contract eligibility</span>`;
	const form = $("#request-form");
	form.elements.listing_id.value = l.id;
	form.elements.quantity.value = String(
		Math.max(0.1, Math.min(10, Number(l.kind === "mcc" ? l.power_kw : l.energy_kwh) || 10)),
	);
	form.elements.date.value = state.date;
	$("#request-unit").textContent = l.kind === "mcc" ? "kW" : "kWh";
	$("#request-error").textContent = "";
	openDrawer("request-drawer");
}
function loadProfileIntoForm() {
	const p = state.profile;
	if (!p) return;
	const form = $("#account-form");
	Object.entries(p).forEach(([key, val]) => {
		if (key === "roles") {
			Array.from(form.querySelectorAll('input[name="roles"]')).forEach((x) => (x.checked = val.includes(x.value)));
			return;
		}
		const el = form.elements.namedItem(key);
		if (!el) return;
		if (el instanceof RadioNodeList) {
			if (typeof val === "string") el.value = val;
			return;
		}
		if (el.type === "checkbox") el.checked = Boolean(val);
		else if (typeof val === "string" || typeof val === "number") el.value = val;
	});
}
function serializeForm(form) {
	const data = {};
	const fd = new FormData(form);
	for (const [k, v] of fd.entries()) {
		if (k === "roles") continue;
		data[k] = v;
	}
	data.roles = fd.getAll("roles");
	["share_public", "meter_consent", "acknowledged_simulation"].forEach((k) => {
		if (form.elements.namedItem(k)) data[k] = form.elements.namedItem(k).checked;
	});
	return data;
}
function initForms() {
	$("#account-form").addEventListener("submit", async (e) => {
		e.preventDefault();
		const form = e.currentTarget;
		const payload = serializeForm(form);
		$("#profile-error").textContent = "";
		try {
			await api("/api/profile", {method: "POST", body: JSON.stringify(payload)});
			await refreshBootstrap();
			closeDrawers();
			toast("Local account saved. Your information stays on this computer.");
			if (state.pendingRequest) {
				const id = state.pendingRequest;
				state.pendingRequest = null;
				openRequest(id);
			}
		} catch (err) {
			$("#profile-error").textContent = err.message;
		}
	});
	$("#listing-form").addEventListener("submit", async (e) => {
		e.preventDefault();
		const data = serializeForm(e.currentTarget);
		$("#listing-error").textContent = "";
		try {
			const result = await api("/api/listings", {method: "POST", body: JSON.stringify(data)});
			await refreshBootstrap();
			await loadMatches();
			closeDrawers();
			state.filter = "all";
			state.search = "";
			$("#map-search").value = "";
			$$("#filter-chips button").forEach((x) => x.classList.toggle("selected", x.dataset.filter === "all"));
			renderMarkers();
			selectListing(result.listing.id);
			showPage("explore");
			toast("Your new resource is visible in your local demonstration map.");
		} catch (err) {
			$("#listing-error").textContent = err.message;
		}
	});
	$("#request-form").addEventListener("submit", async (e) => {
		e.preventDefault();
		const data = serializeForm(e.currentTarget);
		$("#request-error").textContent = "";
		try {
			await api("/api/requests", {method: "POST", body: JSON.stringify(data)});
			await refreshBootstrap();
			closeDrawers();
			showPage("myspace");
			toast("Draft saved locally. Nothing has been sent, purchased or reserved.");
		} catch (err) {
			$("#request-error").textContent = err.message;
		}
	});
	$("#connection-select").addEventListener("change", (e) => {
		const a = e.target.value.match(/×\s*(\d+)\s*A/);
		if (a) $("#account-form").elements.connection_amps.value = a[1];
	});
	$("#profile-btn").addEventListener("click", openAccount);
	$("#start-listing").addEventListener("click", openListing);
	$("#edit-profile").addEventListener("click", openAccount);
	$("#myspace-add").addEventListener("click", openListing);
	$("#overlay").addEventListener("click", closeDrawers);
	$$("[data-close]").forEach((b) =>
		b.addEventListener("click", () => {
			closeDrawers();
			$("#sources-modal").hidden = true;
		}),
	);
	$("#sources-button").addEventListener("click", openSources);
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			closeDrawers();
			$("#sources-modal").hidden = true;
		}
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
			e.preventDefault();
			showPage("explore");
			$("#map-search").focus();
		}
	});
	$$(".nav-item").forEach((el) => el.addEventListener("click", () => showPage(el.dataset.page)));
	$("#open-intelligence").addEventListener("click", () => showPage("intelligence"));
	$("#scenario-date").addEventListener("change", async (e) => {
		state.date = e.target.value || "2026-11-12";
		$("#request-form").elements.date.value = state.date;
		await Promise.all([loadMatches(), loadForecast()]);
		toast("Showing a synthetic 2026 scenario, not a real-time energy forecast.");
	});
	$("#scenario-select").addEventListener("change", (e) => {
		state.mode = e.target.value;
		loadForecast();
	});
	$("#rerun-backtest").addEventListener("click", () => loadBacktest());
	$("#refresh-deals").addEventListener("click", () => loadDeals());
}
function renderMyspace() {
	const p = state.profile;
	if (!p) {
		$("#my-profile-content").innerHTML =
			`<div class="empty-state">No profile yet.<br><button class="text-link" id="create-from-myspace">Create your local account →</button></div>`;
		$("#create-from-myspace").addEventListener("click", openAccount);
	} else {
		$("#my-profile-content").innerHTML =
			`<div class="profile-data"><div><small>ACCOUNT TYPE</small><strong>${p.account_type === "person" ? "Individual" : "Business"}</strong></div><div><small>DISPLAY NAME</small><strong>${escapeHTML(p.name)}</strong></div><div><small>ENERGY PROVIDER</small><strong>${escapeHTML(p.supplier)}</strong></div><div><small>SUPPLY CONTRACT</small><strong>${escapeHTML(p.contract_type)}</strong></div><div><small>GRID CONNECTION</small><strong>${escapeHTML(p.connection_type || "Not specified")}</strong></div><div><small>TRANSPORT CAPACITY</small><strong>${p.contracted_kw ? fmt(p.contracted_kw, 1) + " kW" : "Not specified"}</strong></div><div><small>SOLAR CAPACITY</small><strong>${fmt(p.solar_kwp, 1)} kWp</strong></div><div><small>BATTERY</small><strong>${fmt(p.battery_kwh, 1)} kWh</strong></div><div><small>PUBLIC DEMO LISTINGS</small><strong>${p.share_public ? "Opted in" : "Not enabled"}</strong></div><div><small>NETWORK OPERATOR</small><strong>Enexis (indicative)</strong></div></div>`;
	}
	const mine = state.listings.filter((x) => x.local);
	$("#my-listings-content").innerHTML = mine.length
		? mine
				.map(
					(l) =>
						`<div class="my-list-row"><div><strong>${escapeHTML(l.name)}</strong><small>${escapeHTML(types[l.kind]?.label || l.kind)} · ${fmt(l.power_kw, 1)} kW</small></div><span class="detail-badge ${l.kind}">Demo</span></div>`,
				)
				.join("")
		: '<div class="empty-state">No user-created resources yet. Your demo map contains sample locations.</div>';
	$("#my-requests-content").innerHTML = state.requests.length
		? state.requests
				.map(
					(r) =>
						`<div class="request-row"><div><strong>${escapeHTML(r.listing_name)}</strong><small>${fmt(r.quantity, 1)} ${escapeHTML(r.unit)} · ${escapeHTML(r.date)} · ${escapeHTML(r.status)}</small></div><span class="status-chip">Draft #${r.id}</span></div>`,
				)
				.join("")
		: '<div class="empty-state" style="margin-top:15px">No requests yet. Explore the map and plan your first potential match.</div>';
}
function chartPath(numbers, max, width = 900, height = 260, x0 = 44, y0 = 22) {
	const peak = Math.max(max, 1);
	return numbers
		.map(
			(v, i) =>
				(i === 0 ? "M" : "L") +
				(x0 + (i / (numbers.length - 1)) * width).toFixed(1) +
				"," +
				(y0 + height * (1 - Math.max(0, v) / peak)).toFixed(1),
		)
		.join(" ");
}
function drawForecast(result) {
	const data = result.timeseries;
	const max = Math.max(result.feeder_limit_kw * 1.3, ...data.map((d) => Math.max(d.net_before, d.net_after))) * 1.06;
	const grid = Array.from({length: 5}, (_, i) => {
		const v = (i * max) / 4,
			y = 282 - (i * 260) / 4;
		return `<line x1="45" x2="950" y1="${y}" y2="${y}" stroke="#e5eee7" stroke-width="1"/><text x="36" y="${y + 4}" text-anchor="end" font-size="11" fill="#8d9d94">${Math.round(v)}</text>`;
	}).join("");
	const capY = 22 + 260 * (1 - result.feeder_limit_kw / max);
	const before = chartPath(
		data.map((x) => x.net_before),
		max,
		900,
		260,
		45,
		22,
	);
	const after = chartPath(
		data.map((x) => x.net_after),
		max,
		900,
		260,
		45,
		22,
	);
	const band = result.uncertainty_band_kw || 0;
	const upper = data.map((x) => x.net_after + band),
		lower = data.map((x) => Math.max(0, x.net_after - band));
	const polygon = upper
		.map(
			(v, i) =>
				`${(45 + (i / (data.length - 1)) * 900).toFixed(1)},${(22 + 260 * (1 - Math.max(0, v) / max)).toFixed(1)}`,
		)
		.concat(
			lower
				.map(
					(v, i) =>
						`${(45 + (i / (data.length - 1)) * 900).toFixed(1)},${(22 + 260 * (1 - Math.max(0, v) / max)).toFixed(1)}`,
				)
				.reverse(),
		)
		.join(" ");
	$("#forecast-chart").innerHTML = `<rect x="0" y="0" width="980" height="335" fill="white"/>${grid}
    <line x1="45" x2="945" y1="${capY.toFixed(1)}" y2="${capY.toFixed(1)}" stroke="#fc806f" stroke-width="2" stroke-dasharray="7 7"/>
    <polygon points="${polygon}" fill="#72d4ad" opacity=".18"/><path d="${before}" stroke="#b9c9c2" stroke-width="2.7" fill="none" stroke-linejoin="round"/>
    <path d="${after}" stroke="#169b7c" stroke-width="3.6" fill="none" stroke-linejoin="round"/>
    <text x="950" y="${capY - 8}" fill="#db806f" font-size="11" text-anchor="end">Feeder limit</text>`;
	const beforeM = result.before,
		afterM = result.after;
	const cards = [
		{
			label: "Estimated daily saving",
			number: euro(result.savings_eur),
			note: "Versus no coordination · demonstration",
			good: result.savings_eur > 0,
		},
		{
			label: "Peak reduction",
			number: fmt(result.peak_reduction_kw, 1) + " kW",
			note: "Maximum projected net import",
			good: result.peak_reduction_kw > 0,
		},
		{
			label: "Constraint exceedances",
			number: fmt(afterM.overload_hours, 2) + " h",
			note: `Before: ${fmt(beforeM.overload_hours, 2)} h · 325 kW cap`,
			good: afterM.overload_hours < beforeM.overload_hours,
		},
		{
			label: "Battery energy output",
			number: fmt(result.storage_discharged_kwh, 1) + " kWh",
			note: `Charging: ${fmt(result.storage_charged_kwh, 1)} kWh · losses included`,
			good: false,
		},
		{
			label: "Solar on-site use proxy",
			number: fmt(afterM.solar_self_use_proxy_kwh, 1) + " kWh",
			note: "Synthetic estimate · not measured avoided curtailment",
			good: false,
		},
		{
			label: "CO₂e change (proxy)",
			number: fmt(result.co2_proxy_delta_kg, 1) + " kg",
			note: "Assumed hourly factors · not verified Dutch emissions",
			good: result.co2_proxy_delta_kg > 0,
		},
	];
	$("#metric-four").innerHTML = cards
		.map(
			(c) =>
				`<div class="metric-mini"><span>${escapeHTML(c.label)}</span><strong class="${c.good ? "positive" : ""}">${escapeHTML(c.number)}</strong><small>${escapeHTML(c.note)}</small></div>`,
		)
		.join("");
}
async function loadForecast() {
	try {
		const response = await api(
			"/api/forecast?date=" + encodeURIComponent(state.date) + "&mode=" + encodeURIComponent(state.mode),
		);
		state.forecast = response;
		drawForecast(response);
		if (state.page === "intelligence") loadDeals();
	} catch (err) {
		toast(err.message);
	}
}
async function loadDeals() {
	try {
		const result = await api("/api/deals?date=" + encodeURIComponent(state.date));
		const data = result.deals
			.slice()
			.sort((a, b) => b.gross_opportunity_eur - a.gross_opportunity_eur)
			.slice(0, 10);
		$("#deals-table tbody").innerHTML = data
			.map(
				(r) =>
					`<tr><td><strong>${escapeHTML(r.participant)}</strong></td><td>${escapeHTML(r.partner)}</td><td>${fmt(r.quantity, 1)} ${escapeHTML(r.unit)}</td><td>${euro(r.gross_opportunity_eur)}</td><td style="font-size:11px;color:#759183">${escapeHTML(r.status)}</td></tr>`,
			)
			.join("");
	} catch (err) {
		$("#deals-table tbody").innerHTML = `<tr><td colspan="5">${escapeHTML(err.message)}</td></tr>`;
	}
}
async function loadBacktest() {
	try {
		const result = await api("/api/backtest");
		state.backtest = result;
		$("#mae-load").textContent = fmt(result.forecast_mae_kw.load, 2) + " kW";
		$("#mae-solar").textContent = fmt(result.forecast_mae_kw.solar, 2) + " kW";
		const maxCost = Math.max(...result.scores.map((s) => s.cost_eur));
		$("#benchmark-table tbody").innerHTML = result.scores
			.map(
				(x) =>
					`<tr class="${x.key === "gridshare_ai" ? "highlight-row" : ""}"><td>${escapeHTML(x.label)} ${x.key === "gridshare_ai" ? "✦" : ""}</td><td>${euro(x.cost_eur)}</td><td>${fmt(x.peak_kw, 1)} kW</td><td>${fmt(x.overload_hours, 2)} h</td><td>${euro(x.savings_vs_baseline_eur)}</td></tr>`,
			)
			.join("");
		$("#benchmark-bars").innerHTML = result.scores
			.map(
				(x) =>
					`<div class="benchmark-bar-row"><strong>${escapeHTML(x.label)}</strong><div class="bar-bg"><div class="bar-fill ${x.key === "gridshare_ai" ? "ai" : ""}" style="width:${Math.max(0, (100 * x.cost_eur) / maxCost).toFixed(1)}%"></div></div><span>${euro(x.cost_eur)}</span></div>`,
			)
			.join("");
	} catch (err) {
		toast(err.message);
	}
}
async function openSources() {
	$("#sources-modal").hidden = false;
	showOverlay();
	try {
		const data = await api("/api/sources");
		$("#sources-list").innerHTML = data.sources
			.map(
				(s) =>
					`<div class="source-entry"><a href="${escapeHTML(s.url)}" target="_blank" rel="noopener">${escapeHTML(s.name)} ↗</a><p>${escapeHTML(s.note)}</p></div>`,
			)
			.join("");
	} catch (err) {
		$("#sources-list").textContent = err.message;
	}
}
async function init() {
	initMapControls();
	initForms();
	addOSMTiles();
	fitMap();
	try {
		await refreshBootstrap(false);
		await Promise.all([loadMatches(), loadForecast()]);
	} catch (err) {
		toast(err.message);
		$("#details-panel").innerHTML =
			`<div class="details-placeholder"><h3>Local server unavailable</h3><p>${escapeHTML(err.message)}</p><p>Start with <strong>python app.py --open</strong>.</p></div>`;
	}
}
init();
