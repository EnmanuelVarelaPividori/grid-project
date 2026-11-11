# Local demo HTTP API

The local server is intentionally lightweight. It accepts JSON on localhost only.

- `GET /api/health` — state (synthetic/offline mode)
- `GET /api/bootstrap` — sample Groningen listings, local profile, draft requests, providers
- `POST /api/profile` — create or replace a **local**, unverified profile; requires acknowledgment
- `POST /api/listings` — create a demo listing after local profile and public-demo opt-in
- `POST /api/requests` — save a draft planning request; makes no external transfer
- `GET /api/forecast?date=2026-11-12&mode=gridshare_ai` — daily synthetic 15-minute forecast and optimization
- `GET /api/matches?date=2026-11-12` — recommended candidate partners, overlap and reason
- `GET /api/deals?date=2026-11-12` — per-participant deal comparisons
- `GET /api/backtest` — benchmark four methods against two held-out weeks
- `GET /api/sources` — official reference links with usage limitations

Allowed scenario modes: `no_coord`, `best_solo`, `rule_based`, `gridshare_ai`.

All API date inputs are scoped to the **2026 synthetic demo year**. A future real implementation needs secure multiuser sessions, authorizations, transaction IDs, settlement and non-repudiation.
