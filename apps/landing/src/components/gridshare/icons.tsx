import {iconPaths} from "@/lib/autopilot";
import type {ActionKind} from "@/lib/autopilot";

export function KindIcon({kind, size = 15}: {kind: ActionKind; size?: number}) {
	return (
		<svg
			aria-hidden="true"
			fill="none"
			height={size}
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2"
			viewBox="0 0 24 24"
			width={size}>
			<path d={iconPaths[kind]} />
		</svg>
	);
}

export function CheckIcon({size = 16}: {size?: number}) {
	return (
		<svg
			aria-hidden="true"
			fill="none"
			height={size}
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth="2.2"
			viewBox="0 0 24 24"
			width={size}>
			<path d="m5 12 4 4 10-10" />
		</svg>
	);
}

export function Brand({small = false}: {small?: boolean}) {
	return (
		<span className={small ? "gs-brand gs-brand-small" : "gs-brand"}>
			{!small && (
				<svg aria-hidden="true" height="24" viewBox="0 0 24 24" width="24">
					<rect fill="#4A7A35" height="9" rx="2" width="9" x="2" y="2" />
					<rect fill="#4A7A35" height="9" opacity=".55" rx="2" width="9" x="13" y="2" />
					<rect fill="#4A7A35" height="9" opacity=".55" rx="2" width="9" x="2" y="13" />
					<rect fill="#4A7A35" height="9" rx="2" width="9" x="13" y="13" />
				</svg>
			)}
			<span className="gs-display">
				gridshare<span className="gs-brand-dot">.</span>
			</span>
		</span>
	);
}
