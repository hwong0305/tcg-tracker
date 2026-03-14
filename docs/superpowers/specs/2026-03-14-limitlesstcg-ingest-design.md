# LimitlessTCG Card Scraping Design

> **Date:** 2026-03-14
> **Status:** Approved

## Overview

Augment existing One Piece card data by scraping limitlesstcg.com to fill missing data:
- Set release dates and pricing (USD, EUR)
- Card images and parallel variants
- Card attributes from advanced search (color, cost, power, etc.)

## Data Sources

### Primary: limitlesstcg.com

| Page | Data Extracted |
|------|----------------|
| `/cards` | Set list: code, name, release date, card count, USD/EUR total prices |
| `/cards/{set-code}` | Per-set card data: images, rarity, parallel variants |

### Target Fields to Add

**sets table:**
- `releaseDate` — currently nullable, will be populated
- `currentBoxPrice` — currently nullable, will be populated (from USD)
- `eurBoxPrice` — NEW column

**cards table:**
- `imageUrl` — fill missing, prefer limitlesstcg CDN
- `parallelVariant` — NEW: "Alternate Art", "Manga Art", "Serial Card", etc.

## Architecture

```
packages/providers/src/limitless/
├── scraper.ts      # HTML fetching + parsing with cheerio
└── normalize.ts    # Transform to normalized format

packages/jobs/src/
└── ingest-limitless.ts  # New job: fetch sets → fetch cards → merge
```

### Scraping Flow

1. **Fetch set list** from `/cards`
2. **For each set**, fetch `/cards/{set-code}`
3. **Parse card rows** from table (use existing HTML structure)
4. **Merge with existing data** by sourceCardId
5. **Upsert** to fill gaps (don't overwrite existing data unless stale)

## Implementation Notes

### HTML Parsing

Use `cheerio` to parse:
- Set table rows: `<a href="/cards/op01-romance-dawn">` → set code
- Card images: `<img src=".../OP01-001_EN.webp">` → sourceCardId
- Card details: parse URL params or alt text for variants

### Rate Limiting

- 500ms delay between requests
- Max 3 retries with exponential backoff

### Data Quality

- Mark sets as `fresh` when successfully scraped
- Track `lastScraped` timestamp
- Only fill NULL values (don't overwrite existing data)

## Database Schema Changes

```sql
-- New columns for sets
ALTER TABLE sets ADD COLUMN eur_box_price decimal(10,2);

-- New columns for cards
ALTER TABLE cards ADD COLUMN parallel_variant text;
```

## Acceptance Criteria

1. Successfully scrape all sets from limitlesstcg.com
2. Fill missing release dates in database
3. Fill missing images where limitlesstcg has them
4. Add parallel variant information
5. Job completes without manual intervention
6. Handle site changes gracefully (log errors, continue)

## Out of Scope

- Tournament/deck data (not in this iteration)
- Real-time price updates (batch only)
- Card attributes (color, cost, power) — requires advanced search parsing
