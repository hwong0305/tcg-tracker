import { expect, test } from "bun:test";
import { cardsRepo } from "../../data/src/repos/cards-repo";
import { setsRepo } from "../../data/src/repos/sets-repo";
import { resolveTargetsUnion } from "../src/resolve-targets";

test("resolves union and deduplicates with cap", async () => {
  const setId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const card1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const card2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  await setsRepo.seed([
    {
      id: setId,
      tcgType: "OnePiece",
      sourceSetId: "OPR-TGT",
      setName: "Target Set",
      releaseDate: "2024-01-01",
      currentBoxPrice: 150,
      msrpPackPrice: 4.49,
      isOutOfPrint: false
    }
  ]);

  await cardsRepo.seed([
    {
      id: card1,
      sourceCardId: "c1",
      setId,
      cardName: "Card 1",
      rarity: "Rare",
      marketPrice: null,
      isChase: false,
      imageUrl: null
    },
    {
      id: card2,
      sourceCardId: "c2",
      setId,
      cardName: "Card 2",
      rarity: "Rare",
      marketPrice: null,
      isChase: false,
      imageUrl: null
    }
  ]);

  const targets = await resolveTargetsUnion({ setIds: [setId], cardIds: [card1, card1] }, 2);
  expect(targets.length).toBeLessThanOrEqual(2);
  expect(new Set(targets.map((t) => t.id)).size).toBe(targets.length);
  expect(targets.every((t) => typeof t.url === "string" && t.url.length > 0)).toBe(true);
});
