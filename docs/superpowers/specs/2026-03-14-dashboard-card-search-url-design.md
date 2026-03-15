# Dashboard Card Search + URL Filter State Design

## Objective

Add a dashboard search feature that filters cards live by card name and source card ID, and persist the full filter state in URL query parameters for sharable views.

## Scope

- Add a `search` field to dashboard filter state.
- Add a new search input to the existing `FilterBar`.
- Update client-side filtering in `App.tsx` to match search terms against `cardName` and `sourceCardId`.
- Initialize filters from URL query params on initial load.
- Sync filter changes back into URL query params without changing route.
- Add/update web tests for search behavior and URL synchronization.

## Non-Goals

- No server-side search endpoint changes.
- No pagination or debouncing changes.
- No changes to API response shape.

## Current Context

- Dashboard data is fetched once client-side (`fetchDashboard`) and filtered locally in `App.tsx`.
- Existing filters (`printStatus`, `tcgType`, `set`, `rarity`, `chaseOnly`) are controlled via `FilterBar`.
- Existing tests already validate filter behavior and route stability.

## Proposed Design

### 1) Filter State Extension

Extend `FilterState` with:

- `search: string` (default `""`)

`initialFilters` in `App.tsx` will include `search: ""`.

### 2) UI Changes

Add a text input to `FilterBar`:

- Label: `Search cards`
- Placeholder: `Name or ID (e.g. Luffy or OP01-001)`
- Controlled value: `filters.search`
- Update behavior: immediate (`onChange`), no submit action required

Placement remains inside the existing filter panel/grid to preserve layout and visual language.

### 3) Search Matching Rules

Search is case-insensitive and trimmed.

Normalization:

- `term = filters.search.trim().toLowerCase()`

Match rule:

- If `term` is empty, search filter passes.
- Otherwise card passes when either field contains `term` (substring contains, not exact match):
  - `card.cardName.toLowerCase().includes(term)`
  - `card.sourceCardId.toLowerCase().includes(term)`

This rule composes with all existing filters using logical AND.

### 4) URL Query Param Synchronization

#### Param map

- `printStatus` -> `printStatus`
- `tcgType` -> `tcgType`
- `set` -> `set`
- `rarity` -> `rarity`
- `chaseOnly` -> `chaseOnly=true` (present only when enabled)
- `search` -> `search`

#### Initialization

On first render, parse `window.location.search` once into a pending filter object and apply with a single `setFilters` before URL sync effects run.

- Validation/parsing rules:
  - `printStatus`: allow only `all | in-print | out-of-print`; otherwise default.
  - `chaseOnly`: only `true` enables it; all other values default to `false`.
  - `search`: accept query string value as returned by `URLSearchParams`.
  - `tcgType`, `set`, `rarity`: accept URL values initially, then reconcile after dashboard data loads; if value is not present in available options, reset to default.
- Treat missing values as defaults.
- Ignore unknown query keys.
- For duplicate keys, use last value (`const values = params.getAll(key); const value = values.at(-1)`).

#### Ongoing sync

Whenever filters change, rebuild query params from state and write via:

- `window.history.replaceState({}, "", nextUrl)`

This avoids generating a history entry per keystroke while preserving the current pathname.

Guard rails:

- Do not sync URL until initial query hydration has completed.
- Only call `replaceState` when the serialized query differs from current URL.

#### Clean URL policy

Write only non-default values to query params:

- default values are omitted
- `chaseOnly` included only when true
- `search` serialized as `filters.search.trim()` and omitted when empty after trim
- unknown keys from the current URL are not preserved

## Error Handling and Edge Cases

- Invalid query enum values fall back to defaults.
- Unknown query keys are ignored.
- Whitespace-only search behaves like empty search.
- Duplicate query keys resolve to the last value.
- URL updates do not navigate away or alter `window.location.pathname`.

## Testing Plan

Update/add tests in `apps/web/src/App.test.tsx` to cover:

1. Search by card name filters list correctly.
2. Search by source card ID filters list correctly.
3. Query params initialize filters on first render.
4. Case-insensitive matching for both name and source ID.
5. Invalid query values for all params fall back safely.
6. Duplicate query keys use last value.
7. Whitespace-only search behaves as empty and is omitted from URL.
8. Clean URL omits defaults and includes only active non-default filters.
9. Changing search/filter updates `window.location.search` while keeping `window.location.pathname` unchanged.
10. URL sync uses `replaceState` semantics (no extra history entries from typing).

## Implementation Notes

- Keep parsing/serialization helpers local to `App.tsx` unless complexity warrants extraction.
- Follow existing filter update pattern (`onChange` with full `FilterState`).

## Success Criteria

- Users can type in one search field and instantly filter by card name or source ID.
- Shared dashboard URLs reproduce filter/search state on load.
- Existing filtering behavior remains intact.
- Web tests pass with the new behavior.
