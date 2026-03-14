import type { ChaseInput, ChaseResult } from "./types";

const SPECIAL_RARITIES = new Set(["Special Illustration Rare", "Alt Art", "Manga Rare"]);

export function computeChaseFlags(cards: ChaseInput[]): Map<string, ChaseResult> {
  const out = new Map<string, ChaseResult>();
  const priced = cards.filter((c) => c.marketPrice != null) as Array<ChaseInput & { marketPrice: number }>;
  const sorted = [...priced].sort((a, b) => b.marketPrice - a.marketPrice);
  const topCount = Math.max(1, Math.ceil(sorted.length * 0.05));
  const boundary = sorted.length > 0 ? sorted[topCount - 1].marketPrice : Infinity;

  for (const card of cards) {
    const reasons: string[] = [];
    const packPrice = card.scrapedPackPrice ?? card.msrpPackPrice ?? 4.49;

    if (card.marketPrice != null && card.marketPrice > packPrice * 10) {
      reasons.push("10x");
    }

    if (card.rarity && SPECIAL_RARITIES.has(card.rarity)) {
      reasons.push("rarity");
    }

    if (card.marketPrice != null && card.marketPrice >= boundary) {
      reasons.push("top-5-percent");
    }

    out.set(card.id, {
      isChase: reasons.length > 0,
      reasons
    });
  }

  return out;
}
