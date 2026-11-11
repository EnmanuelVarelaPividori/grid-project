/** Recent persisted requests only; never substitute recommended deals for user choices. */
export function chosenDeals(requests, listings) {
	return [...requests]
		.sort((a, b) => Number(b.id) - Number(a.id))
		.slice(0, 8)
		.map((request) => ({
			...request,
			resource: listings.find((listing) => listing.id === request.listing_id) ?? null,
			estimate:
				typeof request.estimated_savings_eur === "number" && Number.isFinite(request.estimated_savings_eur)
					? request.estimated_savings_eur
					: null,
		}));
}
