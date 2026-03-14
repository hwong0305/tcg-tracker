# CardTracker Core

## Workspace Setup

1. `bun install`
2. Copy `.env.example` to `.env`
3. Run `bun test apps/api/test/smoke.test.ts`

## Local Setup

```bash
bun install
cp .env.example .env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cardtracker bunx drizzle-kit generate --config packages/data/drizzle.config.ts
```

## Docker Compose (Full Stack)

```bash
docker compose up --build -d
docker compose ps
curl http://localhost:3000/health
curl http://localhost:3000/dashboard
```

The API container runs `drizzle-kit push` on startup, so schema setup is automatic when using compose.

Stop and clean up:

```bash
docker compose down
```

## Run Commands

```bash
bun run dev:api
bun run dev:web
bun test
bun --cwd apps/web run test
```

## Frontend/API Connectivity (Dev)

- Preferred local setup: run `bun run dev:api` and `bun run dev:web` together, and keep `VITE_API_BASE_URL` unset/empty so Vite proxy forwards `/dashboard` and `/jobs` to `http://localhost:3000`.
- If you set `VITE_API_BASE_URL` to a full API origin (for example `http://localhost:3000`), browser CORS applies and API must allow your web origin via `CORS_ORIGINS` (for example `http://localhost:5173,http://127.0.0.1:5173`).
- `CORS_ORIGINS` is configured in `.env` as a comma-separated allowlist.

## CI Checks

GitHub Actions runs:

- `bun install`
- `drizzle-kit push` against PostgreSQL service
- `bun test apps/api packages`
- `bun run test` in `apps/web`
- compose smoke checks for `/health` and `/dashboard`

## Job Endpoints

```bash
curl -X POST http://localhost:3000/jobs/ingest/onepiece
curl -X POST http://localhost:3000/jobs/ingest/onepiece -H "content-type: application/json" -d '{"devSeed":true}'
curl -X POST http://localhost:3000/jobs/scrape/prices -H "content-type: application/json" -d '{"setIds":["s1"]}'
curl -X POST http://localhost:3000/jobs/recompute/flags
curl http://localhost:3000/jobs/<jobId>
```

`devSeed: true` is a local development fallback that seeds sample One Piece sets/cards when upstream ingestion is unavailable.

## Dashboard Filters

- UI filter key: `set`
- API query param: `setId`
- Other filters: `printStatus`, `tcgType`, `rarity`, `chaseOnly`
- Presets: `Store Hunter` and `Vault`

## Card Ingest Source

The ingest job fetches cards from three upstream endpoints in sequence:
1. `GET ${ONEPIECE_API_BASE_URL}/api/allSetCards/` (booster/expansion sets)
2. `GET ${ONEPIECE_API_BASE_URL}/api/allSTCards/` (starter decks)
3. `GET ${ONEPIECE_API_BASE_URL}/api/allPromos/` (promo cards)

Default base URL: `https://www.optcgapi.com`. Rows are deduplicated by `card_set_id` — when the same card appears in multiple sources, the row with the latest `date_scraped` is kept. Ingest stats report `totalFetched`, `duplicatesRemoved`, and `invalidRows`.

## Theme Support

The dashboard UI supports `system`, `light`, and `dark` themes. The user's choice is stored in `localStorage` (`cardtracker-theme`). In `system` mode the UI follows the OS `prefers-color-scheme` and reacts to live changes. Invalid stored values fall back to `system`.

## MVP Limits

- One Piece ingestion only in phase 1
- Scrape source is best-effort and may return partial runs
