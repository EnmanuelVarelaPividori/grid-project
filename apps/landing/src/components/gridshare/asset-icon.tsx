import {House, PlugConnection, Sun} from "@gravity-ui/icons";
import type {Asset} from "@/lib/autopilot";

export function AssetIcon({asset, size = 18}: {asset: Asset; size?: number}) {
	if (asset === "solar") return <Sun height={size} width={size} />;
	if (asset === "ev") return <PlugConnection height={size} width={size} />;
	if (asset === "business") return <House height={size} width={size} />;
	return (
		<svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
			{asset === "battery" ? (
				<>
					<rect height="11" rx="2" stroke="currentColor" strokeWidth="1.6" width="17" x="2" y="6.5" />
					<path d="M22 10v4M7 10v4m4-4v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
				</>
			) : (
				<>
					<path d="M9 14.5V5a3 3 0 0 1 6 0v9.5a5 5 0 1 1-6 0Z" stroke="currentColor" strokeWidth="1.6" />
					<path d="M12 8v10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
					<circle cx="12" cy="18" fill="currentColor" r="2" />
				</>
			)}
		</svg>
	);
}

export function Brand({small = false}: {small?: boolean}) {
	return (
		<span className={`gs-brand ${small ? "gs-brand-small" : ""}`}>
			<span aria-hidden="true" className="gs-brand-mark">
				<i />
				<i />
				<i />
				<i />
			</span>
			gridshare<span>.</span>
		</span>
	);
}
