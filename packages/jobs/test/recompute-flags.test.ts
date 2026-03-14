import { expect, test } from "bun:test";
import { cardsRepo } from "../../data/src/repos/cards-repo";
import { setsRepo } from "../../data/src/repos/sets-repo";
import { recomputeFlags } from "../src/recompute-flags";

test("fixture A/B/C/D recompute outcomes", async () => {
  await setsRepo.seed([
    {
      id: "s-fixture",
      tcgType: "OnePiece",
      sourceSetId: "OP-FIX",
      setName: "Fixture",
      releaseDate: "2023-01-01",
      currentBoxPrice: 200,
      msrpPackPrice: 4.49,
      isOutOfPrint: false,
      fixtureKey: "fixtureA"
    },
    {
      id: "s-fixture-b",
      tcgType: "OnePiece",
      sourceSetId: "OP-FIX-B",
      setName: "Fixture B",
      releaseDate: "2025-10-01",
      currentBoxPrice: 200,
      msrpPackPrice: 4.49,
      isOutOfPrint: false,
      fixtureKey: "fixtureB"
    }
  ]);

  await cardsRepo.seed([
    {
      id: "c-fixture-c",
      sourceCardId: "C-FIX-C",
      setId: "s-fixture",
      cardName: "C",
      rarity: "Rare",
      marketPrice: 49,
      msrpPackPrice: 4.49,
      isChase: false,
      imageUrl: null,
      fixtureKey: "fixtureC"
    },
    {
      id: "c-fixture-d",
      sourceCardId: "C-FIX-D",
      setId: "s-fixture",
      cardName: "D",
      rarity: "Manga Rare",
      marketPrice: null,
      msrpPackPrice: 4.49,
      isChase: false,
      imageUrl: null,
      fixtureKey: "fixtureD"
    }
  ]);

  const result = await recomputeFlags(["s-fixture", "s-fixture-b"], { todayUtc: "2026-03-13" });
  expect(result.assertions.fixtureA_OOP).toBe(true);
  expect(result.assertions.fixtureB_OOP).toBe(true);
  expect(result.assertions.fixtureC_Chase).toBe(true);
  expect(result.assertions.fixtureD_Chase).toBe(true);
});
