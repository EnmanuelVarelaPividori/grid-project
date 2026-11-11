import {X} from "lucide-react";
import {useEffect, useRef} from "react";
import {Icon} from "./brand.jsx";
import {Badge} from "./ui/badge";
import {Button} from "./ui/button";
import {Card, CardHeader, CardTitle, CardDescription, CardContent} from "./ui/card";
export const money = (value) => new Intl.NumberFormat("en-NL", {style: "currency", currency: "EUR"}).format(value);
export function ChosenDeals({open, onOpenChange, deals, onChoose, title = "Chosen deals"}) {
	const panel = useRef(null);
	useEffect(() => {
		if (open) panel.current?.focus({preventScroll: true});
	}, [open]);
	if (!open) return null;
	return (
		<Card
			ref={panel}
			aria-label={title}
			className="map-deals-island"
			role="region"
			tabIndex={-1}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.stopPropagation();
					onOpenChange(false);
				}
			}}>
			<CardHeader>
				<div className="map-deals-heading">
					<CardTitle>{title}</CardTitle>
					<Button aria-label="Close deals panel" size="icon" variant="ghost" onClick={() => onOpenChange(false)}>
						<X size={15} />
					</Button>
				</div>
				<CardDescription>
					{deals.some((deal) => deal.preview)
						? "Your automatically prepared demo plan. Benefits are estimates; no deals have been booked."
						: "Your latest saved drafts. Benefits are estimates; no deals have been booked."}
				</CardDescription>
			</CardHeader>
			<CardContent className="map-deals-island-body">
				{deals.length ? (
					<div className="chosen-deal-list">
						{deals.map((deal) => (
							<Button
								key={deal.id}
								className="chosen-deal-row"
								disabled={!deal.resource}
								variant="outline"
								onClick={() => onChoose(deal)}>
								<span className="chosen-deal-icon">
									<Icon name={deal.resource?.kind} />
								</span>
								<span className="chosen-deal-copy">
									<strong>{deal.listing_name}</strong>
									<small>
										{deal.date} · {deal.quantity} {deal.unit}
									</small>
									<small>{deal.resource ? "View on map" : "Location no longer available"}</small>
								</span>
								<span className="chosen-deal-benefit">
									<strong>{deal.estimate === null ? "—" : money(deal.estimate)}</strong>
									<small>estimated savings</small>
									<Badge variant="secondary">
										{deal.preview ? (deal.review ? "Supplier review" : "Planned") : "Draft"}
									</Badge>
								</span>
							</Button>
						))}
					</div>
				) : (
					<div className="chosen-deals-empty">
						<Icon name="explore" size={28} />
						<h3>No deals yet</h3>
						<p>Your plan will appear here when local opportunities are available.</p>
						<Button onClick={() => onOpenChange(false)}>Explore resources</Button>
					</div>
				)}
				<p className="chosen-deals-note">
					Planned locations stay visible when you filter the map. Older drafts may not have a saved estimate.
				</p>
			</CardContent>
		</Card>
	);
}
