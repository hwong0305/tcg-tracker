import { cardsRepo } from "../../../../packages/data/src/repos/cards-repo";
import { jobsRepo } from "../../../../packages/data/src/repos/jobs-repo";
import { setsRepo } from "../../../../packages/data/src/repos/sets-repo";
import { resolveTargetsUnion } from "../../../../packages/jobs/src/resolve-targets";

async function normalizeScrapePayload(payload: { setIds?: string[]; cardIds?: string[] }) {
  const tracked = await cardsRepo.findTrackedTargets();
  const setIds = Array.from(new Set(payload.setIds ?? []));
  const cardIds = Array.from(new Set(payload.cardIds ?? []));

  if (setIds.length === 0 && cardIds.length === 0) {
    return { setIds: [], cardIds: tracked.map((t: any) => t.id).slice(0, 200) };
  }

  const cappedCardIds = cardIds.slice(0, Math.max(0, 200 - setIds.length));
  return { setIds: setIds.slice(0, 200), cardIds: cappedCardIds };
}

export const jobsApi = {
  async queueIngest(payload: any) {
    const run = await jobsRepo.create({ type: "ingest-onepiece", status: "queued", requestPayloadJson: payload });

    if (payload?.devSeed === true) {
      const seeded = await setsRepo.upsertMany([
        {
          tcgType: "OnePiece",
          sourceSetId: "OP01",
          setName: "Romance Dawn",
          releaseDate: "2022-12-02",
          currentBoxPrice: 210,
          msrpPackPrice: 4.49,
          isOutOfPrint: true
        },
        {
          tcgType: "OnePiece",
          sourceSetId: "OP02",
          setName: "Paramount War",
          releaseDate: "2023-03-10",
          currentBoxPrice: 155,
          msrpPackPrice: 4.49,
          isOutOfPrint: false
        }
      ]);

      const setIdBySource = new Map(seeded.rows.map((row) => [row.sourceSetId, row.id]));

      await cardsRepo.upsertMany([
        {
          sourceCardId: "OP01-001",
          setId: setIdBySource.get("OP01")!,
          cardName: "Monkey D. Luffy",
          rarity: "Manga Rare",
          marketPrice: 800,
          isChase: true,
          imageUrl: null,
          tcgType: "OnePiece",
          printStatus: "out-of-print"
        },
        {
          sourceCardId: "OP02-050",
          setId: setIdBySource.get("OP02")!,
          cardName: "Trafalgar Law",
          rarity: "Alt Art",
          marketPrice: 120,
          isChase: true,
          imageUrl: null,
          tcgType: "OnePiece",
          printStatus: "in-print"
        }
      ]);
    }

    return run.id;
  },

  async queueScrape(payload: any) {
    const normalized = await normalizeScrapePayload(payload);
    const targets = await resolveTargetsUnion(normalized, 200);
    const run = await jobsRepo.create({
      type: "scrape-prices",
      status: "queued",
      requestPayloadJson: normalized
    });
    return { jobId: run.id, targetCount: targets.length };
  },

  async queueRecompute(payload: any) {
    const run = await jobsRepo.create({ type: "recompute-flags", status: "queued", requestPayloadJson: payload });
    return run.id;
  },

  async getById(id: string) {
    return jobsRepo.getById(id);
  }
};
