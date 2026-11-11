export function Brand() {
	return (
		<a aria-label="GridShare home" className="logo" href="/">
			<svg aria-hidden="true" height="28" viewBox="0 0 24 24" width="28">
				<rect fill="#4a7a35" height="9" rx="2" width="9" x="2" y="2" />
				<rect fill="#4a7a35" height="9" opacity=".55" rx="2" width="9" x="13" y="2" />
				<rect fill="#4a7a35" height="9" opacity=".55" rx="2" width="9" x="2" y="13" />
				<rect fill="#4a7a35" height="9" rx="2" width="9" x="13" y="13" />
			</svg>
			<span>
				gridshare<span className="brand-dot">.</span>
			</span>
		</a>
	);
}

export function Icon({name, size = 20}) {
	const paths = {
		solar: (
			<>
				<circle cx="12" cy="12" r="4" />
				<path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
			</>
		),
		battery: (
			<>
				<rect height="14" rx="2" width="17" x="2" y="5" />
				<path d="M21 10v4M6 9v6m4-6v6m4-6v6" />
			</>
		),
		mcc: (
			<>
				<path d="M13 2 4 14h7l-1 8 10-13h-8z" />
			</>
		),
		demand: (
			<>
				<path d="M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-6 6v5m-2-5h2" />
			</>
		),
		explore: (
			<>
				<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16" />
			</>
		),
		intelligence: (
			<>
				<path d="M3 19h18M5 15l4-5 4 3 6-9" />
				<path d="M15 4h4v4" />
			</>
		),
		backtest: (
			<>
				<path d="M3 21h18M6 16V9m6 7V3m6 13v-5" />
			</>
		),
		myspace: (
			<>
				<circle cx="12" cy="8" r="4" />
				<path d="M4 22v-3a8 8 0 0 1 16 0v3" />
			</>
		),
		info: (
			<>
				<circle cx="12" cy="12" r="9" />
				<path d="M12 11v6m0-10v1" />
			</>
		),
	};
	return (
		<svg
			aria-hidden="true"
			fill="none"
			height={size}
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="1.6"
			viewBox="0 0 24 24"
			width={size}>
			{paths[name] ?? paths.intelligence}
		</svg>
	);
}
