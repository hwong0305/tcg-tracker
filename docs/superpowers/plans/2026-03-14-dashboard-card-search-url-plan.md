# Dashboard Card Search + URL Filter State Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live dashboard card search (name + source ID) and keep the full filter state synchronized with URL query params.

**Architecture:** Keep dashboard filtering client-side in `App.tsx`, extend `FilterState` with `search`, and add URL parse/serialize helpers in `App.tsx` to hydrate once from query params and sync updates with `history.replaceState`. Maintain current route/path while producing clean, shareable query strings that omit defaults.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library

---

## File Structure

- Modify: `apps/web/src/components/FilterBar.tsx`
  - Extend `FilterState` with `search`.
  - Add controlled `Search cards` input in existing filter grid.
- Modify: `apps/web/src/App.tsx`
  - Add `search` default state.
  - Parse URL query params into filters on first load.
  - Reconcile `tcgType`/`set`/`rarity` params against loaded options.
  - Add search match logic (substring contains on `cardName` and `sourceCardId`, case-insensitive).
  - Serialize non-default filters back to URL with `history.replaceState` after hydration.
- Modify: `apps/web/src/App.test.tsx`
  - Add coverage for search, URL hydration, invalid query fallback, duplicate key handling, clean URL output, and replaceState behavior.

## Chunk 1: Search UI and Client-Side Filtering

### Task 1: Add failing tests for search behavior

**Files:**
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Write failing test for card-name search (case-insensitive)**

```tsx
test("search filters cards by card name case-insensitively", async () => {
  vi.spyOn(api, "fetchDashboard").mockResolvedValueOnce({
    ...fixture,
    cards: [{ ...fixture.cards[0], cardName: "Alpha" }, fixture.cards[1]]
  } as any);
  render(<App />);
  await screen.findByText("Alpha");
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "LPH" } });
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  expect(screen.queryByText("B")).toBeNull();
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `bun --cwd apps/web run test -- src/App.test.tsx -t "card name case-insensitively"`
Expected: FAIL because `Search cards` control/search filter does not exist yet.

- [ ] **Step 3: Write failing test for source-id search (case-insensitive)**

```tsx
test("search filters cards by source id case-insensitively", async () => {
  render(<App />);
  await screen.findByText("A");
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "02-0" } });
  expect(screen.getByText("B")).toBeInTheDocument();
  expect(screen.queryByText("A")).toBeNull();
});
```

- [ ] **Step 4: Run source-id test and verify failure**

Run: `bun --cwd apps/web run test -- src/App.test.tsx -t "source id case-insensitively"`
Expected: FAIL because source-id search behavior is not implemented yet.

- [ ] **Step 5: Write failing test for whitespace-only search**

```tsx
test("whitespace-only search behaves like empty search", async () => {
  render(<App />);
  await screen.findByText("A");
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "   " } });
  expect(screen.getByText("A")).toBeInTheDocument();
  expect(screen.getByText("B")).toBeInTheDocument();
});
```

- [ ] **Step 6: Run whitespace-only test and verify failure**

Run: `bun --cwd apps/web run test -- src/App.test.tsx -t "whitespace-only search behaves like empty search"`
Expected: FAIL because search trimming behavior is not implemented yet.

- [ ] **Step 7: Run focused tests and verify failure**

Run: `bun --cwd apps/web run test -- src/App.test.tsx`
Expected: FAIL because `Search cards` control/search filter does not exist yet.

### Task 2: Implement search state and filter input

**Files:**
- Modify: `apps/web/src/components/FilterBar.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Extend filter type with search state**

```ts
type FilterState = {
  printStatus: "all" | "in-print" | "out-of-print";
  tcgType: string;
  set: string;
  rarity: string;
  chaseOnly: boolean;
  search: string;
};
```

- [ ] **Step 2: Add controlled Search cards input to FilterBar**

```tsx
<label className="filter-field">
  <span>Search cards</span>
  <input
    aria-label="Search cards"
    type="text"
    placeholder="Name or ID (e.g. Luffy or OP01-001)"
    value={filters.search}
    onChange={(e) => onChange({ ...filters, search: e.target.value })}
  />
</label>
```

- [ ] **Step 3: Add search to App initial filters and filtering useMemo**

```ts
const term = filters.search.trim().toLowerCase();
if (term.length > 0) {
  const byName = card.cardName.toLowerCase().includes(term);
  const byId = card.sourceCardId.toLowerCase().includes(term);
  if (!byName && !byId) return false;
}
```

- [ ] **Step 4: Run card-name test and verify pass**

Run: `bun --cwd apps/web run test -- src/App.test.tsx -t "card name case-insensitively"`
Expected: PASS.

- [ ] **Step 5: Run source-id search test and verify pass**

Run: `bun --cwd apps/web run test -- src/App.test.tsx -t "source id case-insensitively"`
Expected: PASS.

- [ ] **Step 6: Run whitespace-only test and verify pass**

Run: `bun --cwd apps/web run test -- src/App.test.tsx -t "whitespace-only search behaves like empty search"`
Expected: PASS.

- [ ] **Step 7: Run full App test file and verify pass**

Run: `bun --cwd apps/web run test -- src/App.test.tsx`
Expected: PASS for new search tests.

- [ ] **Step 8: Commit search-only slice**

```bash
git add apps/web/src/components/FilterBar.tsx apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat: add dashboard card search filter"
```

## Chunk 2: URL Query Hydration and Sync

### Task 3: Add failing tests for URL behavior and edge cases

**Files:**
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Add test for query hydration on initial load**

```tsx
test("hydrates filters from query params", async () => {
  window.history.replaceState({}, "", "/dashboard?printStatus=in-print&search=op01");
  render(<App />);
  await screen.findByText("A");
  expect(screen.getByLabelText("Print Status")).toHaveValue("in-print");
  expect(screen.getByLabelText("Search cards")).toHaveValue("op01");
});
```

- [ ] **Step 2: Add test for invalid params fallback and duplicate keys**

```tsx
test("invalid params fall back and duplicate params use last value", async () => {
  window.history.replaceState(
    {},
    "",
    "/dashboard?printStatus=bad&printStatus=in-print&chaseOnly=yes&search=first&search=second&tcgType=BadType&set=BAD&rarity=BAD"
  );
  render(<App />);
  await screen.findByText("A");
  expect(screen.getByLabelText("Print Status")).toHaveValue("in-print");
  expect(screen.getByLabelText("Chase Only")).not.toBeChecked();
  expect(screen.getByLabelText("Search cards")).toHaveValue("second");
  expect(screen.getByLabelText("TCG Type")).toHaveValue("all");
  expect(screen.getByLabelText("Set")).toHaveValue("all");
  expect(screen.getByLabelText("Rarity")).toHaveValue("all");
});
```

- [ ] **Step 3: Add test for clean URL serialization, unknown-key cleanup, and pathname stability**

```tsx
test("syncs only non-default filters to query and keeps pathname", async () => {
  const replaceSpy = vi.spyOn(window.history, "replaceState");
  window.history.replaceState({}, "", "/dashboard?foo=bar");
  render(<App />);
  await screen.findByText("A");
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "  OP02  " } });
  expect(window.location.pathname).toBe("/dashboard");
  expect(window.location.search).toBe("?search=OP02");
  expect(replaceSpy).toHaveBeenCalled();
});
```

- [ ] **Step 4: Add test for no-op sync when serialized query is unchanged**

```tsx
test("does not call replaceState when serialized query is unchanged", async () => {
  const replaceSpy = vi.spyOn(window.history, "replaceState");
  window.history.replaceState({}, "", "/dashboard?search=OP02");
  render(<App />);
  await screen.findByText("A");
  replaceSpy.mockClear();
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "  OP02  " } });
  expect(replaceSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: Add test for whitespace-only search URL omission**

```tsx
test("whitespace-only search clears search param from URL", async () => {
  window.history.replaceState({}, "", "/dashboard?search=OP02");
  render(<App />);
  await screen.findByText("A");
  fireEvent.change(screen.getByLabelText("Search cards"), { target: { value: "   " } });
  expect(window.location.pathname).toBe("/dashboard");
  expect(window.location.search).toBe("");
});
```

- [ ] **Step 6: Run focused tests and verify failure**

Run: `bun --cwd apps/web run test -- src/App.test.tsx`
Expected: FAIL because URL hydration/sync behavior is not implemented.

### Task 4: Implement URL parse/reconcile/sync helpers in App

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Add query parsing helper with validation**

Implement helper logic in `App.tsx`:
- `printStatus`: allow only `all|in-print|out-of-print`
- `chaseOnly`: true only when query value is `"true"`
- `search`: use last duplicate key value and keep raw string from URLSearchParams
- `tcgType`/`set`/`rarity`: load as candidate values for post-fetch reconciliation
- unknown keys: ignored during parse and never re-emitted during serialize

- [ ] **Step 2: Hydrate filters once before sync effect**

Use hydration guard state/ref (`isHydratedFromUrl`) so URL sync does not overwrite initial query before hydration is complete.

- [ ] **Step 3: Reconcile data-driven filters after dashboard data loads**

After `data` is available, reset invalid `tcgType`, `set`, or `rarity` values to defaults if not present in available options.

- [ ] **Step 4: Add query serialization helper for clean URLs**

Rules:
- Include only non-default values.
- `chaseOnly` included only when true.
- `search` serialized as trimmed value and omitted if empty after trim.
- Ignore unknown keys from current URL.

- [ ] **Step 5: Sync filters with replaceState only on actual change**

When hydrated, build next URL from current pathname + serialized query and call `window.history.replaceState` only if different from current URL.

- [ ] **Step 6: Run hydration/validation tests and verify pass**

Run: `bun --cwd apps/web run test -- src/App.test.tsx -t "hydrates filters from query params"`
Expected: PASS.

- [ ] **Step 7: Run invalid/fallback/duplicate tests and verify pass**

Run: `bun --cwd apps/web run test -- src/App.test.tsx -t "invalid params fall back and duplicate params use last value"`
Expected: PASS.

- [ ] **Step 8: Run URL sync/no-op/whitespace tests and verify pass**

Run: `bun --cwd apps/web run test -- src/App.test.tsx -t "syncs only non-default filters to query and keeps pathname|does not call replaceState when serialized query is unchanged|whitespace-only search clears search param from URL"`
Expected: PASS.

- [ ] **Step 9: Run full App test file and verify pass**

Run: `bun --cwd apps/web run test -- src/App.test.tsx`
Expected: PASS for hydration, fallback, duplicate key, and URL sync tests.

- [ ] **Step 10: Commit URL sync slice**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat: persist dashboard filters in URL params"
```

## Chunk 3: Verification and Documentation

### Task 5: Full verification and final polish

**Files:**
- Modify (if needed): `apps/web/src/App.tsx`
- Modify (if needed): `apps/web/src/components/FilterBar.tsx`
- Modify (if needed): `apps/web/src/App.test.tsx`

- [ ] **Step 1: Run full web test suite**

Run: `bun --cwd apps/web run test`
Expected: PASS for all web tests.

- [ ] **Step 2: Run non-web workspace tests (CI parity)**

Run: `bun test apps/api packages`
Expected: PASS for API/package tests.

- [ ] **Step 3: Fix any regressions with minimal changes**

Keep fixes scoped to search + URL filter behavior. Avoid unrelated refactors.

- [ ] **Step 4: Re-run verification after fixes**

Re-run any failing command from Steps 1-2 until green, then re-run both Step 1 and Step 2 once to confirm final PASS state.

- [ ] **Step 5: Commit verification fixes if files changed**

```bash
git add apps/web/src/App.tsx apps/web/src/components/FilterBar.tsx apps/web/src/App.test.tsx
git commit -m "test: stabilize dashboard search URL filter coverage"
```

If no files changed after Step 4, skip this commit.

- [ ] **Step 6: Capture completion notes for PR body**

Record:
- user-facing behavior changes
- edge cases covered
- exact verification commands run and final PASS outputs
