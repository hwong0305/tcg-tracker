# CardTracker Core MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Bun + Elysia + Drizzle + Vite single-page dashboard MVP for One Piece TCG with ingestion, scraping, print-status/chase classification, and filter-based UI.

**Architecture:** Use a domain-first Bun workspace monolith split into focused packages (`core`, `data`, `providers`, `jobs`) plus `apps/api` and `apps/web`. Keep business rules in pure functions with TDD first, then wire adapters and jobs around those rules. Expose async job endpoints with persisted `job_runs` tracking and render one dashboard page with in-print/OOP filters and presets.

**Tech Stack:** Bun, TypeScript, ElysiaJS, PostgreSQL, Drizzle ORM, Playwright, Vite, React, Tailwind CSS, Bun test, Vitest.

---

## File Structure Map

- Create `package.json` (workspace scripts)
- Create `bunfig.toml` (Bun config)
- Create `.env.example` (DB/API placeholders)
- Create `apps/api/src/server.ts` (Elysia app bootstrap)
- Create `apps/api/package.json` (api workspace scripts)
- Create `apps/api/src/routes/health.ts` (health route)
- Create `apps/api/src/routes/dashboard.ts` (dashboard route)
- Create `apps/api/src/routes/jobs.ts` (job trigger/status routes)
- Create `apps/web/src/App.tsx` (single-page dashboard)
- Create `apps/web/package.json` (web workspace scripts)
- Create `apps/web/src/main.tsx` (web bootstrap)
- Create `apps/web/src/lib/api.ts` (frontend API client)
- Create `apps/web/src/components/FilterBar.tsx` (filter controls + presets)
- Create `apps/web/src/components/SetList.tsx` (sets/chase display)
- Create `packages/core/src/types.ts` (shared interfaces)
- Create `packages/core/src/print-status.ts` (set status rules)
- Create `packages/core/src/chase.ts` (chase rules)
- Create `packages/core/src/index.ts` (exports)
- Create `packages/data/src/schema.ts` (Drizzle schema)
- Create `packages/data/src/client.ts` (Postgres connection)
- Create `packages/data/drizzle.config.ts` (Drizzle generation config)
- Create `packages/data/src/repos/sets-repo.ts` (set upserts/queries)
- Create `packages/data/src/repos/cards-repo.ts` (card upserts/queries)
- Create `packages/data/src/repos/jobs-repo.ts` (job_runs persistence)
- Create `packages/providers/src/onepiece/client.ts` (One Piece fetcher)
- Create `packages/providers/src/onepiece/normalize.ts` (provider normalization)
- Create `packages/providers/src/pricecharting/scraper.ts` (Playwright scraper)
- Create `packages/providers/src/index.ts` (provider public exports)
- Create `packages/jobs/src/ingest-onepiece.ts` (ingestion job)
- Create `packages/jobs/src/scrape-prices.ts` (scrape job)
- Create `packages/jobs/src/recompute-flags.ts` (classification job)
- Create `packages/jobs/src/index.ts` (job exports)
- Create `packages/core/test/print-status.test.ts` (rule tests)
- Create `packages/core/test/chase.test.ts` (rule tests)
- Create `packages/providers/test/onepiece.normalize.test.ts` (adapter contract test)
- Create `packages/jobs/test/recompute-flags.test.ts` (integration-ish job rule test)
- Create `apps/api/test/jobs-routes.test.ts` (API contract tests)
- Create `README.md` (runbook)

## Chunk 1: Workspace + Core Rules + Database Foundation

### Task 1: Initialize Bun Workspace and Tooling

**Files:**
- Create: `package.json`
- Create: `bunfig.toml`
- Create: `.env.example`
- Create: `tsconfig.base.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/package.json`
- Create: `packages/data/tsconfig.json`
- Create: `packages/data/package.json`
- Create: `packages/providers/tsconfig.json`
- Create: `packages/providers/package.json`
- Create: `packages/jobs/tsconfig.json`
- Create: `packages/jobs/package.json`
- Create: `apps/api/test/smoke.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing smoke test for workspace script wiring**

```ts
// apps/api/test/smoke.test.ts
import { test, expect } from "bun:test";

test("workspace scripts are defined", async () => {
  const pkgFile = Bun.file("package.json");
  expect(await pkgFile.exists()).toBe(true);

  const pkg = await pkgFile.json();
  expect(typeof pkg.scripts["dev:api"]).toBe("string");
  expect(typeof pkg.scripts["dev:web"]).toBe("string");
  expect(typeof pkg.scripts["test"]).toBe("string");
  expect(typeof pkg.scripts["jobs:ingest"]).toBe("string");
  expect(typeof pkg.scripts["jobs:scrape"]).toBe("string");
  expect(typeof pkg.scripts["jobs:recompute"]).toBe("string");
});

test("shared tsconfig exists", async () => {
  const paths = [
    "tsconfig.base.json",
    "apps/api/tsconfig.json",
    "apps/web/tsconfig.json",
    "packages/core/tsconfig.json",
    "packages/data/tsconfig.json",
    "packages/providers/tsconfig.json",
    "packages/jobs/tsconfig.json",
    "packages/core/package.json",
    "packages/data/package.json",
    "packages/providers/package.json",
    "packages/jobs/package.json"
  ];

  for (const path of paths) {
    expect(await Bun.file(path).exists()).toBe(true);
  }
});
```

- [ ] **Step 2: Run test to verify harness executes and currently fails due to missing files**

Run: `bun test apps/api/test/smoke.test.ts`
Expected: FAIL because `package.json` and expected scripts are not present yet.

- [ ] **Step 3: Create workspace config and scripts**

```json
{
  "name": "cardtracker-core",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "dependencies": {
    "elysia": "latest",
    "drizzle-orm": "latest",
    "pg": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "bun-types": "latest",
    "drizzle-kit": "latest",
    "playwright": "latest",
    "tailwindcss": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  },
  "scripts": {
    "dev:api": "bun --cwd apps/api run dev",
    "dev:web": "bun --cwd apps/web run dev",
    "test": "bun test",
    "jobs:ingest": "bun run packages/jobs/src/ingest-onepiece.ts",
    "jobs:scrape": "bun run packages/jobs/src/scrape-prices.ts",
    "jobs:recompute": "bun run packages/jobs/src/recompute-flags.ts"
  }
}
```

```toml
# bunfig.toml
[test]
root = "."
```

```env
# .env.example
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cardtracker
ONEPIECE_API_BASE_URL=https://optcg-api.com
PRICECHARTING_BASE_URL=https://www.pricecharting.com
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "types": ["bun-types"]
  }
}
```

```json
// apps/api/tsconfig.json (same shape for other app/package tsconfigs)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

```json
// apps/api/package.json
{
  "name": "@cardtracker/api",
  "private": true,
  "scripts": {
    "dev": "bun --watch src/server.ts"
  }
}
```

```json
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

```json
// apps/web/package.json
{
  "name": "@cardtracker/web",
  "private": true,
  "scripts": {
    "dev": "vite",
    "test": "vitest run"
  }
}
```

```json
// packages/*/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src", "test"]
}
```

```json
// packages/core/package.json
{
  "name": "@cardtracker/core",
  "private": true,
  "type": "module"
}
```

```json
// packages/data/package.json
{
  "name": "@cardtracker/data",
  "private": true,
  "type": "module"
}
```

```json
// packages/providers/package.json
{
  "name": "@cardtracker/providers",
  "private": true,
  "type": "module"
}
```

```json
// packages/jobs/package.json
{
  "name": "@cardtracker/jobs",
  "private": true,
  "type": "module"
}
```

```md
<!-- README.md addition -->
## Workspace Setup

1. `bun install`
2. Copy `.env.example` to `.env`
3. Run `bun test apps/api/test/smoke.test.ts`
```

- [ ] **Step 4: Run workspace smoke test to verify pass**

Run: `bun test apps/api/test/smoke.test.ts`
Expected: PASS.

- [ ] **Step 5: Install dependencies and verify lockfile generation**

Run: `bun install`
Expected: dependencies installed and `bun.lockb` created.

- [ ] **Step 6: Commit**

```bash
git add package.json bunfig.toml .env.example tsconfig.base.json apps/api/tsconfig.json apps/api/package.json apps/web/tsconfig.json apps/web/package.json packages/core/tsconfig.json packages/core/package.json packages/data/tsconfig.json packages/data/package.json packages/providers/tsconfig.json packages/providers/package.json packages/jobs/tsconfig.json packages/jobs/package.json apps/api/test/smoke.test.ts README.md bun.lockb
git commit -m "chore: scaffold bun workspace and baseline scripts"
```

### Task 2: Implement and Test Print Status Rules (TDD)

**Files:**
- Create: `packages/core/src/print-status.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/test/print-status.test.ts`

- [ ] **Step 1: Write failing print-status rule tests**

```ts
import { describe, expect, test } from "bun:test";
import { app } from "../src/server";
import { computePrintStatus } from "../src/print-status";

describe("computePrintStatus", () => {
  test("marks OOP when older than 24 months", () => {
    const result = computePrintStatus({
      releaseDate: "2023-01-01",
      currentBoxPrice: 120,
      todayUtc: "2026-03-13"
    });
    expect(result.isOutOfPrint).toBe(true);
  });

  test("marks OOP at exact 24-month boundary", () => {
    const result = computePrintStatus({
      releaseDate: "2024-03-13",
      currentBoxPrice: 120,
      todayUtc: "2026-03-13"
    });
    expect(result.isOutOfPrint).toBe(true);
  });

  test("marks OOP when current box price is above 196", () => {
    const result = computePrintStatus({
      releaseDate: "2025-08-01",
      currentBoxPrice: 200,
      todayUtc: "2026-03-13"
    });
    expect(result.isOutOfPrint).toBe(true);
  });

  test("marks in-print helper signal when < 24 months and box below 168", () => {
    const result = computePrintStatus({
      releaseDate: "2025-09-01",
      currentBoxPrice: 150,
      todayUtc: "2026-03-13"
    });
    expect(result.isOutOfPrint).toBe(false);
  });

  test("does not flip to OOP on null box price for recent set", () => {
    const result = computePrintStatus({
      releaseDate: "2025-09-01",
      currentBoxPrice: null,
      todayUtc: "2026-03-13",
      previousIsOutOfPrint: false
    });
    expect(result.isOutOfPrint).toBe(false);
  });

  test("preserves prior OOP=true when box price is null", () => {
    const result = computePrintStatus({
      releaseDate: "2025-09-01",
      currentBoxPrice: null,
      todayUtc: "2026-03-13",
      previousIsOutOfPrint: true
    });
    expect(result.isOutOfPrint).toBe(true);
  });

  test("old set remains OOP even when box price is null", () => {
    const result = computePrintStatus({
      releaseDate: "2023-01-01",
      currentBoxPrice: null,
      todayUtc: "2026-03-13",
      previousIsOutOfPrint: false
    });
    expect(result.isOutOfPrint).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (missing implementation)**

Run: `bun test packages/core/test/print-status.test.ts`
Expected: FAIL with unresolved module/function.

- [ ] **Step 3: Implement minimal deterministic logic**

```ts
// packages/core/src/types.ts
export interface PrintStatusInput {
  releaseDate: string;
  currentBoxPrice: number | null;
  todayUtc: string;
  previousIsOutOfPrint?: boolean;
}

export interface PrintStatusResult {
  isOutOfPrint: boolean;
  reason: "age" | "price" | "recent-and-sub-20-percent" | "preserve-on-null-price" | "default-in-print";
}
```

```ts
// packages/core/src/print-status.ts
import type { PrintStatusInput, PrintStatusResult } from "./types";

export function computePrintStatus(input: PrintStatusInput): PrintStatusResult {
  const today = new Date(`${input.todayUtc}T00:00:00.000Z`);
  const release = new Date(`${input.releaseDate}T00:00:00.000Z`);
  const ageCutoff = new Date(today);
  ageCutoff.setUTCMonth(ageCutoff.getUTCMonth() - 24);

  const ageRule = release <= ageCutoff;
  const priceRule = input.currentBoxPrice != null ? input.currentBoxPrice > 196 : false;

  if (ageRule || priceRule) {
    return { isOutOfPrint: true, reason: ageRule ? "age" : "price" };
  }

  if (input.currentBoxPrice == null) {
    return {
      isOutOfPrint: input.previousIsOutOfPrint ?? false,
      reason: "preserve-on-null-price"
    };
  }

  if (input.currentBoxPrice < 168) {
    return { isOutOfPrint: false, reason: "recent-and-sub-20-percent" };
  }

  return { isOutOfPrint: false, reason: "default-in-print" };
}
```

- [ ] **Step 4: Run tests to verify the full rule matrix passes**

Run: `bun test packages/core/test/print-status.test.ts`
Expected: PASS for age boundary, price threshold, in-print helper, and null-price preserve behavior.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/print-status.ts packages/core/test/print-status.test.ts
git commit -m "feat: add deterministic print-status engine with boundary tests"
```

### Task 3: Define Drizzle Schema with Idempotent Constraints

**Files:**
- Create: `packages/data/src/schema.ts`
- Create: `packages/data/src/client.ts`
- Create: `packages/data/drizzle.config.ts`
- Create: `packages/data/test/schema.test.ts`
- Create: `packages/data/test/schema-migration.test.ts`
- Create: `packages/data/drizzle/<generated-migration>.sql`
- Create: `packages/data/drizzle/meta/_journal.json`

- [ ] **Step 1: Write a failing schema module test before schema implementation exists**

```ts
import { test, expect } from "bun:test";
import { sets, cards, jobRuns } from "../src/schema";

test("schema exposes identity fields for upserts", () => {
  expect(sets).toBeDefined();
  expect(cards).toBeDefined();
  expect(jobRuns).toBeDefined();
});

test("schema exports required table objects", () => {
  expect(typeof sets).toBe("object");
  expect(typeof cards).toBe("object");
  expect(typeof jobRuns).toBe("object");
});

```

- [ ] **Step 2: Run test to confirm failure pre-schema**

Run: `bun test packages/data/test/schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement schema and connection**

```ts
// packages/data/src/schema.ts
import { pgTable, text, uuid, boolean, decimal, timestamp, date, jsonb, unique } from "drizzle-orm/pg-core";

export const sets = pgTable(
  "sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tcgType: text("tcg_type").notNull(),
    sourceSetId: text("source_set_id").notNull(),
    setName: text("set_name").notNull(),
    releaseDate: date("release_date"),
    msrpPackPrice: decimal("msrp_pack_price", { precision: 10, scale: 2 }).default("4.49"),
    currentBoxPrice: decimal("current_box_price", { precision: 10, scale: 2 }),
    isOutOfPrint: boolean("is_out_of_print").default(false),
    dataQuality: text("data_quality").default("stale"),
    lastScraped: timestamp("last_scraped").defaultNow()
  },
  (t) => [unique("sets_tcg_type_source_set_id_unique").on(t.tcgType, t.sourceSetId)]
);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    setId: uuid("set_id").notNull().references(() => sets.id),
    sourceCardId: text("source_card_id").notNull(),
    cardName: text("card_name"),
    rarity: text("rarity"),
    marketPrice: decimal("market_price", { precision: 10, scale: 2 }),
    isChase: boolean("is_chase").default(false),
    imageUrl: text("image_url"),
    lastPriceUpdated: timestamp("last_price_updated")
  },
  (t) => [unique("cards_set_id_source_card_id_unique").on(t.setId, t.sourceCardId)]
);

export const jobRuns = pgTable("job_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  requestPayloadJson: jsonb("request_payload_json"),
  statsJson: jsonb("stats_json"),
  errorsJson: jsonb("errors_json"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at")
});
```

```ts
// packages/data/src/client.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);
```

```ts
// packages/data/drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/data/src/schema.ts",
  out: "./packages/data/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" }
});
```

- [ ] **Step 4: Run schema tests**

Run: `bun test packages/data/test/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Prepare env for drizzle generation**

Run: `cp .env.example .env && export DATABASE_URL=postgres://postgres:postgres@localhost:5432/cardtracker`
Expected: `.env` exists and `DATABASE_URL` is set for command execution.

- [ ] **Step 6: Generate migration and verify expected constraints exist**

Run: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/cardtracker bunx drizzle-kit generate --config packages/data/drizzle.config.ts`
Expected: migration file created with `job_runs`, FK `cards.set_id -> sets.id`, defaults (`4.49`, `false`, `'stale'`, `now()`), and unique keys (`UNIQUE(tcg_type, source_set_id)`, `UNIQUE(set_id, source_card_id)`).

- [ ] **Step 7: Add migration-content assertions and run them**

```ts
// packages/data/test/schema-migration.test.ts
import { expect, test } from "bun:test";

test("migration has named unique constraints", async () => {
  const journal = await Bun.file("packages/data/drizzle/meta/_journal.json").json();
  const latest = journal.entries[journal.entries.length - 1].tag;
  const migrationSql = await Bun.file(`packages/data/drizzle/${latest}.sql`).text();
  expect(migrationSql).toMatch(/set_id"\s+uuid\s+NOT NULL/i);
  expect(migrationSql).toMatch(/references\s+"sets"\("id"\)/i);
  expect(migrationSql).toMatch(/msrp_pack_price"\s+numeric\(10,\s*2\)\s+DEFAULT\s+'4\.49'/i);
  expect(migrationSql).toMatch(/is_out_of_print"\s+boolean\s+DEFAULT\s+false/i);
  expect(migrationSql).toMatch(/data_quality"\s+text\s+DEFAULT\s+'stale'/i);
  expect(migrationSql).toMatch(/last_scraped"\s+timestamp(?:\s+with\s+time\s+zone)?\s+DEFAULT\s+now\(\)/i);
  expect(migrationSql).toMatch(/is_chase"\s+boolean\s+DEFAULT\s+false/i);
  expect(migrationSql).toMatch(/sets_tcg_type_source_set_id_unique/i);
  expect(migrationSql).toMatch(/cards_set_id_source_card_id_unique/i);
});
```

Run: `bun test packages/data/test/schema-migration.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/data/src/schema.ts packages/data/src/client.ts packages/data/drizzle.config.ts packages/data/test/schema.test.ts packages/data/test/schema-migration.test.ts packages/data/drizzle
git commit -m "feat: add drizzle schema with idempotent keys and job_runs"
```

## Chunk 2: Providers + Jobs + Rule Composition

### Task 4: Implement Chase Rule Engine (TDD)

**Files:**
- Create: `packages/core/src/chase.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/chase.test.ts`

- [ ] **Step 1: Write failing tests for full chase-rule matrix**

```ts
import { describe, expect, test } from "bun:test";
import { computeChaseFlags } from "../src/chase";

describe("computeChaseFlags", () => {
  test("uses scraped pack price before msrp and fallback", () => {
    const result = computeChaseFlags([
      { id: "a", marketPrice: 55, rarity: "Rare", scrapedPackPrice: 5.5, msrpPackPrice: 4.49 },
      { id: "b", marketPrice: 44, rarity: "Rare", scrapedPackPrice: null, msrpPackPrice: 4.0 },
      { id: "c", marketPrice: 45, rarity: "Rare", scrapedPackPrice: null, msrpPackPrice: null }
    ]);
    expect(result.get("a")?.reasons.includes("10x")).toBe(false);
    expect(result.get("b")?.reasons.includes("10x")).toBe(true);
    expect(result.get("c")?.reasons.includes("10x")).toBe(true);
  });

  test("excludes null market price from 10x/percentile", () => {
    const result = computeChaseFlags([{ id: "n", marketPrice: null, rarity: "Rare", msrpPackPrice: 4.49 }]);
    expect(result.get("n")?.reasons.includes("10x")).toBe(false);
    expect(result.get("n")?.reasons.includes("top-5-percent")).toBe(false);
  });

  test("still marks rarity chase when market price is null", () => {
    const result = computeChaseFlags([{ id: "r", marketPrice: null, rarity: "Manga Rare", msrpPackPrice: 4.49 }]);
    expect(result.get("r")?.isChase).toBe(true);
  });

  test("includes ties at percentile boundary", () => {
    const cards = Array.from({ length: 20 }, (_, i) => ({
      id: `c-${i + 1}`,
      marketPrice: i < 2 ? 100 : 10,
      rarity: "Rare",
      msrpPackPrice: 20
    }));
    const result = computeChaseFlags(cards);
    expect(result.get("c-1")?.reasons.includes("top-5-percent")).toBe(true);
    expect(result.get("c-2")?.reasons.includes("top-5-percent")).toBe(true);
  });
});
```
- [ ] **Step 2: Run test and confirm failure**

Run: `bun test packages/core/test/chase.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal `computeChaseFlags` and helpers**

```ts
// packages/core/src/types.ts
export interface ChaseInput {
  id: string;
  marketPrice: number | null;
  rarity: string | null;
  scrapedPackPrice?: number | null;
  msrpPackPrice?: number | null;
}
```

```ts
// packages/core/src/chase.ts
import type { ChaseInput } from "./types";

export function computeChaseFlags(cards: ChaseInput[]) {
  const out = new Map<string, { isChase: boolean; reasons: string[] }>();
  const priced = cards.filter((c) => c.marketPrice != null) as Array<ChaseInput & { marketPrice: number }>;
  const sorted = [...priced].sort((a, b) => b.marketPrice - a.marketPrice);
  const topCount = Math.max(1, Math.ceil(sorted.length * 0.05));
  const boundary = sorted.length > 0 ? sorted[topCount - 1].marketPrice : Infinity;

  for (const c of cards) {
    const reasons: string[] = [];
    const packPrice = c.scrapedPackPrice ?? c.msrpPackPrice ?? 4.49;
    if (c.marketPrice != null && c.marketPrice > packPrice * 10) reasons.push("10x");
    if (c.rarity && ["Special Illustration Rare", "Alt Art", "Manga Rare"].includes(c.rarity)) reasons.push("rarity");
    if (c.marketPrice != null && c.marketPrice >= boundary) reasons.push("top-5-percent");
    out.set(c.id, { isChase: reasons.length > 0, reasons });
  }
  return out;
}
```

```ts
// packages/core/src/index.ts
export { computePrintStatus } from "./print-status";
export { computeChaseFlags } from "./chase";
export type { PrintStatusInput, PrintStatusResult, ChaseInput } from "./types";
```

- [ ] **Step 4: Run tests and verify deterministic output**

Run: `bun test packages/core/test/chase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/chase.ts packages/core/src/types.ts packages/core/src/index.ts packages/core/test/chase.test.ts
git commit -m "feat: add chase-card classification engine with deterministic rules"
```

### Task 5: Build One Piece Provider Adapter with Contract Tests

**Files:**
- Create: `packages/providers/src/onepiece/client.ts`
- Create: `packages/providers/src/onepiece/normalize.ts`
- Create: `packages/providers/src/index.ts`
- Create: `packages/providers/test/onepiece.normalize.test.ts`
- Create: `packages/providers/test/onepiece.errors.test.ts`

- [ ] **Step 1: Write failing normalization tests from fixture payloads**

```ts
// packages/providers/test/onepiece.normalize.test.ts
import { expect, test } from "bun:test";
import { normalizeSet, normalizeCard } from "../src/onepiece/normalize";

test("normalizeSet maps provider fields", () => {
  const dto = normalizeSet({ id: "op-01", name: "Romance Dawn", releaseDate: "2022-12-02" });
  expect(dto).toEqual({ sourceSetId: "op-01", setName: "Romance Dawn", releaseDate: "2022-12-02", tcgType: "OnePiece" });
});

test("normalizeCard maps provider fields", () => {
  const dto = normalizeCard({ id: "op01-001", name: "Luffy", rarity: "Leader", image: "https://img" }, "set-uuid");
  expect(dto.sourceCardId).toBe("op01-001");
  expect(dto.setId).toBe("set-uuid");
});
```

```ts
// packages/providers/test/onepiece.errors.test.ts
import { expect, test } from "bun:test";
import { mapOnePieceError } from "../src/onepiece/client";

test("maps timeout to retryable network error", () => {
  const err = mapOnePieceError(new Error("ETIMEDOUT"), "set");
  expect(err).toEqual({ code: "NETWORK_ERROR", source: "onepiece", entity: "set", reason: "ETIMEDOUT", retryable: true });
});

test("maps bad payload to non-retryable error", () => {
  const err = mapOnePieceError(new Error("INVALID_PAYLOAD"), "card");
  expect(err.retryable).toBe(false);
});
```
- [ ] **Step 2: Run failing tests**

Run: `bun test packages/providers/test/onepiece.normalize.test.ts`
Run: `bun test packages/providers/test/onepiece.errors.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement fetch + normalize boundaries**

```ts
// packages/providers/src/onepiece/client.ts
function isProviderError(e: unknown): e is ProviderError {
  return !!e && typeof e === "object" && "code" in e && "retryable" in e;
}

export async function fetchOnePieceSets(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/sets`);
    if (!res.ok) throw mapOnePieceError(new Error(`HTTP_${res.status}`), "set");
    return res.json();
  } catch (error) {
    if (isProviderError(error)) throw error;
    throw mapOnePieceError(error instanceof Error ? error : new Error(String(error)), "set");
  }
}

export async function fetchOnePieceCards(baseUrl: string, sourceSetId: string) {
  try {
    const res = await fetch(`${baseUrl}/cards?set=${sourceSetId}`);
    if (!res.ok) throw mapOnePieceError(new Error(`HTTP_${res.status}`), "card");
    return res.json();
  } catch (error) {
    if (isProviderError(error)) throw error;
    throw mapOnePieceError(error instanceof Error ? error : new Error(String(error)), "card");
  }
}
```

```ts
// packages/providers/src/onepiece/normalize.ts
import { mapOnePieceError } from "./client";

export interface NormalizedSet {
  sourceSetId: string;
  setName: string;
  releaseDate: string | null;
  tcgType: "OnePiece";
}

export interface NormalizedCard {
  sourceCardId: string;
  setId: string;
  cardName: string;
  rarity: string | null;
  imageUrl: string | null;
}

export function normalizeSet(raw: any): NormalizedSet {
  if (!raw?.id || !raw?.name) throw mapOnePieceError(new Error("INVALID_PAYLOAD"), "set");
  return { sourceSetId: raw.id, setName: raw.name, releaseDate: raw.releaseDate ?? null, tcgType: "OnePiece" };
}

export function normalizeCard(raw: any, setId: string): NormalizedCard {
  if (!raw?.id || !raw?.name) throw mapOnePieceError(new Error("INVALID_PAYLOAD"), "card");
  return { sourceCardId: raw.id, setId, cardName: raw.name, rarity: raw.rarity ?? null, imageUrl: raw.image ?? null };
}
```

```ts
// packages/providers/src/index.ts
export { fetchOnePieceSets, fetchOnePieceCards } from "./onepiece/client";
export { normalizeSet, normalizeCard } from "./onepiece/normalize";
```

- [ ] **Step 4: Implement structured provider error mapping**

```ts
export interface ProviderError {
  code: "NETWORK_ERROR" | "INVALID_PAYLOAD" | "HTTP_ERROR";
  source: "onepiece";
  entity: "set" | "card";
  reason: string;
  retryable: boolean;
}

export function mapOnePieceError(error: Error, entity: "set" | "card"): ProviderError {
  if (error.message.includes("ETIMEDOUT") || error.message.includes("ECONNRESET")) {
    return { code: "NETWORK_ERROR", source: "onepiece", entity, reason: error.message, retryable: true };
  }
  if (error.message.includes("INVALID_PAYLOAD")) {
    return { code: "INVALID_PAYLOAD", source: "onepiece", entity, reason: error.message, retryable: false };
  }
  return { code: "HTTP_ERROR", source: "onepiece", entity, reason: error.message, retryable: false };
}
```

- [ ] **Step 5: Re-run tests**

Run: `bun test packages/providers/test/onepiece.normalize.test.ts`
Run: `bun test packages/providers/test/onepiece.errors.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/providers/src/onepiece/client.ts packages/providers/src/onepiece/normalize.ts packages/providers/src/index.ts packages/providers/test/onepiece.normalize.test.ts packages/providers/test/onepiece.errors.test.ts
git commit -m "feat: add one piece provider adapter and normalization contracts"
```

### Task 6: Implement Scrape + Ingest + Recompute Jobs

**Files:**
- Create: `packages/providers/src/pricecharting/scraper.ts`
- Create: `packages/jobs/src/ingest-onepiece.ts`
- Create: `packages/jobs/src/resolve-targets.ts`
- Create: `packages/jobs/src/scrape-prices.ts`
- Create: `packages/jobs/src/recompute-flags.ts`
- Create: `packages/jobs/src/index.ts`
- Create: `packages/jobs/test/ingest-onepiece.test.ts`
- Create: `packages/jobs/test/resolve-targets.test.ts`
- Create: `packages/jobs/test/recompute-flags.test.ts`
- Create: `packages/jobs/test/scrape-prices.test.ts`

- [ ] **Step 1: Write failing tests for recompute and scrape-status accounting**

```ts
// packages/jobs/test/ingest-onepiece.test.ts
import { expect, test } from "bun:test";
import { runIngestOnePieceJob } from "../src/ingest-onepiece";

test("ingest job is idempotent and tracks run status", async () => {
  const first = await runIngestOnePieceJob({ setIds: ["op-01"] });
  const second = await runIngestOnePieceJob({ setIds: ["op-01"] });
  expect(first.stats.createdSets).toBeGreaterThanOrEqual(1);
  expect(second.stats.createdSets).toBe(0);
  expect(second.stats.updatedSets).toBeGreaterThanOrEqual(1);
  expect(second.status).toBe("completed");
});
```

```ts
// packages/jobs/test/resolve-targets.test.ts
import { expect, test } from "bun:test";
import { resolveTargetsUnion } from "../src/resolve-targets";

test("resolves union and deduplicates with cap", async () => {
  const targets = await resolveTargetsUnion({ setIds: ["s1"], cardIds: ["c1", "c1"] }, 2);
  expect(targets.length).toBeLessThanOrEqual(2);
  expect(new Set(targets.map((t) => t.id)).size).toBe(targets.length);
  expect(targets.every((t) => typeof t.url === "string" && t.url.length > 0)).toBe(true);
});
```

```ts
// packages/jobs/test/recompute-flags.test.ts
import { expect, test } from "bun:test";
import { recomputeFlags } from "../src/recompute-flags";

test("fixture A/B/C/D recompute outcomes", async () => {
  const result = await recomputeFlags(["fixture-set"], { todayUtc: "2026-03-13" });
  expect(result.assertions.fixtureA_OOP).toBe(true);
  expect(result.assertions.fixtureB_OOP).toBe(true);
  expect(result.assertions.fixtureC_Chase).toBe(true);
  expect(result.assertions.fixtureD_Chase).toBe(true);
});
```

```ts
// packages/jobs/test/scrape-prices.test.ts
import { expect, test } from "bun:test";
import { summarizeScrapeRun, scrapeWithRetry } from "../src/scrape-prices";

test("no targets => completed", () => {
  expect(summarizeScrapeRun({ totalTargets: 0, succeeded: 0, failed: 0 }).status).toBe("completed");
});

test("all failed => failed", () => {
  expect(summarizeScrapeRun({ totalTargets: 3, succeeded: 0, failed: 3 }).status).toBe("failed");
});

test("mixed => partial", () => {
  expect(summarizeScrapeRun({ totalTargets: 4, succeeded: 3, failed: 1 }).status).toBe("partial");
});

test("retry cap stops after max attempts", async () => {
  let calls = 0;
  const alwaysFail = async () => {
    calls += 1;
    throw new Error("network");
  };
  const ok = await scrapeWithRetry({ url: "https://example.com" }, 3, [1, 1], alwaysFail);
  expect(ok).toBe(false);
  expect(calls).toBe(3);
});
```
- [ ] **Step 2: Run failing test**

Run: `bun test packages/jobs/test/ingest-onepiece.test.ts`
Run: `bun test packages/jobs/test/resolve-targets.test.ts`
Run: `bun test packages/jobs/test/recompute-flags.test.ts`
Run: `bun test packages/jobs/test/scrape-prices.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement job orchestration with idempotent repos**

```ts
export async function runIngestOnePieceJob(input: { setIds?: string[] }) {
  const run = await jobsRepo.create({ type: "ingest-onepiece", status: "queued", requestPayloadJson: input });
  try {
    await jobsRepo.markRunning(run.id);

    const rawSets = await fetchOnePieceSets(process.env.ONEPIECE_API_BASE_URL!);
    const normalizedSets = rawSets.map(normalizeSet).filter((s) => !input.setIds || input.setIds.includes(s.sourceSetId));
    const setUpsert = await setsRepo.upsertMany(normalizedSets);
    const setIdBySource = new Map(setUpsert.rows.map((row: { sourceSetId: string; id: string }) => [row.sourceSetId, row.id]));

    const cardStats = { createdCards: 0, updatedCards: 0 };
    for (const set of normalizedSets) {
      const rawCards = await fetchOnePieceCards(process.env.ONEPIECE_API_BASE_URL!, set.sourceSetId);
      const persistedSetId = setIdBySource.get(set.sourceSetId)!;
      const normalizedCards = rawCards.map((card: any) => normalizeCard(card, persistedSetId));
      const stats = await cardsRepo.upsertMany(normalizedCards);
      cardStats.createdCards += stats.created;
      cardStats.updatedCards += stats.updated;
    }

    const stats = {
      createdSets: setUpsert.created,
      updatedSets: setUpsert.updated,
      createdCards: cardStats.createdCards,
      updatedCards: cardStats.updatedCards
    };
    await jobsRepo.finalize(run.id, { status: "completed", statsJson: stats, finishedAt: new Date() });
    return { status: "completed" as const, stats };
  } catch (error) {
    await jobsRepo.finalize(run.id, {
      status: "failed",
      errorsJson: [{ message: error instanceof Error ? error.message : String(error) }],
      finishedAt: new Date()
    });
    throw error;
  }
}

// packages/jobs/src/resolve-targets.ts
export type ScrapeTarget = { id: string; url: string };

function buildPriceUrl(cardOrSet: { sourceCardId?: string; sourceSetId?: string; cardName?: string; setName?: string }) {
  const query = cardOrSet.sourceCardId ?? cardOrSet.sourceSetId ?? cardOrSet.cardName ?? cardOrSet.setName ?? "";
  return `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}`;
}

export async function resolveTargetsUnion(input: { setIds?: string[]; cardIds?: string[] }, limit: number) {
  const fromSets = input.setIds ? await cardsRepo.findBySetIds(input.setIds) : [];
  const fromCards = input.cardIds ? await cardsRepo.findByIds(input.cardIds) : [];
  const all = [...fromSets, ...fromCards].map((x: any) => ({ id: x.id, url: buildPriceUrl(x) } as ScrapeTarget));
  const deduped = Array.from(new Map(all.map((x) => [x.id, x])).values());
  return deduped.slice(0, limit);
}

// packages/jobs/src/scrape-prices.ts
import { resolveTargetsUnion } from "./resolve-targets";

export async function runScrapePricesJob(input: { setIds?: string[]; cardIds?: string[] }) {
  const run = await jobsRepo.create({ type: "scrape-prices", status: "queued", requestPayloadJson: input });
  try {
    await jobsRepo.markRunning(run.id);

    const targets = await resolveTargetsUnion(input, 200);
    let succeeded = 0;
    let failed = 0;

    for (const target of targets) {
      const ok = await scrapeWithRetry(target, 3, [1000, 3000]);
      if (ok) succeeded += 1;
      else failed += 1;
    }

    const summary = summarizeScrapeRun({ totalTargets: targets.length, succeeded, failed });
    await jobsRepo.finalize(run.id, {
      status: summary.status,
      statsJson: { totalTargets: targets.length, succeeded, failed },
      finishedAt: new Date()
    });
  } catch (error) {
    await jobsRepo.finalize(run.id, {
      status: "failed",
      errorsJson: [{ message: error instanceof Error ? error.message : String(error) }],
      finishedAt: new Date()
    });
    throw error;
  }
}

export function summarizeScrapeRun(stats: { totalTargets: number; succeeded: number; failed: number }) {
  if (stats.totalTargets === 0) return { status: "completed" as const };
  if (stats.succeeded === 0) return { status: "failed" as const };
  if (stats.failed > 0) return { status: "partial" as const };
  return { status: "completed" as const };
}
```

- [ ] **Step 3.5: Implement recompute job execution used by fixture tests**

```ts
// packages/jobs/src/recompute-flags.ts
import { computePrintStatus, computeChaseFlags } from "../../core/src/index";

export async function recomputeFlags(setIds: string[], options?: { todayUtc?: string }) {
  const sets = await setsRepo.getByIds(setIds);
  const cardsBySet = await cardsRepo.getBySetIds(setIds);
  const setStatusByFixture = new Map<string, boolean>();
  const cardStatusByFixture = new Map<string, boolean>();
  const toNumberOrNull = (value: unknown) => (value == null ? null : Number(value));

  for (const set of sets) {
    if (!set.releaseDate) {
      await setsRepo.updatePrintStatus(set.id, set.isOutOfPrint);
    } else {
      const next = computePrintStatus({
        releaseDate: set.releaseDate,
        currentBoxPrice: toNumberOrNull(set.currentBoxPrice),
        todayUtc: options?.todayUtc ?? new Date().toISOString().slice(0, 10),
        previousIsOutOfPrint: set.isOutOfPrint
      });
      await setsRepo.updatePrintStatus(set.id, next.isOutOfPrint);
      if (set.fixtureKey) setStatusByFixture.set(set.fixtureKey, next.isOutOfPrint);
    }

    const normalizedCards = (cardsBySet.get(set.id) ?? []).map((card: any) => ({
      ...card,
      marketPrice: toNumberOrNull(card.marketPrice),
      msrpPackPrice: toNumberOrNull(card.msrpPackPrice),
      scrapedPackPrice: toNumberOrNull(card.scrapedPackPrice)
    }));
    const chaseMap = computeChaseFlags(normalizedCards);
    await cardsRepo.updateChaseFlags(set.id, chaseMap);

    for (const [cardId, status] of chaseMap.entries()) {
      const fixtureKey = cardsBySet.get(set.id)?.find((c: any) => c.id === cardId)?.fixtureKey;
      if (fixtureKey) cardStatusByFixture.set(fixtureKey, status.isChase);
    }
  }

  return {
    assertions: {
      fixtureA_OOP: setStatusByFixture.get("fixtureA") ?? false,
      fixtureB_OOP: setStatusByFixture.get("fixtureB") ?? false,
      fixtureC_Chase: cardStatusByFixture.get("fixtureC") ?? false,
      fixtureD_Chase: cardStatusByFixture.get("fixtureD") ?? false
    }
  };
}
```

- [ ] **Step 4: Add randomized headers and bounded retries in scraper**

```ts
// packages/providers/src/pricecharting/scraper.ts
export async function scrapeOnce(url: string, headers: Record<string, string>) {
  // Playwright page creation/navigation and extraction goes here.
  // Return { ok: boolean, payload?: ... }
}

// packages/providers/src/index.ts (append in Task 6)
export { scrapeOnce } from "./pricecharting/scraper";
```

```ts
// packages/jobs/src/scrape-prices.ts
import { scrapeOnce } from "../../providers/src/index";
import type { ScrapeTarget } from "./resolve-targets";

const userAgents = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Mozilla/5.0 (X11; Linux x86_64)"
];

export async function scrapeWithRetry(
  target: ScrapeTarget,
  maxAttempts = 3,
  backoffMs = [1000, 3000],
  scrapeFn = scrapeOnce
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    try {
      const result = await scrapeFn(target.url, { "user-agent": userAgent, "accept-language": "en-US,en;q=0.9" });
      if (result.ok) return true;
      if (attempt === maxAttempts) return false;
      await Bun.sleep(backoffMs[Math.min(attempt - 1, backoffMs.length - 1)]);
    } catch {
      if (attempt === maxAttempts) return false;
      await Bun.sleep(backoffMs[Math.min(attempt - 1, backoffMs.length - 1)]);
    }
  }
  return false;
}
```

- [ ] **Step 5: Run job tests**

Run: `bun test packages/jobs/test/ingest-onepiece.test.ts`
Run: `bun test packages/jobs/test/resolve-targets.test.ts`
Run: `bun test packages/jobs/test/recompute-flags.test.ts`
Run: `bun test packages/jobs/test/scrape-prices.test.ts`
Expected: PASS with Fixture A/B/C/D outcomes.

- [ ] **Step 6: Commit**

```bash
git add packages/providers/src/pricecharting/scraper.ts packages/providers/src/index.ts packages/jobs/src/ingest-onepiece.ts packages/jobs/src/resolve-targets.ts packages/jobs/src/scrape-prices.ts packages/jobs/src/recompute-flags.ts packages/jobs/src/index.ts packages/jobs/test/ingest-onepiece.test.ts packages/jobs/test/resolve-targets.test.ts packages/jobs/test/recompute-flags.test.ts packages/jobs/test/scrape-prices.test.ts
git commit -m "feat: add ingest scrape recompute jobs with resilient orchestration"
```

## Chunk 3: API Contracts and Async Job Surface

### Task 7: Implement Elysia API Routes with Contract Tests

**Files:**
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/dashboard.ts`
- Create: `apps/api/src/routes/jobs.ts`
- Create: `apps/api/src/services/jobs-api.ts`
- Create: `apps/api/src/services/dashboard-repo.ts`
- Create: `apps/api/test/jobs-routes.test.ts`

- [ ] **Step 1: Write failing API contract tests**

```ts
import { describe, expect, test } from "bun:test";
import { app } from "../src/server";

describe("API contracts", () => {
  test("GET /health contract", async () => {
    const res = await app.handle(new Request("http://localhost/health"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("cardtracker-core");
    expect(typeof body.timestamp).toBe("string");
  });

  test("GET /dashboard supports query filters", async () => {
    const url = "http://localhost/dashboard?printStatus=in-print&tcgType=OnePiece&setId=s1&rarity=Alt%20Art&chaseOnly=true";
    const res = await app.handle(new Request(url));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.sets)).toBe(true);
    expect(Array.isArray(body.cards)).toBe(true);
    expect(typeof body.meta.generatedAt).toBe("string");
  });

  test("POST /jobs/ingest/onepiece queues job", async () => {
    const res = await app.handle(new Request("http://localhost/jobs/ingest/onepiece", { method: "POST" }));
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(typeof body.jobId).toBe("string");
    expect(body.status).toBe("queued");
  });

  test("POST /jobs/scrape/prices handles union+dedupe semantics", async () => {
    const res = await app.handle(new Request("http://localhost/jobs/scrape/prices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ setIds: ["s1"], cardIds: ["c1", "c1"] })
    }));
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(body.targetCount).toBeLessThanOrEqual(200);
    expect(body.targetCount).toBeGreaterThan(0);
  });

  test("POST /jobs/scrape/prices empty body defaults to tracked targets cap=200", async () => {
    const res = await app.handle(new Request("http://localhost/jobs/scrape/prices", { method: "POST" }));
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(body.targetCount).toBeLessThanOrEqual(200);
  });

  test("POST /jobs/recompute/flags queues job", async () => {
    const res = await app.handle(new Request("http://localhost/jobs/recompute/flags", { method: "POST" }));
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(body.status).toBe("queued");
  });

  test("GET /jobs/:id returns status payload", async () => {
    const create = await app.handle(new Request("http://localhost/jobs/ingest/onepiece", { method: "POST" }));
    const created = await create.json();
    const res = await app.handle(new Request(`http://localhost/jobs/${created.jobId}`));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(typeof body.id).toBe("string");
    expect(typeof body.type).toBe("string");
    expect(typeof body.status).toBe("string");
    expect(typeof body.requestedAt).toBe("string");
  });

  test("GET /jobs/:id returns 404 for unknown id", async () => {
    const res = await app.handle(new Request("http://localhost/jobs/not-found"));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toBe("JOB_NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `bun test apps/api/test/jobs-routes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement routes and job status transitions**

```ts
// apps/api/src/server.ts
import { Elysia } from "elysia";
import { registerHealthRoutes } from "./routes/health";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerJobRoutes } from "./routes/jobs";

export const app = new Elysia();
registerHealthRoutes(app);
registerDashboardRoutes(app);
registerJobRoutes(app);

if (import.meta.main) {
  app.listen(3000);
}
```

```ts
// apps/api/src/routes/health.ts
export function registerHealthRoutes(app: any) {
  app.get("/health", () => ({
    ok: true,
    service: "cardtracker-core",
    timestamp: new Date().toISOString()
  }));
}
```

```ts
// apps/api/src/routes/jobs.ts
import { jobsApi } from "../services/jobs-api";

export function registerJobRoutes(app: any) {
  app.post("/jobs/ingest/onepiece", async ({ body }: any) => {
    const jobId = await jobsApi.queueIngest(body ?? {});
    return new Response(JSON.stringify({ jobId, status: "queued" }), { status: 202 });
  });

  app.post("/jobs/scrape/prices", async ({ body }: any) => {
    const queued = await jobsApi.queueScrape(body ?? {}); // union+dedupe; empty body => capped 200
    return new Response(JSON.stringify({ jobId: queued.jobId, status: "queued", targetCount: queued.targetCount }), { status: 202 });
  });

  app.post("/jobs/recompute/flags", async ({ body }: any) => {
    const jobId = await jobsApi.queueRecompute(body ?? {});
    return new Response(JSON.stringify({ jobId, status: "queued" }), { status: 202 });
  });

  app.get("/jobs/:id", async ({ params }: any) => {
    const job = await jobsApi.getById(params.id);
    if (!job) return new Response(JSON.stringify({ error: "JOB_NOT_FOUND" }), { status: 404 });
    return {
      id: job.id,
      type: job.type,
      status: job.status, // queued|running|completed|partial|failed
      requestedAt: job.requestedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      stats: job.statsJson,
      errors: job.errorsJson
    };
  });
}
```

```ts
// apps/api/src/services/jobs-api.ts
import { jobsRepo } from "../../../../packages/data/src/repos/jobs-repo";
import { cardsRepo } from "../../../../packages/data/src/repos/cards-repo";
import { resolveTargetsUnion } from "../../../../packages/jobs/src/resolve-targets";

export const jobsApi = {
  async queueIngest(payload: any) {
    const run = await jobsRepo.create({ type: "ingest-onepiece", status: "queued", requestPayloadJson: payload });
    return run.id;
  },
  async queueScrape(payload: any) {
    const normalized = await normalizeScrapePayload(payload);
    const targets = await resolveTargetsUnion(normalized, 200);
    const run = await jobsRepo.create({
      type: "scrape-prices",
      status: "queued",
      requestPayloadJson: normalized
    });
    return { jobId: run.id, targetCount: targets.length };
  },
  async queueRecompute(payload: any) {
    const run = await jobsRepo.create({ type: "recompute-flags", status: "queued", requestPayloadJson: payload });
    return run.id;
  },
  async getById(id: string) {
    return jobsRepo.getById(id);
  }
};

async function normalizeScrapePayload(payload: { setIds?: string[]; cardIds?: string[] }) {
  const tracked = await cardsRepo.findTrackedTargets();
  const setIds = Array.from(new Set(payload.setIds ?? []));
  const cardIds = Array.from(new Set(payload.cardIds ?? []));

  if (setIds.length === 0 && cardIds.length === 0) {
    return { setIds: [], cardIds: tracked.map((t: any) => t.id).slice(0, 200) };
  }

  const cappedCardIds = cardIds.slice(0, Math.max(0, 200 - setIds.length));
  return { setIds: setIds.slice(0, 200), cardIds: cappedCardIds };
}
```

- [ ] **Step 4: Implement dashboard aggregation response**

```ts
// apps/api/src/routes/dashboard.ts
import { dashboardRepo } from "../services/dashboard-repo";

export function registerDashboardRoutes(app: any) {
  app.get("/dashboard", async ({ query }: any) => {
    const filters = {
      printStatus: query.printStatus,
      tcgType: query.tcgType,
      setId: query.setId,
      rarity: query.rarity,
      chaseOnly: query.chaseOnly === "true"
    };

    const data = await dashboardRepo.getDashboard(filters);
    return {
      sets: data.sets,
      cards: data.cards,
      meta: { generatedAt: new Date().toISOString() }
    };
  });
}
```

```ts
// apps/api/src/services/dashboard-repo.ts
import { setsRepo } from "../../../../packages/data/src/repos/sets-repo";
import { cardsRepo } from "../../../../packages/data/src/repos/cards-repo";

export const dashboardRepo = {
  async getDashboard(filters: {
    printStatus?: string;
    tcgType?: string;
    setId?: string;
    rarity?: string;
    chaseOnly?: boolean;
  }) {
    const sets = await setsRepo.findFiltered(filters);
    const cards = await cardsRepo.findFiltered(filters);
    return { sets, cards };
  }
};
```

- [ ] **Step 5: Run API tests**

Run: `bun test apps/api/test/jobs-routes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src apps/api/test/jobs-routes.test.ts
git commit -m "feat: add elysia routes for health dashboard and async jobs"
```

## Chunk 4: Single-Page Dashboard + Verification + Documentation

### Task 8: Build Single-Page Dashboard with Filter Presets (TDD)

**Files:**
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Modify: `apps/web/package.json`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/components/FilterBar.tsx`
- Create: `apps/web/src/components/SetList.tsx`
- Create: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests for filter behavior and presets**

```tsx
import { expect, test } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";
import * as api from "./lib/api";

const fixture = {
  sets: [
    { id: "OP01", setName: "OP01", printStatus: "in-print", tcgType: "OnePiece" },
    { id: "OP02", setName: "OP02", printStatus: "out-of-print", tcgType: "OnePiece" }
  ],
  cards: [
    { id: "1", cardName: "A", printStatus: "in-print", tcgType: "OnePiece", setId: "OP01", rarity: "Alt Art", isChase: true },
    { id: "2", cardName: "B", printStatus: "out-of-print", tcgType: "OnePiece", setId: "OP02", rarity: "R", isChase: false }
  ]
};

vi.spyOn(api, "fetchDashboard").mockResolvedValue(fixture as any);

test("renders single-page filters and applies client-side filtering", async () => {
  render(<App />);
  await screen.findByLabelText("Print Status");
  await screen.findByText("A");
  expect(screen.getByLabelText("TCG Type")).toBeInTheDocument();
  expect(screen.getByLabelText("Set")).toBeInTheDocument();
  expect(screen.getByLabelText("Rarity")).toBeInTheDocument();
  expect(screen.getByLabelText("Chase Only")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Print Status"), { target: { value: "in-print" } });
  expect(screen.getByText("A")).toBeInTheDocument();
  expect(screen.queryByText("B")).toBeNull();
});

test("Store Hunter and Vault presets do not change route", async () => {
  window.history.pushState({}, "", "/dashboard");
  render(<App />);
  await screen.findByText("A");
  fireEvent.click(screen.getByRole("button", { name: /Store Hunter/i }));
  expect(window.location.pathname).toBe("/dashboard");
  expect(screen.getByText("A")).toBeInTheDocument();
  expect(screen.queryByText("B")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: /Vault/i }));
  expect(window.location.pathname).toBe("/dashboard");
  expect(screen.getByText("B")).toBeInTheDocument();
  expect(screen.queryByText("A")).toBeNull();
});

test("chase cards are highlighted and chaseOnly narrows list", async () => {
  render(<App />);
  await screen.findByText("A");
  expect(screen.getAllByTestId("chase-badge").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByLabelText("Chase Only"));
  expect(screen.queryByTestId("non-chase-row")).toBeNull();
});
```
- [ ] **Step 2: Run failing UI tests**

Run: `bun --cwd apps/web run test`
Expected: FAIL.

- [ ] **Step 3: Implement page with one dataset + client-side filters**

```tsx
// apps/web/src/lib/api.ts
export async function fetchDashboard() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  const res = await fetch(`${baseUrl}/dashboard`);
  if (!res.ok) throw new Error("DASHBOARD_FETCH_FAILED");
  return res.json();
}
```

```ts
// apps/web/vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/dashboard": "http://localhost:3000",
      "/jobs": "http://localhost:3000"
    }
  }
});
```

```ts
// apps/web/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"]
  }
});
```

```ts
// apps/web/src/test/setup.ts
import "@testing-library/jest-dom";
```

```json
// apps/web/package.json additions
{
  "devDependencies": {
    "@testing-library/react": "latest",
    "@testing-library/jest-dom": "latest",
    "jsdom": "latest"
  }
}
```

```tsx
// apps/web/src/components/FilterBar.tsx
import React from "react";

type FilterState = {
  printStatus: "all" | "in-print" | "out-of-print";
  tcgType: string;
  set: string;
  rarity: string;
  chaseOnly: boolean;
};

export function FilterBar({ filters, onChange, onPreset, tcgOptions, setOptions, rarityOptions }: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onPreset: (preset: "store-hunter" | "vault") => void;
  tcgOptions: string[];
  setOptions: string[];
  rarityOptions: string[];
}) {
  return (
    <div>
      <label>
        Print Status
        <select aria-label="Print Status" value={filters.printStatus} onChange={(e) => onChange({ ...filters, printStatus: e.target.value as FilterState["printStatus"] })}>
          <option value="all">All</option>
          <option value="in-print">In-Print</option>
          <option value="out-of-print">Out-of-Print</option>
        </select>
      </label>

      <label>
        TCG Type
        <select aria-label="TCG Type" value={filters.tcgType} onChange={(e) => onChange({ ...filters, tcgType: e.target.value })}>
          <option value="all">All</option>
          {tcgOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </label>

      <label>
        Set
        <select aria-label="Set" value={filters.set} onChange={(e) => onChange({ ...filters, set: e.target.value })}>
          <option value="all">All</option>
          {setOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </label>

      <label>
        Rarity
        <select aria-label="Rarity" value={filters.rarity} onChange={(e) => onChange({ ...filters, rarity: e.target.value })}>
          <option value="all">All</option>
          {rarityOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </label>

      <label>
        Chase Only
        <input aria-label="Chase Only" type="checkbox" checked={filters.chaseOnly} onChange={(e) => onChange({ ...filters, chaseOnly: e.target.checked })} />
      </label>

      <button type="button" onClick={() => onPreset("store-hunter")}>Store Hunter</button>
      <button type="button" onClick={() => onPreset("vault")}>Vault</button>
    </div>
  );
}
```

```tsx
// apps/web/src/components/SetList.tsx
export function SetList({ cards }: { cards: Array<{ id: string; cardName: string; isChase: boolean }> }) {
  return (
    <ul>
      {cards.map((card) => (
        <li key={card.id} data-testid={card.isChase ? "chase-row" : "non-chase-row"}>
          <span>{card.cardName}</span>
          {card.isChase ? <span data-testid="chase-badge">Chase</span> : null}
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// apps/web/src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchDashboard } from "./lib/api";
import { FilterBar } from "./components/FilterBar";
import { SetList } from "./components/SetList";

type CardRow = {
  id: string;
  cardName: string;
  printStatus: "in-print" | "out-of-print";
  tcgType: string;
  setId: string;
  rarity: string;
  isChase: boolean;
};

type DashboardData = { sets: any[]; cards: CardRow[] };

type FilterState = {
  printStatus: "all" | "in-print" | "out-of-print";
  tcgType: string;
  set: string;
  rarity: string;
  chaseOnly: boolean;
};

const initialFilters: FilterState = {
  printStatus: "all" as const,
  tcgType: "all",
  set: "all",
  rarity: "all",
  chaseOnly: false
};

export default function App() {
  const [data, setData] = useState<DashboardData>({ sets: [], cards: [] });
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return data.cards.filter((card) => {
      if (filters.printStatus !== "all" && card.printStatus !== filters.printStatus) return false;
      if (filters.tcgType !== "all" && card.tcgType !== filters.tcgType) return false;
      if (filters.set !== "all" && card.setId !== filters.set) return false;
      if (filters.rarity !== "all" && card.rarity !== filters.rarity) return false;
      if (filters.chaseOnly && !card.isChase) return false;
      return true;
    });
  }, [data, filters]);

  const onPreset = (preset: "store-hunter" | "vault") => {
    setFilters((prev) => ({
      ...prev,
      printStatus: preset === "store-hunter" ? "in-print" : "out-of-print"
    }));
  };

  const tcgOptions = Array.from(new Set(data.cards.map((c) => c.tcgType)));
  const setOptions = Array.from(new Set(data.cards.map((c) => c.setId)));
  const rarityOptions = Array.from(new Set(data.cards.map((c) => c.rarity)));

  if (loading) return <div>Loading...</div>;
  if (error) return <div role="alert">{error}</div>;

  return (
    <main>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onPreset={onPreset}
        tcgOptions={tcgOptions}
        setOptions={setOptions}
        rarityOptions={rarityOptions}
      />
      <SetList cards={filtered} />
    </main>
  );
}

```

```tsx
// apps/web/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 4: Run UI tests**

Run: `bun --cwd apps/web run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src apps/web/vite.config.ts apps/web/vitest.config.ts apps/web/package.json
git commit -m "feat: add single-page dashboard with print-status filters and presets"
```

### Task 9: End-to-End Verification and Runbook

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run backend, provider, jobs, and UI tests**

Run: `bun test`
Expected: PASS all backend/core/provider/job tests.

- [ ] **Step 2: Run frontend tests**

Run: `bun --cwd apps/web run test`
Expected: PASS.

- [ ] **Step 3: Verify manual flow**

Run:
- `bun run dev:api`
- `curl -s -X POST http://localhost:3000/jobs/ingest/onepiece`
- `curl -s -X POST http://localhost:3000/jobs/scrape/prices -H "content-type: application/json" -d '{"setIds":["s1"]}'`
- `curl -s -X POST http://localhost:3000/jobs/recompute/flags`
- `curl -s http://localhost:3000/dashboard`

Expected: job statuses transition correctly; dashboard payload includes `sets` and `cards`.

- [ ] **Step 4: Document setup and operations in README**

````md
## Local Setup

```bash
bun install
cp .env.example .env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cardtracker bunx drizzle-kit generate --config packages/data/drizzle.config.ts
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
curl -X POST http://localhost:3000/jobs/scrape/prices -H "content-type: application/json" -d '{"setIds":["s1"]}'
curl -X POST http://localhost:3000/jobs/recompute/flags
curl http://localhost:3000/jobs/<jobId>
```

## Dashboard Filters

- UI filter key: `set`
- API query param: `setId`
- Other filters: `printStatus`, `tcgType`, `rarity`, `chaseOnly`
- Presets: `Store Hunter` and `Vault`

## MVP Limits

- One Piece ingestion only in phase 1
- Scrape source is best-effort and may return partial runs
````

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add mvp runbook and verification steps"
```

## Done Criteria Checklist

- [ ] Schema includes required unique identities and `job_runs`
- [ ] Rule engines pass deterministic fixture tests
- [ ] Ingest/scrape/recompute jobs are idempotent and resilient
- [ ] API contracts return agreed status codes and payload shapes
- [ ] Dashboard is a single page with in-print/OOP filters and presets
- [ ] Test suites pass in CI/local commands listed above
