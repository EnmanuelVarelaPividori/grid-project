# GridShare features: what's implemented and what is still missing

**Implemented and interactive locally**

| Requirement                                                             | Status                                                       | Location                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------- |
| VOI-style clickable Groningen energy map                                | Working (schematic offline; real OSM basemap online)         | Explore                   |
| Four map pin categories, cards, filter, search                          | Working                                                      | Explore                   |
| Individual / business inline registration                               | Working local demo, no real authentication                   | Profile drawer            |
| Supplier, fixed / variable / dynamic contract, A and contracted kW      | Working                                                      | Profile drawer            |
| Data sharing / visibility choice                                        | Working for local publishing; not production privacy backend | Profile drawer            |
| Solar, battery, demand, MCC resource listings                           | Working local demo                                           | Publish drawer            |
| Match requests and future scheduling                                    | Draft records only; not actual bookings                      | Request drawer / My space |
| Predicted demand, production and storage context                        | Trained synthetic model                                      | Intelligence / engine     |
| Match seller/buyer on time windows, provider label and location         | Demonstration scoring                                        | Explore / deals table     |
| MCC cluster group / feeder limits and connection class                  | Synthetic network; not actual Enexis authorization           | engine / sample listings  |
| Battery power, kWh, SoC and efficiency                                  | Working simulation                                           | engine/model.py           |
| Price / scenario comparison                                             | Illustrative EUR                                             | Intelligence              |
| No coordination / best solo / rules / AI heuristic                      | Implemented on same test data                                | Backtesting               |
| Train excluding two held-out weeks                                      | Implemented                                                  | engine/model.py           |
| 15-minute complete synthetic year, standard profiles, synthetic weather | Included                                                     | data/                     |
| Forecast uncertainties                                                  | Indicative MAE-derived band, not calibrated coverage         | Intelligence              |
| Compare candidate best deal per participant                             | Implemented                                                  | Intelligence              |
| Solar use / peak / cost / CO2 proxy metrics                             | Implemented; synthetic, not real-world claims                | Intelligence              |
| Official capacity map                                                   | Opens official website (not copied / scraped)                | Sidebar                   |
| Public Groningen GIS cables                                             | Optional online published ArcGIS image, not live capacity    | Explore                   |
| FlexMeasures open source pathway                                        | Adapter/documentation only, inactive                         | integrations/ + docs      |

**Not yet built / not possible without partners**

- Real shared SURF Research Cloud environment (requires team's access and secure deployment).
- Real identity or enterprise multi-user authentication, eID, connection ownership validation.
- Live Enexis capacity, feeder segmentation, physical transfer eligibility and real line loading.
- Actual smart-meter integration / consumption consent mechanism.
- Supplier-backed energy sharing settlements, invoices, taxes and net-contract checks.
- Genuine third-party neighborhood battery storage / retrieval rights or payments.
- Real MCC/GTO grouping, legal association, business agreements and operator authorization.
- FlexMeasures server deployment and authenticated, approved real-device connection.
- Payments, bank accounts, fraud prevention, liability and disputes.
- Meaningful external pilot data, human interviews, commercial willingness-to-pay evidence.
- Validated emissions reduction / renewable curtailment outcomes.

**Out of scope by user request:** communication-team deliverables (personas, glossary, pitch preparation, participant interviews if allocated to communication). Technical test/validation readiness is included; interviews are not implemented as app features.
