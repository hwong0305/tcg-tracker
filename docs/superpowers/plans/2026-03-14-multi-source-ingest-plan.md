# Multi-Source One Piece Ingest Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend ingest to fetch from 3 upstream endpoints (`allSetCards`, `allSTCards`, `allPromos`), deduplicate by `card_set_id` (latest `date_scraped` wins), and persist via existing pipeline.

**Architecture:** Add two new fetcher functions mirroring existing `fetchOnePieceAllSetCards`, add a pure `deduplicateRows` function, update ingest job to call all 3 sequentially and merge before normalization. No schema, frontend, or API route changes.

**Tech Stack:** Bun, TypeScript, Elysia, Drizzle ORM.

---

## File Structure Map

- Modify: `packages/providers/src/onepiece/client.ts` (add `fetchOnePieceAllSTCards`, `fetchOnePieceAllPromos`)
- Modify: `packages/providers/src/onepiece/normalize.ts` (add `deduplicateRows`)
- Modify: `packages/providers/src/index.ts` (export new functions)
- Modify: `packages/providers/test/onepiece.errors.test.ts` (add fetcher contract tests)
- Modify: `packages/providers/test/onepiece.normalize.test.ts` (add dedup tests)
- Modify: `packages/jobs/src/ingest-onepiece.ts` (fetch 3 sources, merge, dedup)
- Modify: `packages/jobs/test/ingest-onepiece.test.ts` (update mocks for 3 endpoints, verify stats)

## Chunk 1: Provider Fetchers + Dedup Function

### Task 1: Add `fetchOnePieceAllSTCards` and `fetchOnePieceAllPromos`

**Files:**
- Modify: `packages/providers/src/onepiece/client.ts:45-58`
- Modify: `packages/providers/src/index.ts:1`
- Modify: `packages/providers/test/onepiece.errors.test.ts`

- [ ] **Step 1: Write failing tests for both new fetchers**

Add to `packages/providers/test/onepiece.errors.test.ts`:

```ts
test("fetchOnePieceAllSTCards calls /api/allSTCards/", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify([{ set_id: "ST-01", set_name: "Starter Deck 1", card_set_id: "ST01-001", card_name: "Luffy" }]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as any;

  const rows = await fetchOnePieceAllSTCards("https://www.optcgapi.com");
  expect(calls[0]).toBe("https://www.optcgapi.com/api/allSTCards/");
  expect(Array.isArray(rows)).toBe(true);
});

test("fetchOnePieceAllPromos calls /api/allPromos/", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify([{ set_id: "P", set_name: "Promos", card_set_id: "P-001", card_name: "Promo Luffy" }]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as any;

  const rows = await fetchOnePieceAllPromos("https://www.optcgapi.com");
  expect(calls[0]).toBe("https://www.optcgapi.com/api/allPromos/");
  expect(Array.isArray(rows)).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test packages/providers/test/onepiece.errors.test.ts`
Expected: FAIL — `fetchOnePieceAllSTCards` and `fetchOnePieceAllPromos` not found.

- [ ] **Step 3: Implement both fetchers**

Add to `packages/providers/src/onepiece/client.ts` after `fetchOnePieceAllSetCards`:

```ts
export async function fetchOnePieceAllSTCards(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/allSTCards/`);
    if (!res.ok) throw mapOnePieceError(new Error(`HTTP_${res.status}`), "card");
    try {
      return await res.json();
    } catch {
      throw mapOnePieceError(new Error("INVALID_JSON"), "card");
    }
  } catch (error) {
    if (isProviderError(error)) throw error;
    throw mapOnePieceError(error instanceof Error ? error : new Error(String(error)), "card");
  }
}

export async function fetchOnePieceAllPromos(baseUrl: string) {
  try {
    const res = await fetch(`${baseUrl}/api/allPromos/`);
    if (!res.ok) throw mapOnePieceError(new Error(`HTTP_${res.status}`), "card");
    try {
      return await res.json();
    } catch {
      throw mapOnePieceError(new Error("INVALID_JSON"), "card");
    }
  } catch (error) {
    if (isProviderError(error)) throw error;
    throw mapOnePieceError(error instanceof Error ? error : new Error(String(error)), "card");
  }
}
```

- [ ] **Step 4: Export from barrel**

Update `packages/providers/src/index.ts` line 1:

```ts
export { fetchOnePieceSets, fetchOnePieceCards, fetchOnePieceAllSetCards, fetchOnePieceAllSTCards, fetchOnePieceAllPromos, mapOnePieceError } from "./onepiece/client";
```

- [ ] **Step 5: Run tests to verify pass**

Run: `bun test packages/providers/test/onepiece.errors.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/providers/src/onepiece/client.ts packages/providers/src/index.ts packages/providers/test/onepiece.errors.test.ts
git commit -m "feat: add allSTCards and allPromos provider fetchers"
```

### Task 2: Add `deduplicateRows` function

**Files:**
- Modify: `packages/providers/src/onepiece/normalize.ts:88`
- Modify: `packages/providers/src/index.ts:2`
- Modify: `packages/providers/test/onepiece.normalize.test.ts`

- [ ] **Step 1: Write failing dedup tests**

Add to `packages/providers/test/onepiece.normalize.test.ts`:

```ts
test("deduplicateRows keeps row with latest date_scraped for same card_set_id", () => {
  const rows = [
    { card_set_id: "OP01-001", card_name: "Zoro", set_id: "OP-01", set_name: "Romance Dawn", date_scraped: "2026-03-12" },
    { card_set_id: "OP01-001", card_name: "Zoro Promo", set_id: "OP-01", set_name: "Romance Dawn", date_scraped: "2026-03-13" }
  ];
  const result = deduplicateRows(rows);
  expect(result.deduplicated.length).toBe(1);
  expect(result.deduplicated[0].card_name).toBe("Zoro Promo");
  expect(result.duplicatesRemoved).toBe(1);
});

test("deduplicateRows keeps last-in-array when date_scraped is equal", () => {
  const rows = [
    { card_set_id: "ST01-015", card_name: "First", set_id: "ST-01", set_name: "Starter 1", date_scraped: "2026-03-13" },
    { card_set_id: "ST01-015", card_name: "Second", set_id: "ST-01", set_name: "Starter 1", date_scraped: "2026-03-13" }
  ];
  const result = deduplicateRows(rows);
  expect(result.deduplicated.length).toBe(1);
  expect(result.deduplicated[0].card_name).toBe("Second");
  expect(result.duplicatesRemoved).toBe(1);
});

test("deduplicateRows keeps last-in-array when date_scraped is missing", () => {
  const rows = [
    { card_set_id: "X-001", card_name: "First", set_id: "X", set_name: "Set X" },
    { card_set_id: "X-001", card_name: "Second", set_id: "X", set_name: "Set X" }
  ];
  const result = deduplicateRows(rows);
  expect(result.deduplicated.length).toBe(1);
  expect(result.deduplicated[0].card_name).toBe("Second");
});

test("deduplicateRows keeps all rows with different card_set_id", () => {
  const rows = [
    { card_set_id: "OP01-001", card_name: "A", set_id: "OP-01", set_name: "S1", date_scraped: "2026-03-12" },
    { card_set_id: "OP01-002", card_name: "B", set_id: "OP-01", set_name: "S1", date_scraped: "2026-03-12" }
  ];
  const result = deduplicateRows(rows);
  expect(result.deduplicated.length).toBe(2);
  expect(result.duplicatesRemoved).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test packages/providers/test/onepiece.normalize.test.ts`
Expected: FAIL — `deduplicateRows` not found.

- [ ] **Step 3: Implement `deduplicateRows`**

Add to end of `packages/providers/src/onepiece/normalize.ts`:

```ts
export function deduplicateRows(rows: any[]): { deduplicated: any[]; duplicatesRemoved: number } {
  const groups = new Map<string, any[]>();

  for (const row of rows) {
    const key = row.card_set_id;
    if (!key) continue;
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const deduplicated: any[] = [];
  let duplicatesRemoved = 0;

  for (const group of groups.values()) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
    } else {
      duplicatesRemoved += group.length - 1;
      let best = group[0];
      for (let i = 1; i < group.length; i++) {
        const current = group[i];
        const bestDate = best.date_scraped ? new Date(best.date_scraped).getTime() : 0;
        const currentDate = current.date_scraped ? new Date(current.date_scraped).getTime() : 0;
        if (currentDate >= bestDate) {
          best = current;
        }
      }
      deduplicated.push(best);
    }
  }

  return { deduplicated, duplicatesRemoved };
}
```

- [ ] **Step 4: Export from barrel**

Update `packages/providers/src/index.ts` line 2:

```ts
export { normalizeSet, normalizeCard, normalizeAllSetCardRow, deduplicateRows } from "./onepiece/normalize";
```

- [ ] **Step 5: Run tests to verify pass**

Run: `bun test packages/providers/test/onepiece.normalize.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/providers/src/onepiece/normalize.ts packages/providers/src/index.ts packages/providers/test/onepiece.normalize.test.ts
git commit -m "feat: add deduplicateRows for multi-source card merging"
```

## Chunk 2: Ingest Job Update + Full Verification

### Task 3: Update ingest job to fetch all 3 sources and dedup

**Files:**
- Modify: `packages/jobs/src/ingest-onepiece.ts:4,83-84,140-146`
- Modify: `packages/jobs/test/ingest-onepiece.test.ts`

- [ ] **Step 1: Write failing test for multi-source fetch + dedup stats**

Add to `packages/jobs/test/ingest-onepiece.test.ts`:

```ts
test("ingest fetches from all 3 endpoints and deduplicates", async () => {
  const setCards = [
    { set_id: "OP-01", set_name: "Romance Dawn", card_set_id: "OP01-001", card_name: "Zoro", date_scraped: "2026-03-12" }
  ];
  const stCards = [
    { set_id: "ST-01", set_name: "Starter 1", card_set_id: "ST01-001", card_name: "Luffy", date_scraped: "2026-03-12" }
  ];
  const promos = [
    { set_id: "OP-01", set_name: "Romance Dawn", card_set_id: "OP01-001", card_name: "Zoro Promo", date_scraped: "2026-03-13" }
  ];

  const fetchCalls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    fetchCalls.push(url);
    if (url.includes("/api/allSetCards/")) return new Response(JSON.stringify(setCards), { status: 200 });
    if (url.includes("/api/allSTCards/")) return new Response(JSON.stringify(stCards), { status: 200 });
    if (url.includes("/api/allPromos/")) return new Response(JSON.stringify(promos), { status: 200 });
    return new Response("[]", { status: 200 });
  }) as any;

  const { setsRepo } = await import("../../data/src/repos/sets-repo");
  const origSets = setsRepo.upsertMany;
  setsRepo.upsertMany = async (sets: any[]) => ({
    created: sets.length, updated: 0,
    rows: sets.map((s, i) => ({ ...s, id: `set-${i}`, sourceSetId: s.sourceSetId }))
  });

  const { cardsRepo } = await import("../../data/src/repos/cards-repo");
  const origCards = cardsRepo.upsertMany;
  let upsertedCards: any[] = [];
  cardsRepo.upsertMany = async (cards: any[]) => {
    upsertedCards = cards;
    return { created: cards.length, updated: 0, rows: cards.map((c, i) => ({ ...c, id: `card-${i}` })) };
  };

  const { jobsRepo } = await import("../../data/src/repos/jobs-repo");
  const origCreate = jobsRepo.create;
  const origMark = jobsRepo.markRunning;
  const origFin = jobsRepo.finalize;
  let finalStats: any = null;
  (jobsRepo as any).create = async () => ({ id: "job-multi" });
  (jobsRepo as any).markRunning = async () => {};
  (jobsRepo as any).finalize = async (_id: string, r: any) => { finalStats = r.statsJson; };

  try {
    await runIngestOnePieceJob({});

    expect(fetchCalls).toContainEqual(expect.stringContaining("/api/allSetCards/"));
    expect(fetchCalls).toContainEqual(expect.stringContaining("/api/allSTCards/"));
    expect(fetchCalls).toContainEqual(expect.stringContaining("/api/allPromos/"));
    expect(fetchCalls.length).toBe(3);

    // Promo OP01-001 overwrites set card OP01-001 (later date_scraped)
    expect(upsertedCards.length).toBe(2);
    const zoro = upsertedCards.find((c: any) => c.sourceCardId === "OP01-001");
    expect(zoro.cardName).toBe("Zoro Promo");

    expect(finalStats.totalFetched).toBe(3);
    expect(finalStats.duplicatesRemoved).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
    setsRepo.upsertMany = origSets;
    cardsRepo.upsertMany = origCards;
    jobsRepo.create = origCreate;
    jobsRepo.markRunning = origMark;
    jobsRepo.finalize = origFin;
  }
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test packages/jobs/test/ingest-onepiece.test.ts`
Expected: FAIL — only 1 fetch call, no `totalFetched`/`duplicatesRemoved` in stats.

- [ ] **Step 3: Update ingest job implementation**

In `packages/jobs/src/ingest-onepiece.ts`:

1. Update import (line 4):
```ts
import { fetchOnePieceAllSetCards, fetchOnePieceAllSTCards, fetchOnePieceAllPromos, normalizeAllSetCardRow, deduplicateRows } from "../../providers/src";
```

2. Replace single fetch (lines 83-84) with sequential 3-source fetch + dedup:
```ts
    const baseUrl = input.onePieceBaseUrl || process.env.ONEPIECE_API_BASE_URL || "https://www.optcgapi.com";
    const rawSetCards = await fetchOnePieceAllSetCards(baseUrl) as any[];
    const rawSTCards = await fetchOnePieceAllSTCards(baseUrl) as any[];
    const rawPromos = await fetchOnePieceAllPromos(baseUrl) as any[];

    const allRawRows = [...rawSetCards, ...rawSTCards, ...rawPromos];
    const totalFetched = allRawRows.length;
    const { deduplicated: rawRows, duplicatesRemoved } = deduplicateRows(allRawRows);
```

3. Update stats object (lines 140-146) to include new fields:
```ts
    const stats = {
      totalFetched,
      duplicatesRemoved,
      createdSets: setUpsert.created,
      updatedSets: setUpsert.updated,
      createdCards: cardStats.created,
      updatedCards: cardStats.updated,
      invalidRows: invalidRowCount
    };
```

- [ ] **Step 4: Run all tests to verify pass**

Run: `bun test packages/jobs/test/ingest-onepiece.test.ts`
Expected: PASS (4 tests).

Run: `bun test packages/providers/test/onepiece.errors.test.ts packages/providers/test/onepiece.normalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/ingest-onepiece.ts packages/jobs/test/ingest-onepiece.test.ts
git commit -m "feat: ingest from allSetCards, allSTCards, and allPromos with dedup"
```

### Task 4: Full verification and docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README ingest docs**

Replace the "Card Ingest Source" section in `README.md`:

```markdown
## Card Ingest Source

The ingest job fetches cards from three upstream endpoints in sequence:
1. `GET ${ONEPIECE_API_BASE_URL}/api/allSetCards/` (booster/expansion sets)
2. `GET ${ONEPIECE_API_BASE_URL}/api/allSTCards/` (starter decks)
3. `GET ${ONEPIECE_API_BASE_URL}/api/allPromos/` (promo cards)

Default base URL: `https://www.optcgapi.com`. Rows are deduplicated by `card_set_id` — when the same card appears in multiple sources, the row with the latest `date_scraped` is kept. Ingest stats report `totalFetched`, `duplicatesRemoved`, and `invalidRows`.
```

- [ ] **Step 2: Run full verification (@superpowers:verification-before-completion)**

Run: `bun test apps/api packages` (workdir: worktree root)
Run: `bun run test` (workdir: `apps/web`)
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe multi-source ingest with dedup behavior"
```

## Cross-Cutting Execution Rules

- Apply @superpowers:test-driven-development for each behavior change (red -> green -> refactor).
- If any test fails unexpectedly, apply @superpowers:systematic-debugging before implementation changes.
- Before announcing success, run @superpowers:verification-before-completion commands and quote the exact pass output.
