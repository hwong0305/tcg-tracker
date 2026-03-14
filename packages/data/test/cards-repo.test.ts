import { beforeEach, expect, test } from "bun:test";
import { db } from "../src/client";
import { cardsRepo } from "../src/repos/cards-repo";
import { setsRepo } from "../src/repos/sets-repo";
import { cards, sets } from "../src/schema";

beforeEach(async () => {
  await db.delete(cards);
  await db.delete(sets);
});

test("upsertMany is idempotent by setId+sourceCardId", async () => {
  const set = await setsRepo.upsertMany([
    {
      tcgType: "OnePiece",
      sourceSetId: "OP10",
      setName: "Royal Blood",
      releaseDate: "2024-03-10",
      currentBoxPrice: 140,
      msrpPackPrice: 4.49,
      isOutOfPrint: false
    }
  ]);
  const setId = set.rows[0].id;

  const first = await cardsRepo.upsertMany([
    {
      sourceCardId: "OP10-001",
      setId,
      cardName: "Card A",
      rarity: "Alt Art",
      marketPrice: 100,
      isChase: true,
      imageUrl: null,
      tcgType: "OnePiece",
      printStatus: "in-print"
    }
  ]);

  const second = await cardsRepo.upsertMany([
    {
      sourceCardId: "OP10-001",
      setId,
      cardName: "Card A Updated",
      rarity: "Alt Art",
      marketPrice: 120,
      isChase: true,
      imageUrl: null,
      tcgType: "OnePiece",
      printStatus: "in-print"
    }
  ]);

  expect(first.created).toBe(1);
  expect(second.updated).toBe(1);

  const bySet = await cardsRepo.findBySetIds([setId]);
  expect(bySet.length).toBe(1);
  expect(bySet[0].cardName).toBe("Card A Updated");
});

test("findFiltered supports chaseOnly and rarity", async () => {
  const set = await setsRepo.upsertMany([
    {
      tcgType: "OnePiece",
      sourceSetId: "OP11",
      setName: "Wings of the Captain",
      releaseDate: "2023-09-01",
      currentBoxPrice: 180,
      msrpPackPrice: 4.49,
      isOutOfPrint: true
    }
  ]);
  const setId = set.rows[0].id;

  await cardsRepo.upsertMany([
    {
      sourceCardId: "OP11-010",
      setId,
      cardName: "Card Chase",
      rarity: "Manga Rare",
      marketPrice: 400,
      isChase: true,
      imageUrl: null,
      tcgType: "OnePiece",
      printStatus: "out-of-print"
    },
    {
      sourceCardId: "OP11-011",
      setId,
      cardName: "Card Bulk",
      rarity: "Common",
      marketPrice: 1,
      isChase: false,
      imageUrl: null,
      tcgType: "OnePiece",
      printStatus: "out-of-print"
    }
  ]);

  const chaseOnly = await cardsRepo.findFiltered({ chaseOnly: true, rarity: "Manga Rare" });
  expect(chaseOnly.length).toBe(1);
  expect(chaseOnly[0].cardName).toBe("Card Chase");
});
