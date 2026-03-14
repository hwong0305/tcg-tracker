import type { LimitlessSet, LimitlessCard } from "./scraper";

export interface NormalizedLimitlessSet {
  sourceSetId: string;
  setSlug: string;
  setName: string;
  releaseDate: string | null;
  currentBoxPrice: number | null;
  eurBoxPrice: number | null;
}

export interface NormalizedLimitlessCard {
  sourceCardId: string;
  cardName: string | null;
  rarity: string | null;
  imageUrl: string | null;
  parallelVariant: string | null;
}

export function normalizeLimitlessSet(raw: LimitlessSet): NormalizedLimitlessSet {
  return {
    sourceSetId: raw.sourceSetId,
    setSlug: raw.setSlug,
    setName: raw.setName,
    releaseDate: raw.releaseDate,
    currentBoxPrice: raw.usdTotal,
    eurBoxPrice: raw.eurTotal
  };
}

export function normalizeLimitlessCard(raw: LimitlessCard): NormalizedLimitlessCard {
  return {
    sourceCardId: raw.sourceCardId,
    cardName: raw.cardName,
    rarity: raw.rarity,
    imageUrl: raw.imageUrl,
    parallelVariant: raw.parallelVariant
  };
}
