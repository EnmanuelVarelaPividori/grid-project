/** Read-only preview from model suggestions. These are never booked or persisted as user choices. */
export function autopilotPlan(matches, listings, date) {
	return matches
		.filter((match) => match.quantity > 0 && match.partner_id)
		.slice(0, 8)
		.map((match, index) => {
			const resource = listings.find((item) => item.id === match.listing_id);
			return {
				id: 1000 - index,
				listing_id: match.listing_id,
				listing_name: resource?.name ?? "Local resource",
				quantity: match.quantity,
				unit: match.unit,
				date,
				estimated_savings_eur: match.illustrative_value_eur,
				status: "Planned · demo",
				preview: true,
				partner: match.partner_name,
				explanation:
					resource?.kind === "solar"
						? `Use ${match.quantity} ${match.unit} of local solar with ${match.partner_name} while it’s available, so less energy needs to come from the grid.`
						: resource?.kind === "battery"
							? `Store ${match.quantity} ${match.unit} of solar energy from ${match.partner_name} during available hours. This is a possible charging plan, rather than a confirmed battery schedule.`
							: `Move ${match.quantity} ${match.unit} of flexible demand into available hours alongside ${match.partner_name}, helping spread the neighbourhood’s energy use.`,
				window: resource?.window ?? "Flexible hours",
				kind: resource?.kind ?? "solar",
				review: match.compatibility?.startsWith("Different supplier") ?? false,
			};
		});
}
