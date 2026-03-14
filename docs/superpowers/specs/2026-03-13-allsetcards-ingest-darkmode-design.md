# AllSetCards Ingest + Dashboard Theme Design

## 1. Scope and Goal

Replace the current One Piece ingest strategy (`/sets` + per-set `/cards`) with a single upstream source (`GET https://www.optcgapi.com/api/allSetCards/`) and update the frontend dashboard to surface the richer card metadata from that payload. Add first-class light/dark theme support with persistent user preference.

### In Scope

- Replace ingest network flow with one call to `/api/allSetCards/`
- Normalize and persist set/card data from flat card rows
- Preserve existing jobs API contracts and async lifecycle semantics
- Expand dashboard API payload with additional card display fields
- Update frontend card rendering to show richer metadata
- Add light/dark/system theme toggle and persistence

### Out of Scope

- New upstream providers beyond `allSetCards`
- Filter model redesign (existing dashboard filters stay the same)
- Server-side rendered theming

## 2. Recommended Approach

Recommended: hard-replace ingest source with `allSetCards`.

Rationale:

- Single source of truth for One Piece card ingest
- Fewer upstream calls and simpler ingest runtime
- Cleaner failure surface and easier contract testing

Alternatives considered:

1. Keep old ingest and add `allSetCards` fallback (rejected: branch complexity)
2. Keep old normalizers by translating `allSetCards` into old shapes (rejected: unnecessary adapter layer)

## 3. Backend Design

### 3.1 Provider Client and Schema Mapping

Add provider function:

- `fetchOnePieceAllSetCards(baseUrl: string): Promise<RawAllSetCard[]>`

Endpoint:

- `${baseUrl}/api/allSetCards/`

Required fields (validation gates):

- `set_id` (source set id)
- `set_name`
- `card_set_id` (source card id)
- `card_name`

Explicit raw row contract:

- `set_id`: required string, non-empty; missing/empty => invalid row
- `set_name`: required string, non-empty; missing/empty => invalid row
- `card_set_id`: required string, non-empty; missing/empty => invalid row
- `card_name`: required string, non-empty; missing/empty => invalid row
- `rarity`: optional string; null/empty => `null`
- `market_price`: optional number|string; parse with `Number(value)`, non-finite => `null`
- `inventory_price`: optional number|string; parsed for future use but not persisted in current schema
- `card_image`: optional string URL; empty => `null`
- `card_color`: optional string (not persisted in current schema)
- `card_type`: optional string (not persisted in current schema)
- `card_text`: optional string (not persisted in current schema)
- `date_scraped`: optional date string (not persisted in current schema)

Normalization mapping:

- `set_id -> sourceSetId`
- `set_name -> setName`
- `card_set_id -> sourceCardId`
- `card_name -> cardName`
- `card_image -> imageUrl`
- `market_price -> marketPrice` (numeric parse, null-safe)

Base URL behavior:

- Keep existing environment behavior: use job input override if provided, else `ONEPIECE_API_BASE_URL`, else default base `https://www.optcgapi.com`.
- Effective request path is always `${baseUrl}/api/allSetCards/`.

### 3.2 Ingest Job Flow

Update `runIngestOnePieceJob` flow:

1. Fetch all card rows once from `/api/allSetCards/`
2. If input `setIds` is provided, filter fetched rows where `set_id` is in `setIds`; otherwise process all rows
3. Validate required fields per row and split into valid/invalid sets
4. If every row is invalid, fail job with `INVALID_PAYLOAD`; otherwise continue and report invalid row count in stats
5. Derive unique sets by `set_id`
6. Upsert sets
7. Build `sourceSetId -> persistedSetId` map
8. Upsert cards mapped to persisted set ids
9. Finalize job with created/updated stats plus invalid row count

Keep behavior unchanged for:

- `devSeed`
- `forceFailure`
- Job status transitions (`queued -> running -> completed|failed`)

### 3.3 Error Handling

- Preserve provider error shape and retryability flags
- For row-level validation failures, mark row invalid and skip it
- Throw `INVALID_PAYLOAD` only when zero valid rows remain after validation
- Skip rows that cannot be linked to a persisted set id (defensive guard)
- Keep persisted failure details in `job_runs.errors_json`
- Partial-invalid payloads complete successfully and include invalid row count in stats
- Provider error entity mapping for merged endpoint:
  - fetch/network/http failures map to `entity: "card"` with existing error codes
  - payload validation failures map to `entity: "card"`, `code: "INVALID_PAYLOAD"`

## 4. API + Data Contract for Frontend

Expand dashboard card payload from backend query output to include:

- `sourceCardId`
- `setName`
- `marketPrice` (`number | null`)
- `imageUrl` (`string | null`)

Retain existing keys to avoid frontend breakage:

- `id`, `cardName`, `printStatus`, `tcgType`, `setId`, `rarity`, `isChase`

This is additive and backward-compatible for consumers already using current keys.

Typed shape (incremental):

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

type DashboardResponse = {
  sets: Array<{ id: string; setName: string }>;
  cards: DashboardCard[];
  meta: { generatedAt: string };
};
```

`meta.generatedAt` remains unchanged.

## 5. Frontend Design

### 5.1 Card Display Enhancements

Update dashboard card list to render:

- Card thumbnail (`imageUrl`) with fallback surface when missing
- Card name + source card id
- Set name
- Rarity
- Market price with currency formatting and null fallback (`N/A`)
- Existing chase badge

Filters and presets remain unchanged.

### 5.2 Theme System (Light / Dark / System)

Add a theme control with three modes:

- `system` (default)
- `light`
- `dark`

Behavior:

- Persist selection in `localStorage`
- Apply theme via root-level attribute (`data-theme`) and CSS variable tokens
- When `system`, follow `prefers-color-scheme`

Deterministic rules:

- Initial load precedence: valid `localStorage` value (`system|light|dark`) first, else default `system`
- Invalid stored value falls back to `system`
- When mode is `system`, listen for `matchMedia("(prefers-color-scheme: dark)")` change events and update live
- When mode is `light` or `dark`, ignore runtime OS preference changes

Styling constraints:

- Preserve intentional palette/contrast in both modes
- Ensure accessible text and control contrast
- Keep layout responsive on mobile and desktop

## 6. Testing Strategy

### Backend

- Provider contract test for `allSetCards` parsing and required fields
- Ingest job test verifies set/card upsert counts from flat dataset
- API route test confirms ingest endpoint still returns `202` and job completes

### Frontend

- Type-safe dashboard payload updates in `lib/api.ts`
- Component tests assert rich card content renders (image/fallback, set name, market price)
- Theme tests assert toggle changes root theme and persists preference

## 7. Rollout and Safety

- Replace ingest path in one change-set (no dual path)
- Keep API endpoint names unchanged for operators
- Document new upstream endpoint and schema assumptions in README

## 8. Acceptance Criteria

Work is accepted when:

1. In an ingest test run, provider client is called exactly once with `/api/allSetCards/` and never calls old `/sets` or `/cards?set=...` endpoints.
2. If `setIds` is provided, only rows with matching `set_id` are persisted; if omitted, all valid rows are considered.
3. Ingest stats include created/updated counts and invalid-row count; partial-invalid payloads complete, while all-invalid payloads fail with `INVALID_PAYLOAD` persisted in job errors.
4. `GET /dashboard` response includes `cards[*].sourceCardId`, `cards[*].setName`, `cards[*].marketPrice`, and `cards[*].imageUrl` with declared nullability.
5. Existing dashboard filter and preset tests continue to pass without route changes.
6. Theme tests verify: (a) toggle sets `data-theme`, (b) choice persists across reload, (c) `system` mode reacts to OS scheme changes, (d) invalid stored value falls back to `system`.
7. Full backend and frontend test suites pass.
