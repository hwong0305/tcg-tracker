import { cardsRepo } from "../../data/src/repos/cards-repo";

export type ScrapeTarget = { id: string; url: string };

function buildPriceUrl(cardOrSet: { sourceCardId?: string; sourceSetId?: string; cardName?: string; setName?: string }) {
  const query = cardOrSet.sourceCardId ?? cardOrSet.sourceSetId ?? cardOrSet.cardName ?? cardOrSet.setName ?? "";
  return `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}`;
}

export async function resolveTargetsUnion(input: { setIds?: string[]; cardIds?: string[] }, limit: number) {
  const fromSets = input.setIds ? await cardsRepo.findBySetIds(input.setIds) : [];
  const fromCards = input.cardIds ? await cardsRepo.findByIds(input.cardIds) : [];
  const all = [...fromSets, ...fromCards].map((x: any) => ({ id: x.id, url: buildPriceUrl(x) } as ScrapeTarget));
  const deduped = Array.from(new Map(all.map((x) => [x.id, x])).values());
  return deduped.slice(0, limit);
}
