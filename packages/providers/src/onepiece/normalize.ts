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
