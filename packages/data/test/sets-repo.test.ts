import { beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/client";
import { setsRepo } from "../src/repos/sets-repo";
import { cards, sets } from "../src/schema";

beforeEach(async () => {
  await db.delete(cards);
  await db.delete(sets);
});

test("upsertMany is idempotent using tcgType+sourceSetId", async () => {
  const first = await setsRepo.upsertMany([
    {
      tcgType: "OnePiece",
      sourceSetId: "OP01",
      setName: "Romance Dawn",
      releaseDate: "2022-12-02",
      currentBoxPrice: 210,
      msrpPackPrice: 4.49,
      isOutOfPrint: true
    }
  ]);

  const second = await setsRepo.upsertMany([
    {
      tcgType: "OnePiece",
      sourceSetId: "OP01",
      setName: "Romance Dawn Updated",
      releaseDate: "2022-12-02",
      currentBoxPrice: 220,
      msrpPackPrice: 4.49,
      isOutOfPrint: true
    }
  ]);

  expect(first.created).toBe(1);
  expect(second.updated).toBe(1);

  const fromDb = await db.select().from(sets).where(eq(sets.sourceSetId, "OP01"));
  expect(fromDb.length).toBe(1);
  expect(fromDb[0].setName).toBe("Romance Dawn Updated");
});

test("findFiltered filters by printStatus and tcgType", async () => {
  await setsRepo.upsertMany([
    {
      tcgType: "OnePiece",
      sourceSetId: "OP02",
      setName: "Paramount War",
      releaseDate: "2023-03-10",
      currentBoxPrice: 155,
      msrpPackPrice: 4.49,
      isOutOfPrint: false
    },
    {
      tcgType: "OnePiece",
      sourceSetId: "OP03",
      setName: "Pillars of Strength",
      releaseDate: "2022-01-01",
      currentBoxPrice: 300,
      msrpPackPrice: 4.49,
      isOutOfPrint: true
    }
  ]);

  const inPrint = await setsRepo.findFiltered({ printStatus: "in-print", tcgType: "OnePiece" });
  const oop = await setsRepo.findFiltered({ printStatus: "out-of-print", tcgType: "OnePiece" });

  expect(inPrint.length).toBe(1);
  expect(oop.length).toBe(1);
});
