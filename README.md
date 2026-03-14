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

## MVP Limits

- One Piece ingestion only in phase 1
- Scrape source is best-effort and may return partial runs
