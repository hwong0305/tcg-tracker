import { expect, test } from "bun:test";
import { cardsRepo } from "../../data/src/repos/cards-repo";
import { resolveTargetsUnion } from "../src/resolve-targets";

test("resolves union and deduplicates with cap", async () => {
  await cardsRepo.seed([
    {
      id: "c1",
      sourceCardId: "c1",
      setId: "s1",
      cardName: "Card 1",
      rarity: "Rare",
      marketPrice: null,
      isChase: false,
      imageUrl: null
    },
    {
      id: "c2",
      sourceCardId: "c2",
      setId: "s1",
      cardName: "Card 2",
      rarity: "Rare",
      marketPrice: null,
      isChase: false,
      imageUrl: null
    }
  ]);

  const targets = await resolveTargetsUnion({ setIds: ["s1"], cardIds: ["c1", "c1"] }, 2);
  expect(targets.length).toBeLessThanOrEqual(2);
  expect(new Set(targets.map((t) => t.id)).size).toBe(targets.length);
  expect(targets.every((t) => typeof t.url === "string" && t.url.length > 0)).toBe(true);
});
