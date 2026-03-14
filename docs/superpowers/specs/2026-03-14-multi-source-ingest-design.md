# Multi-Source One Piece Ingest Design

## 1. Scope and Goal

Extend the ingest job to fetch cards from three upstream endpoints — `allSetCards`, `allSTCards`, and `allPromos` — merge them, deduplicate by `card_set_id` (latest `date_scraped` wins), and persist via existing normalize/upsert flow.

### In Scope

- Add provider client functions for `/api/allSTCards/` and `/api/allPromos/`
- Add pure deduplication function keyed on `card_set_id`
- Update ingest job to fetch all 3 sources sequentially and merge before normalization
- Extend ingest stats with `totalFetched` and `duplicatesRemoved`
- Tests for new fetchers, dedup logic, and updated ingest flow

### Out of Scope

- Frontend changes (dashboard already renders whatever cards are in the DB)
- Schema/migration changes (same row shape)
- Parallel fetch or per-source job splitting
- Variant-aware storage (keeping multiple printings of same card_set_id)

## 2. Approach

Sequential fetch of all 3 endpoints, concatenate into one flat array, deduplicate in-memory by `card_set_id` keeping the row with latest `date_scraped`, then feed into existing normalize + upsert pipeline.

Rationale:
- Minimal code change — reuses existing normalizer and persistence
- Deterministic dedup — pure function, easy to test
- Simple failure model — any endpoint failure fails the whole job

## 3. Provider Client

### 3.1 New Functions

Add to `packages/providers/src/onepiece/client.ts`:

- `fetchOnePieceAllSTCards(baseUrl: string)`: `GET ${baseUrl}/api/allSTCards/`
- `fetchOnePieceAllPromos(baseUrl: string)`: `GET ${baseUrl}/api/allPromos/`

Both follow identical pattern to existing `fetchOnePieceAllSetCards`:
- Non-OK HTTP → throw `mapOnePieceError(new Error("HTTP_${status}"), "card")`
- Network/parse failure → catch and map with `mapOnePieceError(..., "card")`
- Return parsed JSON array

Export both from `packages/providers/src/index.ts`.

### 3.2 Schema Compatibility

All three endpoints return the same row shape:
- `set_id`, `set_name`, `card_set_id`, `card_name` (required)
- `rarity`, `market_price`, `inventory_price`, `card_image`, `card_color`, `card_type`, `card_text`, `date_scraped` (optional)

Existing `normalizeAllSetCardRow` handles this shape without changes.

## 4. Deduplication

### 4.1 Function Signature

```ts
function deduplicateRows(rows: RawRow[]): { deduplicated: RawRow[]; duplicatesRemoved: number }
```

### 4.2 Rules

- Group rows by `card_set_id`
- For each group with multiple entries: keep the row with latest `date_scraped` (parsed as `Date`)
- If `date_scraped` values are equal or missing: keep last-in-array (which will be the promo source since it's fetched last)
- Return flat deduplicated array and count of removed duplicates

### 4.3 Location

Add as `deduplicateRows` in `packages/providers/src/onepiece/normalize.ts` (pure data function alongside existing normalizers).

## 5. Ingest Job Flow

Update `runIngestOnePieceJob` in `packages/jobs/src/ingest-onepiece.ts`:

1. Fetch `allSetCards` from `${baseUrl}/api/allSetCards/`
2. Fetch `allSTCards` from `${baseUrl}/api/allSTCards/`
3. Fetch `allPromos` from `${baseUrl}/api/allPromos/`
4. Concatenate all rows: `[...setCards, ...stCards, ...promos]`
5. Run `deduplicateRows` → get `deduplicated` array + `duplicatesRemoved`
6. Apply `setIds` filter if provided
7. Validate rows via `normalizeAllSetCardRow`, split valid/invalid
8. If zero valid rows → fail with `INVALID_PAYLOAD`
9. Derive unique sets, upsert sets, build set ID map, upsert cards
10. Finalize job with stats: `{ totalFetched, duplicatesRemoved, invalidRows, createdSets, updatedSets, createdCards, updatedCards }`

Error handling:
- If any single fetch fails, the entire job fails (no partial ingest)
- Provider error shape and retryability preserved
- `devSeed` and `forceFailure` behavior unchanged

## 6. Testing Strategy

### Provider Tests (`packages/providers/test/onepiece.errors.test.ts`)

- `fetchOnePieceAllSTCards` calls correct URL path `/api/allSTCards/`
- `fetchOnePieceAllPromos` calls correct URL path `/api/allPromos/`
- Both map network/HTTP failures to provider errors with `entity: "card"`

### Dedup Tests (`packages/providers/test/onepiece.normalize.test.ts`)

- Same `card_set_id`, different `date_scraped` → keeps latest
- Same `card_set_id`, same/missing `date_scraped` → keeps last in array
- Different `card_set_id` → no dedup, all kept
- Returns correct `duplicatesRemoved` count

### Ingest Tests (`packages/jobs/test/ingest-onepiece.test.ts`)

- Mocks all 3 fetchers, verifies merged + deduplicated rows reach upsert
- Stats include `totalFetched` and `duplicatesRemoved`
- Existing tests for `setIds` filtering, partial-invalid, all-invalid still pass

## 7. Acceptance Criteria

1. Ingest job fetches from all 3 endpoints: `/api/allSetCards/`, `/api/allSTCards/`, `/api/allPromos/`
2. Rows with duplicate `card_set_id` are resolved by keeping the row with latest `date_scraped`
3. Ingest stats include `totalFetched` (pre-dedup count) and `duplicatesRemoved`
4. If any endpoint fetch fails, job fails entirely (no partial persist)
5. All existing ingest, provider, and frontend tests continue to pass
6. New provider, dedup, and ingest tests pass
