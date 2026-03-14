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
