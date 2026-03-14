import { expect, test } from "bun:test";
import { cardsRepo } from "../../data/src/repos/cards-repo";
import { setsRepo } from "../../data/src/repos/sets-repo";
import { recomputeFlags } from "../src/recompute-flags";

test("fixture A/B/C/D recompute outcomes", async () => {
  const setFixtureId = "11111111-1111-4111-8111-111111111111";
  const setFixtureBId = "22222222-2222-4222-8222-222222222222";

  await setsRepo.seed([
    {
      id: setFixtureId,
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
      id: setFixtureBId,
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
      id: "33333333-3333-4333-8333-333333333333",
      sourceCardId: "C-FIX-C",
      setId: setFixtureId,
      cardName: "C",
      rarity: "Rare",
      marketPrice: 49,
      msrpPackPrice: 4.49,
      isChase: false,
      imageUrl: null,
      fixtureKey: "fixtureC"
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      sourceCardId: "C-FIX-D",
      setId: setFixtureId,
      cardName: "D",
      rarity: "Manga Rare",
      marketPrice: null,
      msrpPackPrice: 4.49,
      isChase: false,
      imageUrl: null,
      fixtureKey: "fixtureD"
    }
  ]);

  const result = await recomputeFlags([setFixtureId, setFixtureBId], { todayUtc: "2026-03-13" });
  expect(result.assertions.fixtureA_OOP).toBe(true);
  expect(result.assertions.fixtureB_OOP).toBe(true);
  expect(result.assertions.fixtureC_Chase).toBe(true);
  expect(result.assertions.fixtureD_Chase).toBe(true);
});
