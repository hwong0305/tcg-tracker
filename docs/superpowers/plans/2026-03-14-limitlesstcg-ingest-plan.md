# LimitlessTCG Card Scraping Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scraping from limitlesstcg.com to fill missing card data (images, release dates, parallel variants) in the database.

**Architecture:** New scraper module in providers, new ingest job, extend existing schema with nullable columns.

**Tech Stack:** Bun, TypeScript, Cheerio (HTML parsing), Drizzle ORM.

---

## File Structure Map

- Create: `packages/providers/src/limitless/scraper.ts` — HTML fetching + parsing
- Create: `packages/providers/src/limitless/normalize.ts` — Transform to normalized format
- Modify: `packages/providers/src/index.ts` — Export new modules
- Modify: `packages/data/src/schema.ts` — Add new columns
- Create: `packages/jobs/src/ingest-limitless.ts` — New ingest job
- Modify: `packages/jobs/src/index.ts` — Export new job
- Test: `packages/providers/test/limitless.test.ts`
- Test: `packages/jobs/test/ingest-limitless.test.ts`

---

## Chunk 1: Database Schema + Provider Setup

### Task 1: Add schema columns

**Files:**
- Modify: `packages/data/src/schema.ts`

- [ ] **Step 1: Add new columns to sets table**

Add after `isOutOfPrint` column (line 13):

```typescript
eurBoxPrice: decimal("eur_box_price", { precision: 10, scale: 2 }),
```

- [ ] **Step 2: Add new columns to cards table**

Add after `lastPriceUpdated` column (line 31):

```typescript
parallelVariant: text("parallel_variant"),
```

- [ ] **Step 3: Commit**

```bash
git add packages/data/src/schema.ts
git commit -m "feat: add eurBoxPrice and parallelVariant columns"
```

### Task 2: Add cheerio dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add cheerio to dependencies**

Run: `bun add cheerio`

Or add to root package.json devDependencies: `"cheerio": "^1.0.0"`

- [ ] **Step 2: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add cheerio for HTML parsing"
```

---

## Chunk 2: Limitless Scraper Module

### Task 3: Create scraper module

**Files:**
- Create: `packages/providers/src/limitless/scraper.ts`
- Create: `packages/providers/src/limitless/normalize.ts`
- Modify: `packages/providers/src/index.ts`

- [ ] **Step 1: Write failing tests for scraper**

Create `packages/providers/test/limitless.test.ts`:

```typescript
import { describe, test, expect } from "vitest";

describe("limitless scraper", () => {
  test("fetchLimitlessSets parses set list from /cards", async () => {
    const mockHtml = `
      <table>
        <tr>
          <td><a href="/cards/op01-romance-dawn">OP01</a></td>
          <td><a href="/cards/op01-romance-dawn">Romance Dawn</a></td>
          <td>02 Dec 22</td>
          <td>154</td>
          <td>$6,130.18</td>
          <td>7,054.18€</td>
        </tr>
      </table>
    `;
    
    globalThis.fetch = async () => new Response(mockHtml, {
      status: 200,
      headers: { "content-type": "text/html" }
    }) as any;

    const { fetchLimitlessSets } = await import("../src/limitless/scraper");
    const sets = await fetchLimitlessSets("https://onepiece.limitlesstcg.com");
    
    expect(sets).toHaveLength(1);
    expect(sets[0].sourceSetId).toBe("OP01");
    expect(sets[0].setName).toBe("Romance Dawn");
  });

  test("fetchLimitlessCards parses cards from /cards/op01-romance-dawn", async () => {
    const mockHtml = `
      <div class="card-list">
        <a href="/cards/OP01-001"><img src="https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/OP01/OP01-001_EN.webp"></a>
        <a href="/cards/OP01-001?v=1"><img src="https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/OP01/OP01-001_p1_EN.webp"></a>
      </div>
    `;
    
    globalThis.fetch = async () => new Response(mockHtml, {
      status: 200,
      headers: { "content-type": "text/html" }
    }) as any;

    const { fetchLimitlessCards } = await import("../src/limitless/scraper");
    const cards = await fetchLimitlessCards("https://onepiece.limitlesstcg.com", "OP01");
    
    expect(cards).toHaveLength(2);
    expect(cards[0].sourceCardId).toBe("OP01-001");
    expect(cards[0].imageUrl).toContain("OP01-001_EN.webp");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test packages/providers/test/limitless.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create scraper module**

Create `packages/providers/src/limitless/scraper.ts`:

```typescript
import * as cheerio from "cheerio";

export interface LimitlessSet {
  sourceSetId: string;
  setName: string;
  releaseDate: string | null;
  cardCount: number;
  usdTotal: number | null;
  eurTotal: number | null;
}

export interface LimitlessCard {
  sourceCardId: string;
  imageUrl: string | null;
  parallelVariant: string | null;
}

export async function fetchLimitlessSets(baseUrl: string): Promise<LimitlessSet[]> {
  const res = await fetch(`${baseUrl}/cards`);
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const sets: LimitlessSet[] = [];
  
  $("table tr").each((_, row) => {
    const cells = $(row).find("td");
    const link = $(cells[0]).find("a");
    const href = link.attr("href") || "";
    const sourceSetId = href.replace("/cards/", "").split("-")[0].toUpperCase();
    const setName = $(cells[1]).find("a").text();
    const releaseDateStr = $(cells[2]).text().trim();
    const releaseDate = releaseDateStr ? formatDate(releaseDateStr) : null;
    const cardCount = parseInt($(cells[3]).text()) || 0;
    const usdStr = $(cells[4]).text().replace(/[$,]/g, "");
    const eurStr = $(cells[5]).text().replace(/[€,]/g, "");
    
    if (sourceSetId && setName) {
      sets.push({
        sourceSetId,
        setName,
        releaseDate,
        cardCount,
        usdTotal: usdStr ? parseFloat(usdStr) : null,
        eurTotal: eurStr ? parseFloat(eurStr) : null
      });
    }
  });
  
  return sets;
}

export async function fetchLimitlessCards(baseUrl: string, setCode: string): Promise<LimitlessCard[]> {
  const slug = setCode.toLowerCase().replace("op", "op").replace("st", "st");
  const res = await fetch(`${baseUrl}/cards/${slug}`);
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const cards: LimitlessCard[] = [];
  
  $("div.card-list a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const img = $(el).find("img");
    const src = img.attr("src") || "";
    
    const cardMatch = href.match(/cards\/([^?]+)/);
    if (!cardMatch) return;
    
    const sourceCardId = cardMatch[1].toUpperCase();
    const isParallel = href.includes("?v=");
    const parallelVariant = isParallel ? "Parallel" : null;
    
    cards.push({
      sourceCardId,
      imageUrl: src || null,
      parallelVariant
    });
  });
  
  return cards;
}

function formatDate(str: string): string | null {
  const match = str.match(/(\d{2})\s+(\w+)\s+(\d{2})/);
  if (!match) return null;
  
  const months: Record<string, string> = {
    "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
    "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
    "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12"
  };
  
  const [, day, month, year] = match;
  const monthNum = months[month];
  if (!monthNum) return null;
  
  return `20${year}-${monthNum}-${day.padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run tests to verify failure**

Run: `bun test packages/providers/test/limitless.test.ts`
Expected: FAIL — but now module exists, tests may fail on parsing logic

- [ ] **Step 5: Fix scraper based on actual HTML**

The HTML structure from the fetched pages will differ. Fetch the actual page and adjust selectors.

- [ ] **Step 6: Run tests to verify pass**

Run: `bun test packages/providers/test/limitless.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/providers/src/limitless/scraper.ts packages/providers/test/limitless.test.ts
git commit -m "feat: add limitless scraper module"
```

### Task 4: Create normalize module

**Files:**
- Create: `packages/providers/src/limitless/normalize.ts`

- [ ] **Step 1: Write normalize functions**

```typescript
import type { LimitlessSet, LimitlessCard } from "./scraper";

export interface NormalizedLimitlessSet {
  sourceSetId: string;
  setName: string;
  releaseDate: string | null;
  currentBoxPrice: number | null;
  eurBoxPrice: number | null;
}

export interface NormalizedLimitlessCard {
  sourceCardId: string;
  imageUrl: string | null;
  parallelVariant: string | null;
}

export function normalizeLimitlessSet(raw: LimitlessSet): NormalizedLimitlessSet {
  return {
    sourceSetId: raw.sourceSetId,
    setName: raw.setName,
    releaseDate: raw.releaseDate,
    currentBoxPrice: raw.usdTotal,
    eurBoxPrice: raw.eurTotal
  };
}

export function normalizeLimitlessCard(raw: LimitlessCard): NormalizedLimitlessCard {
  return {
    sourceCardId: raw.sourceCardId,
    imageUrl: raw.imageUrl,
    parallelVariant: raw.parallelVariant
  };
}
```

- [ ] **Step 2: Export from barrel**

Modify `packages/providers/src/index.ts`:

```typescript
export { fetchLimitlessSets, fetchLimitlessCards } from "./limitless/scraper";
export { normalizeLimitlessSet, normalizeLimitlessCard } from "./limitless/normalize";
```

- [ ] **Step 3: Commit**

```bash
git add packages/providers/src/limitless/normalize.ts packages/providers/src/index.ts
git commit -m "feat: add limitless normalize module"
```

---

## Chunk 3: Ingest Job

### Task 5: Create ingest-limitless job

**Files:**
- Create: `packages/jobs/src/ingest-limitless.ts`
- Modify: `packages/jobs/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/jobs/test/ingest-limitless.test.ts`:

```typescript
import { describe, test, expect, beforeEach } from "vitest";

describe("ingest-limitless", () => {
  test("fetches sets and cards from limitlesstcg.com", async () => {
    const mockSets = [
      { sourceSetId: "OP01", setName: "Romance Dawn", releaseDate: "2022-12-02", usdTotal: 6130.18, eurTotal: 7054.18 }
    ];
    const mockCards = [
      { sourceCardId: "OP01-001", imageUrl: "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/OP01/OP01-001_EN.webp", parallelVariant: null }
    ];
    
    globalThis.fetch = async (url: string) => {
      if (url.includes("/cards")) {
        return new Response(`<html><table><tr><td><a href="/cards/op01">OP01</a></td></tr></table></html>`, {
          status: 200,
          headers: { "content-type": "text/html" }
        });
      }
      return new Response("<html><div class='card-list'></div></html>", {
        status: 200,
        headers: { "content-type": "text/html" }
      });
    } as any;

    const { runIngestLimitlessJob } = await import("../src/ingest-limitless");
    const result = await runIngestLimitlessJob({});
    
    expect(result.status).toBe("completed");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test packages/jobs/test/ingest-limitless.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create ingest job**

Create `packages/jobs/src/ingest-limitless.ts`:

```typescript
import { setsRepo } from "../../data/src/repos/sets-repo";
import { cardsRepo } from "../../data/src/repos/cards-repo";
import { jobsRepo } from "../../data/src/repos/jobs-repo";
import { fetchLimitlessSets, fetchLimitlessCards, normalizeLimitlessSet, normalizeLimitlessCard } from "../../providers/src";

type IngestInput = { baseUrl?: string; setIds?: string[] };

export async function runIngestLimitlessJob(input: IngestInput, options?: { jobId?: string }) {
  const run = options?.jobId
    ? { id: options.jobId }
    : await jobsRepo.create({ type: "ingest-limitless", status: "queued", requestPayloadJson: input });

  try {
    await jobsRepo.markRunning(run.id);

    const baseUrl = input.baseUrl || "https://onepiece.limitlesstcg.com";
    
    const rawSets = await fetchLimitlessSets(baseUrl);
    const validSets = rawSets.map(normalizeLimitlessSet);
    
    const setUpsert = await setsRepo.upsertMany(
      validSets.map(s => ({
        tcgType: "OnePiece" as const,
        sourceSetId: s.sourceSetId,
        setName: s.setName,
        releaseDate: s.releaseDate,
        currentBoxPrice: s.currentBoxPrice,
        eurBoxPrice: s.eurBoxPrice,
        msrpPackPrice: "4.49",
        isOutOfPrint: false
      }))
    );

    const setIdBySource = new Map(setUpsert.rows.map((row: any) => [row.sourceSetId, row.id]));

    const allCards: any[] = [];
    for (const set of validSets) {
      await new Promise(r => setTimeout(r, 500));
      const rawCards = await fetchLimitlessCards(baseUrl, set.sourceSetId);
      const setId = setIdBySource.get(set.sourceSetId);
      if (setId) {
        for (const card of rawCards) {
          const normalized = normalizeLimitlessCard(card);
          allCards.push({
            sourceCardId: normalized.sourceCardId,
            setId,
            cardName: null,
            rarity: null,
            marketPrice: null,
            isChase: false,
            imageUrl: normalized.imageUrl,
            parallelVariant: normalized.parallelVariant,
            tcgType: "OnePiece" as const
          });
        }
      }
    }

    const cardStats = allCards.length > 0
      ? await cardsRepo.upsertMany(allCards)
      : { created: 0, updated: 0, rows: [] };

    const stats = {
      createdSets: setUpsert.created,
      updatedSets: setUpsert.updated,
      createdCards: cardStats.created,
      updatedCards: cardStats.updated,
      totalSetsScraped: validSets.length,
      totalCardsScraped: allCards.length
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

if (import.meta.main) {
  await runIngestLimitlessJob({});
}
```

- [ ] **Step 4: Export from jobs index**

Modify `packages/jobs/src/index.ts`:

```typescript
export { runIngestOnePieceJob } from "./ingest-onepiece";
export { runIngestLimitlessJob } from "./ingest-limitless";
```

- [ ] **Step 5: Run tests**

Run: `bun test packages/jobs/test/ingest-limitless.test.ts`
Expected: PASS (or FAIL if repos need updating)

- [ ] **Step 6: Commit**

```bash
git add packages/jobs/src/ingest-limitless.ts packages/jobs/src/index.ts
git commit -m "feat: add ingest-limitless job"
```

---

## Chunk 4: Full Integration

### Task 6: Run full verification

**Files:**
- Run integration tests

- [ ] **Step 1: Run all provider tests**

Run: `bun test packages/providers/test/limitless.test.ts`
Expected: PASS

- [ ] **Step 2: Run all job tests**

Run: `bun test packages/jobs/test/`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `bun test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete limitlesstcg ingest implementation"
```

---

## Cross-Cutting Execution Rules

- Apply @superpowers:test-driven-development for each behavior change (red → green → refactor)
- If any test fails unexpectedly, apply @superpowers:systematic-debugging before implementation changes
- Before announcing success, run @superpowers:verification-before-completion commands and quote the exact pass output
