# AllSetCards Ingest + Dashboard Theme Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace One Piece ingest with `GET /api/allSetCards/`, expose richer card fields in dashboard responses, and add persistent `system/light/dark` theme support in the web app.

**Architecture:** Keep the existing Bun monolith and replace only the ingest provider path (no dual-mode branch). Normalize flat upstream rows into existing `sets/cards` persistence boundaries, then expose additive dashboard payload fields for UI rendering. Add a frontend theme layer using root `data-theme` + CSS tokens and localStorage-backed preference.

**Tech Stack:** Bun, TypeScript, Elysia, Drizzle ORM, React, Vite, Vitest, Testing Library.

---

## File Structure Map

- Modify: `packages/providers/src/onepiece/client.ts` (new `allSetCards` fetcher + shared error mapping)
- Modify: `packages/providers/src/onepiece/normalize.ts` (row validation/parsing helpers for flat payload)
- Modify: `packages/providers/src/index.ts` (export new provider entrypoints)
- Modify/Create tests: `packages/providers/test/onepiece.errors.test.ts`, `packages/providers/test/onepiece.normalize.test.ts`
- Modify: `packages/jobs/src/ingest-onepiece.ts` (single-fetch ingest flow, setIds filtering, invalid-row handling)
- Modify/Create tests: `packages/jobs/test/ingest-onepiece.test.ts`
- Modify tests: `apps/api/test/jobs-routes.test.ts` (ingest route contract still 202 + persisted terminal state)
- Modify: `packages/data/src/repos/cards-repo.ts` (include `setName` in filtered card read model)
- Modify: `apps/web/src/lib/api.ts` (expanded card type contract)
- Modify: `apps/web/src/App.tsx` (pass richer card data, add theme control state)
- Create: `apps/web/src/components/ThemeToggle.tsx` (theme selector UI)
- Modify: `apps/web/src/components/SetList.tsx` (render image/set/rarity/price/source id)
- Modify: `apps/web/src/styles.css` (theme token sets + dark mode surfaces + toggle styling)
- Modify tests: `apps/web/src/App.test.tsx` (rich card rendering + theme persistence/behavior)
- Modify test setup if needed: `apps/web/src/test/setup.ts` (mock `matchMedia` for `system` mode tests)
- Modify docs: `README.md` (new upstream endpoint note and theme behavior)

## Chunk 1: Provider Contract + Normalization

### Task 1: Add `/api/allSetCards/` provider client and contract tests

**Files:**
- Modify: `packages/providers/src/onepiece/client.ts`
- Modify: `packages/providers/src/index.ts`
- Modify: `packages/providers/test/onepiece.errors.test.ts`

- [ ] **Step 1: Write failing provider test for allSetCards path + response parsing trigger**

```ts
test("fetchOnePieceAllSetCards calls /api/allSetCards", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify([{ set_id: "OP-01", set_name: "Romance Dawn", card_set_id: "OP01-001", card_name: "Zoro" }]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as any;

  const rows = await fetchOnePieceAllSetCards("https://www.optcgapi.com");
  expect(calls[0]).toBe("https://www.optcgapi.com/api/allSetCards/");
  expect(Array.isArray(rows)).toBe(true);
});

test("fetchOnePieceAllSetCards maps network failure to provider error", async () => {
  globalThis.fetch = (async () => {
    throw new Error("ETIMEDOUT");
  }) as any;

  await expect(fetchOnePieceAllSetCards("https://www.optcgapi.com")).rejects.toMatchObject({
    code: "NETWORK_ERROR",
    entity: "card",
    retryable: true
  });
});

test("fetchOnePieceAllSetCards maps invalid JSON parse failure", async () => {
  globalThis.fetch = (async () => new Response("not-json", { status: 200 })) as any;
  await expect(fetchOnePieceAllSetCards("https://www.optcgapi.com")).rejects.toMatchObject({
    code: "HTTP_ERROR",
    entity: "card"
  });
});
```

- [ ] **Step 2: Run provider tests to verify failure**

Run: `bun test packages/providers/test/onepiece.errors.test.ts`
Expected: FAIL with missing `fetchOnePieceAllSetCards`.

- [ ] **Step 3: Implement minimal provider client support**

```ts
export async function fetchOnePieceAllSetCards(baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/allSetCards/`);
  if (!res.ok) throw mapOnePieceError(new Error(`HTTP_${res.status}`), "card");
  return res.json();
}
```

- [ ] **Step 4: Export function from provider barrel**

```ts
export { fetchOnePieceAllSetCards } from "./onepiece/client";
```

- [ ] **Step 5: Run provider tests to verify pass**

Run: `bun test packages/providers/test/onepiece.errors.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/providers/src/onepiece/client.ts packages/providers/src/index.ts packages/providers/test/onepiece.errors.test.ts
git commit -m "feat: add allsetcards provider client for one piece ingest"
```

### Task 2: Add strict row normalization for allSetCards payload

**Files:**
- Modify: `packages/providers/src/onepiece/normalize.ts`
- Modify: `packages/providers/test/onepiece.normalize.test.ts`

- [ ] **Step 1: Write failing normalization tests for required fields and market price parse**

```ts
test("normalizeAllSetCardRow maps required and optional fields", () => {
  const row = normalizeAllSetCardRow({
    set_id: "OP-01",
    set_name: "Romance Dawn",
    card_set_id: "OP01-001",
    card_name: "Zoro",
    rarity: "L",
    market_price: "2.55",
    card_image: "https://img"
  });
  expect(row.marketPrice).toBe(2.55);
  expect(row.sourceCardId).toBe("OP01-001");
});

test("normalizeAllSetCardRow rejects missing required fields", () => {
  expect(() => normalizeAllSetCardRow({ set_id: "OP-01" })).toThrow("INVALID_PAYLOAD");
});

test("normalizeAllSetCardRow rejects empty or whitespace required fields", () => {
  expect(() =>
    normalizeAllSetCardRow({ set_id: "  ", set_name: "Romance Dawn", card_set_id: "OP01-001", card_name: "Zoro" })
  ).toThrow("INVALID_PAYLOAD");
});

test("normalizeAllSetCardRow normalizes optional field empties", () => {
  const row = normalizeAllSetCardRow({
    set_id: "OP-01",
    set_name: "Romance Dawn",
    card_set_id: "OP01-001",
    card_name: "Zoro",
    rarity: "",
    card_image: "",
    inventory_price: "not-a-number"
  });
  expect(row.rarity).toBeNull();
  expect(row.imageUrl).toBeNull();
  expect(row.inventoryPrice).toBeNull();
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test packages/providers/test/onepiece.normalize.test.ts`
Expected: FAIL with missing normalizer.

- [ ] **Step 3: Implement minimal row normalizer with parse rules**

```ts
function parseNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
```

Include required field guard for `set_id`, `set_name`, `card_set_id`, `card_name`.

- [ ] **Step 4: Run test to verify pass**

Run: `bun test packages/providers/test/onepiece.normalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/providers/src/onepiece/normalize.ts packages/providers/test/onepiece.normalize.test.ts
git commit -m "feat: normalize allsetcards payload with strict required fields"
```

## Chunk 2: Ingest Job Replacement + API Contract Safety

### Task 3: Replace ingest flow with single allSetCards fetch

**Files:**
- Modify: `packages/jobs/src/ingest-onepiece.ts`
- Modify: `packages/jobs/test/ingest-onepiece.test.ts`

- [ ] **Step 1: Write failing ingest tests for single-fetch behavior and setIds filtering**

```ts
test("ingest calls allSetCards once and filters setIds", async () => {
  // mock provider returning mixed set rows
  // runIngestOnePieceJob({ setIds: ["OP-01"] })
  // assert upsertMany got only OP-01 rows
  // assert fetchOnePieceAllSetCards called exactly once
  // assert old /sets and /cards?set=... paths are never called
});

test("ingest completes with partial-invalid rows and invalid count", async () => {
  // one invalid row + one valid row => completed with stats.invalidRows = 1
});

test("ingest fails INVALID_PAYLOAD when all rows invalid", async () => {
  // expect rejection and failed job status
  // assert persisted error includes entity=card and code=INVALID_PAYLOAD
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test packages/jobs/test/ingest-onepiece.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement single-fetch ingest logic**

Implementation constraints:

- fetch from `fetchOnePieceAllSetCards(baseUrl)`
- apply `setIds` filter before upsert
- validate rows via new normalizer
- skip invalid rows, count invalid rows
- fail with `INVALID_PAYLOAD` only if zero valid rows remain
- ensure rows with missing sourceSetId -> persistedSetId mapping are skipped (defensive guard)
- preserve `devSeed` and `forceFailure`

- [ ] **Step 4: Run ingest tests to verify pass**

Run: `bun test packages/jobs/test/ingest-onepiece.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/ingest-onepiece.ts packages/jobs/test/ingest-onepiece.test.ts
git commit -m "feat: replace onepiece ingest with allsetcards single-fetch flow"
```

### Task 4: Keep API ingest route contract stable

**Files:**
- Modify: `apps/api/test/jobs-routes.test.ts`

- [ ] **Step 1: Add failing API contract test assertions for ingest lifecycle and stats shape**

```ts
test("POST /jobs/ingest/onepiece remains async 202 and stores terminal status", async () => {
  const res = await app.handle(new Request("http://localhost/jobs/ingest/onepiece", { method: "POST" }));
  expect(res.status).toBe(202);
  // poll /jobs/:id and assert terminal status + stats object exists
});
```

- [ ] **Step 2: Run API tests to verify failure**

Run: `bun test apps/api/test/jobs-routes.test.ts -t "POST /jobs/ingest/onepiece remains async 202 and stores terminal status"`
Expected: FAIL.

- [ ] **Step 3: Adjust assertions/fixtures only as needed (no route contract changes)**

- [ ] **Step 4: Run full API route suite**

Run: `bun test apps/api/test/jobs-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/jobs-routes.test.ts
git commit -m "test: preserve ingest api contract after allsetcards migration"
```

## Chunk 3: Dashboard Payload Expansion + Rich Card Rendering

### Task 5: Add setName and additive card fields to dashboard data contract

**Files:**
- Modify: `packages/data/src/repos/cards-repo.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/api/test/jobs-routes.test.ts`

- [ ] **Step 1: Write failing repo/API-type tests for `setName`, `sourceCardId`, `marketPrice`, `imageUrl`**

Use existing test files where available; if no direct data-contract test exists, add a focused assertion in `apps/web/src/App.test.tsx` that expects rendered set name + market price from fixture fields.

Also add a focused API contract assertion in `apps/api/test/jobs-routes.test.ts`:

```ts
test("GET /dashboard includes additive allsetcards card fields", async () => {
  const res = await app.handle(new Request("http://localhost/dashboard"));
  const body = await res.json();
  expect(res.status).toBe(200);
  const first = body.cards[0];
  expect(typeof first.sourceCardId).toBe("string");
  expect(typeof first.setName).toBe("string");
  expect(first.marketPrice === null || typeof first.marketPrice === "number").toBe(true);
  expect(first.imageUrl === null || typeof first.imageUrl === "string").toBe(true);
});
```

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `bun run test -t "renders card metadata"` (workdir: `apps/web`)
Expected: FAIL.

- [ ] **Step 3: Implement additive backend/frontend contract wiring**

Backend read model should include `setName` from joined `sets` row; frontend type should represent:

```ts
type DashboardCard = {
  id: string;
  sourceCardId: string;
  cardName: string;
  setId: string;
  setName: string;
  rarity: string | null;
  marketPrice: number | null;
  imageUrl: string | null;
  isChase: boolean;
  tcgType: string;
  printStatus: "in-print" | "out-of-print";
};
```

- [ ] **Step 4: Run relevant tests**

Run: `bun test packages/data/test/cards-repo.test.ts`
Run: `bun test apps/api/test/jobs-routes.test.ts -t "GET /dashboard includes additive allsetcards card fields"`
Run: `bun run test` (workdir: `apps/web`)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data/src/repos/cards-repo.ts apps/web/src/lib/api.ts apps/api/test/jobs-routes.test.ts
git commit -m "feat: extend dashboard card contract with allsetcards metadata"
```

### Task 6: Render richer card rows in web UI

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/SetList.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests for image fallback, set name, and market price rendering**

```ts
test("renders card metadata (set, source id, price, image fallback)", async () => {
  render(<App />);
  await screen.findByText("Romance Dawn");
  expect(screen.getByText(/OP01-001/i)).toBeInTheDocument();
  expect(screen.getByText(/\$2\.55/)).toBeInTheDocument();
  expect(screen.getByText("Alt Art")).toBeInTheDocument();
  expect(screen.getByTestId("chase-badge")).toBeInTheDocument();
});

test("renders fallback media and N/A for missing values", async () => {
  render(<App />);
  await screen.findByTestId("card-image-fallback");
  expect(screen.getByText("N/A")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run targeted test to verify failure**

Run: `bun run test -t "renders card metadata"` (workdir: `apps/web`)
Expected: FAIL.

- [ ] **Step 3: Implement minimal UI changes to pass**

Add card media/details layout in `SetList`, pass full card fields from `App`, and style new elements in `styles.css`.

- [ ] **Step 4: Run full web tests**

Run: `bun run test` (workdir: `apps/web`)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/SetList.tsx apps/web/src/styles.css apps/web/src/App.test.tsx
git commit -m "feat: display rich allsetcards metadata in dashboard list"
```

## Chunk 4: Theme Toggle (System/Light/Dark)

### Task 7: Add theme state, persistence, and system-mode syncing

**Files:**
- Create: `apps/web/src/components/ThemeToggle.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/test/setup.ts` (if matchMedia polyfill needed)

- [ ] **Step 1: Write failing tests for theme toggle and persistence**

```ts
test("theme toggle persists and sets data-theme", async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "dark" } });
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(window.localStorage.getItem("cardtracker-theme")).toBe("dark");
});

test("restores theme from storage on remount", async () => {
  window.localStorage.setItem("cardtracker-theme", "dark");
  const view = render(<App />);
  view.unmount();
  render(<App />);
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("invalid stored value falls back to system", async () => {
  window.localStorage.setItem("cardtracker-theme", "sepia");
  render(<App />);
  expect(screen.getByLabelText("Theme")).toHaveValue("system");
});

test("defaults to system when no stored value exists", async () => {
  window.localStorage.removeItem("cardtracker-theme");
  render(<App />);
  expect(screen.getByLabelText("Theme")).toHaveValue("system");
});
```

Add a `system` mode test that simulates `matchMedia` change listener and verifies runtime update.
Add a `light`/`dark` fixed-mode test that simulates OS preference change and verifies the app ignores it.

- [ ] **Step 2: Run targeted theme tests to verify failure**

Run: `bun run test -t "theme toggle persists and sets data-theme"` (workdir: `apps/web`)
Expected: FAIL.

- [ ] **Step 3: Implement minimal theme system**

Implementation rules:

- Valid modes: `system | light | dark`
- `localStorage` key: `cardtracker-theme`
- Invalid stored value => `system`
- `system` listens to `prefers-color-scheme` changes
- Set `document.documentElement.dataset.theme` to effective mode
- `light` and `dark` modes ignore runtime OS preference changes

- [ ] **Step 4: Add dark-theme token overrides in CSS**

Use `[data-theme="dark"]` variable overrides and ensure cards/controls/text remain accessible.

- [ ] **Step 5: Run full web suite**

Run: `bun run test` (workdir: `apps/web`)
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ThemeToggle.tsx apps/web/src/App.tsx apps/web/src/styles.css apps/web/src/App.test.tsx apps/web/src/test/setup.ts
git commit -m "feat: add persistent system-light-dark theme support"
```

### Task 8: Update docs and perform final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add docs for new ingest endpoint and theme behavior**

Document:

- ingest source now uses `/api/allSetCards/`
- expected `ONEPIECE_API_BASE_URL` base URL (`https://www.optcgapi.com`)
- theme options and persistence behavior

- [ ] **Step 2: Run full verification (@superpowers:verification-before-completion)**

Run: `bun test apps/api packages`
Run: `bun run test` (workdir: `apps/web`)
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe allsetcards ingest source and theme behavior"
```

## Cross-Cutting Execution Rules

- Apply @superpowers:test-driven-development for each behavior change (red -> green -> refactor).
- If any test fails unexpectedly, apply @superpowers:systematic-debugging before implementation changes.
- Before announcing success or opening PR, run @superpowers:verification-before-completion commands and quote the exact pass output.
