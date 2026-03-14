# CardTracker Core Remaining Objective Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining work to move CardTracker Core from validated prototype behavior to durable, repeatable, end-to-end MVP operation.

**Architecture:** Keep the current domain-first monolith and replace in-memory behavior with durable PostgreSQL persistence while preserving existing service interfaces. Strengthen job execution and compose startup so local runtime is truly one-command reproducible. Finalize with CI and operational checks to guarantee ongoing correctness.

**Tech Stack:** Bun, TypeScript, Elysia, Drizzle ORM, PostgreSQL, Playwright, React, Vite, Vitest, Docker Compose.

---

## Objective Completion Definition

Objective is complete when all of the following are true:

- Data survives process/container restarts (sets/cards/jobs not memory-only).
- Queue endpoints (`ingest`, `scrape`, `recompute`) persist and transition job states reliably.
- Compose startup is one-command for full stack and includes schema readiness.
- Dashboard data is served from persistent storage and reflects job output.
- Automated verification runs in CI with green tests/build checks.

## Current Status Snapshot

- Implemented: project scaffolding, core rules, provider adapters, job orchestration, API routes, dashboard filters, compose stack, dev seed fallback, async job enqueue/execute wiring.
- Gap to close: repository layer still primarily in-memory behavior; durability and production-readiness checks are incomplete.

## Chunk 1: Persistent Repository Layer

### Task 1: Replace in-memory `jobsRepo` with Drizzle-backed persistence

**Files:**
- Modify: `packages/data/src/repos/jobs-repo.ts`
- Test: `packages/data/test/jobs-repo.test.ts`

- [x] **Step 1: Write failing repo tests for create/markRunning/finalize/getById persistence**
- [x] **Step 2: Run tests to verify failure**

Run: `bun test packages/data/test/jobs-repo.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement Drizzle queries using `job_runs` table**
- [x] **Step 4: Run tests to verify pass**

Run: `bun test packages/data/test/jobs-repo.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/data/src/repos/jobs-repo.ts packages/data/test/jobs-repo.test.ts
git commit -m "feat: persist job runs with drizzle repository"
```

### Task 2: Replace in-memory `setsRepo` and `cardsRepo` with Drizzle-backed persistence

**Files:**
- Modify: `packages/data/src/repos/sets-repo.ts`
- Modify: `packages/data/src/repos/cards-repo.ts`
- Test: `packages/data/test/sets-repo.test.ts`
- Test: `packages/data/test/cards-repo.test.ts`

- [x] **Step 1: Write failing tests for upsert idempotency and filter queries**
- [x] **Step 2: Run tests to verify failure**

Run: `bun test packages/data/test/sets-repo.test.ts`
Run: `bun test packages/data/test/cards-repo.test.ts`
Expected: FAIL.

- [x] **Step 3: Implement DB upserts using unique conflict keys from schema**
- [x] **Step 4: Implement filter/read methods used by API/jobs**
- [x] **Step 5: Run tests to verify pass**

Run: `bun test packages/data/test/sets-repo.test.ts`
Run: `bun test packages/data/test/cards-repo.test.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add packages/data/src/repos/sets-repo.ts packages/data/src/repos/cards-repo.ts packages/data/test/sets-repo.test.ts packages/data/test/cards-repo.test.ts
git commit -m "feat: persist set and card repositories with drizzle"
```

## Chunk 2: Job Runtime Durability and Determinism

### Task 3: Strengthen async job execution semantics

**Files:**
- Modify: `apps/api/src/services/jobs-api.ts`
- Modify: `packages/jobs/src/ingest-onepiece.ts`
- Modify: `packages/jobs/src/scrape-prices.ts`
- Modify: `packages/jobs/src/recompute-flags.ts`
- Test: `apps/api/test/jobs-routes.test.ts`

- [x] **Step 1: Add failing tests for reliable state transitions and failed job persistence**
- [x] **Step 2: Run tests to verify failure**

Run: `bun test apps/api/test/jobs-routes.test.ts`
Expected: FAIL.

- [x] **Step 3: Ensure every queue path is `queued -> running -> completed|partial|failed` with persisted errors/stats**
- [x] **Step 4: Ensure no unhandled background promise failures**
- [x] **Step 5: Run tests to verify pass**

Run: `bun test apps/api/test/jobs-routes.test.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add apps/api/src/services/jobs-api.ts packages/jobs/src/ingest-onepiece.ts packages/jobs/src/scrape-prices.ts packages/jobs/src/recompute-flags.ts apps/api/test/jobs-routes.test.ts
git commit -m "fix: harden async job lifecycle persistence and error handling"
```

## Chunk 3: Compose Runtime Completion

### Task 4: Auto-apply schema on API container startup

**Files:**
- Create: `scripts/api-entrypoint.sh`
- Modify: `Dockerfile.api`
- Modify: `docker-compose.yml`
- Test: `apps/api/test/docker-compose.test.ts`
- Modify: `README.md`

- [x] **Step 1: Add failing compose test for migration-on-start command presence**
- [x] **Step 2: Run test to verify failure**

Run: `bun test apps/api/test/docker-compose.test.ts`
Expected: FAIL.

- [x] **Step 3: Add API entrypoint script to wait for DB and run `drizzle-kit push` before `dev:api`**
- [x] **Step 4: Wire entrypoint in Dockerfile/compose and update README command docs**
- [x] **Step 5: Run test to verify pass**

Run: `bun test apps/api/test/docker-compose.test.ts`
Expected: PASS.

- [x] **Step 6: Verify manually with compose**

Run: `docker compose up --build -d && docker compose ps`
Expected: healthy `postgres`, running `api`/`web` without manual migration command.

- [x] **Step 7: Commit**

```bash
git add scripts/api-entrypoint.sh Dockerfile.api docker-compose.yml apps/api/test/docker-compose.test.ts README.md
git commit -m "feat: run database migration automatically on api container startup"
```

## Chunk 4: Final Verification and CI

### Task 5: Add CI workflow for repeatable validation

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

- [x] **Step 1: Write failing CI lint check locally (if workflow validation script exists) or dry-run checks**
- [x] **Step 2: Implement CI jobs (`bun install`, backend tests, web tests)**
- [x] **Step 3: Run full local verification**

Run: `bun test apps/api packages`
Run: `bun run test` (workdir `apps/web`)
Run: `docker compose up --build -d` then smoke checks (`/health`, `/dashboard`)
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "chore: add ci workflow for backend web and compose smoke verification"
```

## Final Completion Checklist

- [x] `jobsRepo`, `setsRepo`, and `cardsRepo` are DB-backed
- [x] queue endpoints persist and update job states asynchronously with error visibility
- [x] compose startup automatically prepares schema
- [x] dashboard serves persistent data after restarts
- [x] backend and frontend test suites pass
- [x] compose smoke flow passes with and without `devSeed`
- [x] CI enforces regression checks
