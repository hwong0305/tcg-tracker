# CardTracker Core MVP Design

## 1. Scope and Goal

CardTracker Core is a Bun-based web app for TCG collectors focused on identifying:

- Chase cards for One Piece TCG (phase 1)
- Set print status (`in-print` vs `out-of-print`)

This MVP implements a complete data pipeline using free sources only, with a single-page dashboard and filter-based views.

### In Scope (MVP)

- Bun runtime project with Elysia API and Vite + React frontend
- PostgreSQL as primary store via Drizzle ORM
- One Piece API ingestion from `https://optcg-api.com/`
- Price scraping with Playwright from PriceCharting (on-demand, cron-ready)
- Automated print-status and chase-card classification logic
- Single-page dashboard where in-print/OOP are filters (not separate pages)

### Out of Scope (MVP)

- Full Pokémon ingestion (stubbed integration boundary only)
- Historical trend charting beyond snapshot support fields
- Distributed worker infrastructure

## 2. Architectural Approach

Recommended approach: domain-first monolith in a Bun workspace.

Rationale:

- Fastest route to working end-to-end MVP
- Maintains strong modular boundaries for later service extraction
- Minimizes early operational complexity

### Repository Layout

```text
apps/
  api/                      # Elysia HTTP API + job triggers
  web/                      # Vite + React + Tailwind single-page dashboard
packages/
  core/                     # Pure business logic and shared interfaces
  data/                     # Drizzle schema, migrations, repositories
  providers/                # External adapters (One Piece, PriceCharting, Pokemon placeholder)
  jobs/                     # Ingest/scrape/recompute orchestrators
infra/
  docker/                   # Local Postgres bootstrap assets
docs/
  superpowers/specs/        # Design and planning docs
```

### Module Responsibilities

- `packages/core`
  - `updateSetStatus()` print status logic
  - `updateChaseFlags()` chase classification logic
  - Normalized domain interfaces and scoring helpers
- `packages/data`
  - Drizzle schema and migrations
  - Repository APIs for upsert/query operations
- `packages/providers`
  - `onepiece` adapter for API calls + normalization
  - `pricecharting` Playwright scraper adapter
  - `pokemon` placeholder adapter interface for phase 2
- `packages/jobs`
  - Orchestrates ingest, scrape, and recompute steps
- `apps/api`
  - Exposes data read endpoints + job trigger endpoints
- `apps/web`
  - Renders one dashboard with filter controls and saved presets

## 3. Data Model

Initial schema follows the provided tables, with required source identity fields for deterministic upserts:

```sql
CREATE TABLE sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tcg_type TEXT NOT NULL,
    source_set_id TEXT NOT NULL,
    set_name TEXT NOT NULL,
    release_date DATE,
    msrp_pack_price DECIMAL(10,2) DEFAULT 4.49,
    current_box_price DECIMAL(10,2),
    is_out_of_print BOOLEAN DEFAULT false,
    data_quality TEXT DEFAULT 'stale',
    last_scraped TIMESTAMP DEFAULT now(),
    UNIQUE(tcg_type, source_set_id)
);

CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID NOT NULL REFERENCES sets(id),
    source_card_id TEXT NOT NULL,
    card_name TEXT,
    rarity TEXT,
    market_price DECIMAL(10,2),
    is_chase BOOLEAN DEFAULT false,
    image_url TEXT,
    last_price_updated TIMESTAMP,
    UNIQUE(set_id, source_card_id)
);
```

Required conflict targets for idempotent repositories:

- sets: `ON CONFLICT (tcg_type, source_set_id)`
- cards: `ON CONFLICT (set_id, source_card_id)`

These constraints are mandatory for idempotent job behavior and duplicate prevention.

## 4. Data Flow and Job Flow

### 4.0 Job Persistence (Required for Async API)

Because job endpoints return `202` and expose `GET /jobs/:jobId`, MVP requires persisted job runs.

```sql
CREATE TABLE job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    request_payload_json JSONB,
    stats_json JSONB,
    errors_json JSONB,
    requested_at TIMESTAMP NOT NULL DEFAULT now(),
    started_at TIMESTAMP,
    finished_at TIMESTAMP
);
```

MVP execution model:

- In-process async execution within API service after job creation
- Status lifecycle: `queued -> running -> completed|partial|failed`
- Job state is read from `job_runs` by `GET /jobs/:jobId`

### 4.1 Ingestion Flow (One Piece First)

1. Fetch sets/cards from `optcg-api.com`
2. Normalize into internal DTOs (`NormalizedSet`, `NormalizedCard`)
3. Upsert into Postgres via repositories

### 4.2 Price Enrichment Flow

1. Trigger on-demand scrape via API or CLI
2. Playwright scraper visits PriceCharting targets
3. Extract top-value signals and box/sealed pricing where available
4. Persist prices and update `last_scraped`

### 4.3 Classification Flow

After ingestion/enrichment, recompute:

- `updateSetStatus()`
  - Reference date is `today_utc = (now() AT TIME ZONE 'UTC')::date`.
  - Age rule: OOP if `release_date <= (today_utc - INTERVAL '24 months')`.
  - Price rule input: use `current_box_price` only when non-null.
  - MSRP baseline for sealed box is `140.00` (per project instruction).
  - Price threshold rule: OOP if `current_box_price > 196.00` (`140 * 1.40`).
  - In-print helper signal: if set age is under 24 months and `current_box_price < 168.00` (`140 * 1.20`), classify as in-print.
  - Null semantics: if `current_box_price` is null, do not flip status based on price rule; rely on age rule or preserve previous status.
- `updateChaseFlags()`
  - Pack-price precedence for 10x rule:
    1. scraped pack price for set (if available)
    2. `sets.msrp_pack_price`
    3. fallback `4.49`
  - 10x rule: chase if `market_price > (pack_price * 10)`.
  - Mark chase if any condition is true:
    - market value > 10x booster pack price
    - rarity in `Special Illustration Rare`, `Alt Art`, `Manga Rare`
    - card in top 5% market value within its set using `PERCENT_RANK() >= 0.95`
  - Percentile tie policy: if multiple cards share the boundary value at `0.95`, include all tied cards as chase.
  - Null semantics: cards with null `market_price` are excluded from percentile and 10x checks but can still qualify by rarity.

### 4.4 API Surface (MVP)

- `GET /health`
- `GET /dashboard` (aggregated sets/cards payload)
- `POST /jobs/ingest/onepiece`
- `POST /jobs/scrape/prices`
- `POST /jobs/recompute/flags`

Minimal contracts:

- `GET /health`
  - `200` => `{ "ok": true, "service": "cardtracker-core", "timestamp": "..." }`
- `GET /dashboard`
  - Query: `printStatus?`, `tcgType?`, `setId?`, `rarity?`, `chaseOnly?`
  - `200` => `{ "sets": [...], "cards": [...], "meta": { "generatedAt": "..." } }`
- `POST /jobs/ingest/onepiece`
  - Body: optional `{ "setIds": string[] }`
  - `202` => `{ "jobId": "...", "status": "queued" }`
- `POST /jobs/scrape/prices`
  - Body: `{ "setIds"?: string[], "cardIds"?: string[] }`
  - Target resolution:
    - if both `setIds` and `cardIds` exist: process union of both target groups
    - dedupe target cards by `source_card_id`
    - if body is empty: process all tracked One Piece sets/cards with batch cap `N=200` per run
  - `202` => `{ "jobId": "...", "status": "queued" }`
- `POST /jobs/recompute/flags`
  - Body: optional `{ "setIds": string[] }`
  - `202` => `{ "jobId": "...", "status": "queued" }`

Job status endpoint:

- `GET /jobs/:jobId`
  - `200` => `{ "jobId": "...", "type": "...", "status": "queued|running|completed|failed|partial", "stats": { ... }, "errors": [...] }`

Equivalent CLI scripts should exist for local operation and automation readiness.

## 5. Frontend Design (Single Page)

Single dashboard page with filter-driven views.

### Core UX

- Shared list/cards view for sets and chase highlights
- In-print and OOP are filters, not routes
- Saved filter presets:
  - `Store Hunter` preset => `printStatus = in-print`
  - `Vault` preset => `printStatus = out-of-print`

### Baseline Filters

- `printStatus: all | in-print | out-of-print`
- `tcgType`
- `set`
- `rarity`
- `chaseOnly`

The page initially applies filtering client-side from one fetched dataset; server-side filtering can be added later without breaking UI contracts.

## 6. Error Handling and Resilience

### Provider Boundaries

- Validate and map external payloads at adapter boundaries
- Return structured adapter errors with `code`, `source`, `entity`, `reason`, `retryable`

### Idempotent Jobs

- Use upserts for sets/cards to avoid duplication
- Re-running jobs updates existing rows safely

### Scraper Robustness

- Randomized user-agent/header profile per run
- Timeout and bounded retry with backoff
  - `maxAttempts = 3` (initial + 2 retries)
  - backoff: 1s, then 3s
- Partial success handling: continue processing even if subset fails

### Partial Success Reporting

- Each job run reports:
  - `totalTargets`
  - `succeeded`
  - `failed`
  - `status` (`completed`, `partial`, `failed`)
- Terminal failure criteria:
  - mark `completed` when `totalTargets = 0` (no-op run)
  - mark `failed` only when `totalTargets > 0` and `succeeded = 0`
  - mark `partial` when `succeeded > 0` and `failed > 0`

### Status Safety

- Never flip print status from missing/empty price data alone
- Preserve prior status and mark freshness/quality indicators

### API Stability

- Keep response shape stable on partial failures
- Include freshness metadata (`last_scraped`, `data_quality`)

## 7. Testing Strategy

### Unit Tests

- Print status rule cases around 24-month and MSRP thresholds
- Chase rule cases: 10x threshold, rarity tiers, percentile logic

### Integration Tests

- Repository tests against test Postgres schema
- Adapter contract tests with fixture payloads for One Piece API

### Scraper Verification

- Smoke test with deterministic target
- Mocked fallback path for CI stability

## 8. MVP Acceptance Criteria

MVP is complete when:

1. One Piece sets and cards can be ingested into Postgres via API/CLI trigger
2. Price scrape job stores latest pricing signals for tracked entities and returns job stats (`totalTargets`, `succeeded`, `failed`, `status`)
3. Recompute job updates `is_out_of_print` and `is_chase` deterministically against fixtures:
   - Fixture A: release date older than 24 months => `is_out_of_print = true`
   - Fixture B: `current_box_price = 200` with MSRP box `140` => `is_out_of_print = true`
   - Fixture C: card with `market_price = 49` and pack price `4.49` => `is_chase = true`
   - Fixture D: card in top 5% percentile of set values => `is_chase = true`
4. Dashboard is a single page and supports in-print/OOP filtering without route changes
5. Partial scrape failures do not abort the entire processing run and produce `partial` status when at least one target succeeds

## 9. Implementation Notes and Sequencing

Recommended build order:

1. Workspace scaffolding + shared TypeScript config
2. Drizzle schema/migrations + DB connection layer
3. One Piece provider + normalization + ingest job
4. PriceCharting scraper + scrape job orchestration
5. Classification rules and recompute job
6. Elysia endpoints
7. Single-page dashboard + filters and presets

This keeps the project vertical and testable at each checkpoint while preserving clean boundaries for phase-2 Pokémon integration.
