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
  if (!raw?.id || !raw?.name) {
    throw mapOnePieceError(new Error("INVALID_PAYLOAD"), "set");
  }

  return {
    sourceSetId: raw.id,
    setName: raw.name,
    releaseDate: raw.releaseDate ?? null,
    tcgType: "OnePiece"
  };
}

export function normalizeCard(raw: any, setId: string): NormalizedCard {
  if (!raw?.id || !raw?.name) {
    throw mapOnePieceError(new Error("INVALID_PAYLOAD"), "card");
  }

  return {
    sourceCardId: raw.id,
    setId,
    cardName: raw.name,
    rarity: raw.rarity ?? null,
    imageUrl: raw.image ?? null
  };
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function parseNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface NormalizedAllSetCardRow {
  sourceSetId: string;
  setName: string;
  sourceCardId: string;
  cardName: string;
  rarity: string | null;
  marketPrice: number | null;
  imageUrl: string | null;
}

export function deduplicateRows(rows: any[]): { deduplicated: any[]; duplicatesRemoved: number } {
  const groups = new Map<string, any[]>();

  for (const row of rows) {
    const key = `${row.card_set_id}|${row.rarity}`;
    if (!row.card_set_id || !row.rarity) continue;
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

export function normalizeAllSetCardRow(raw: any): NormalizedAllSetCardRow {
  if (!isNonEmptyString(raw.set_id)) {
    throw mapOnePieceError(new Error("INVALID_PAYLOAD"), "card");
  }
  if (!isNonEmptyString(raw.set_name)) {
    throw mapOnePieceError(new Error("INVALID_PAYLOAD"), "card");
  }
  if (!isNonEmptyString(raw.card_set_id)) {
    throw mapOnePieceError(new Error("INVALID_PAYLOAD"), "card");
  }
  if (!isNonEmptyString(raw.card_name)) {
    throw mapOnePieceError(new Error("INVALID_PAYLOAD"), "card");
  }

  return {
    sourceSetId: raw.set_id.trim(),
    setName: raw.set_name.trim(),
    sourceCardId: raw.card_set_id.trim(),
    cardName: raw.card_name.trim(),
    rarity: isNonEmptyString(raw.rarity) ? raw.rarity : null,
    marketPrice: parseNullableNumber(raw.market_price),
    imageUrl: isNonEmptyString(raw.card_image) ? raw.card_image : null
  };
}
