import { cardsRepo } from "../../data/src/repos/cards-repo";
import { jobsRepo } from "../../data/src/repos/jobs-repo";
import { setsRepo } from "../../data/src/repos/sets-repo";
import { fetchOnePieceCards, fetchOnePieceSets, normalizeCard, normalizeSet } from "../../providers/src";

export async function runIngestOnePieceJob(input: { setIds?: string[] }) {
  const run = await jobsRepo.create({ type: "ingest-onepiece", status: "queued", requestPayloadJson: input });

  try {
    await jobsRepo.markRunning(run.id);

    const rawSets = await fetchOnePieceSets(process.env.ONEPIECE_API_BASE_URL || "https://optcg-api.com");
    const normalizedSets = (rawSets as any[])
      .map(normalizeSet)
      .filter((s) => !input.setIds || input.setIds.includes(s.sourceSetId))
      .map((s) => ({
        tcgType: s.tcgType,
        sourceSetId: s.sourceSetId,
        setName: s.setName,
        releaseDate: s.releaseDate,
        currentBoxPrice: null,
        msrpPackPrice: 4.49,
        isOutOfPrint: false
      }));

    const setUpsert = await setsRepo.upsertMany(normalizedSets);
    const setIdBySource = new Map(setUpsert.rows.map((row: { sourceSetId: string; id: string }) => [row.sourceSetId, row.id]));

    const cardStats = { createdCards: 0, updatedCards: 0 };
    for (const set of normalizedSets) {
      const rawCards = await fetchOnePieceCards(process.env.ONEPIECE_API_BASE_URL || "https://optcg-api.com", set.sourceSetId);
      const persistedSetId = setIdBySource.get(set.sourceSetId);
      if (!persistedSetId) {
        continue;
      }
      const normalizedCards = (rawCards as any[]).map((card: any) => {
        const normalized = normalizeCard(card, persistedSetId);
        return {
          sourceCardId: normalized.sourceCardId,
          setId: normalized.setId,
          cardName: normalized.cardName,
          rarity: normalized.rarity,
          marketPrice: null,
          isChase: false,
          imageUrl: normalized.imageUrl,
          tcgType: "OnePiece",
          printStatus: "in-print" as const
        };
      });
      const stats = await cardsRepo.upsertMany(normalizedCards);
      cardStats.createdCards += stats.created;
      cardStats.updatedCards += stats.updated;
    }

    const stats = {
      createdSets: setUpsert.created,
      updatedSets: setUpsert.updated,
      createdCards: cardStats.createdCards,
      updatedCards: cardStats.updatedCards
    };
    await jobsRepo.finalize(run.id, { status: "completed", statsJson: stats, finishedAt: new Date() });
    return { status: "completed" as const, stats };
  } catch (error) {
    await jobsRepo.finalize(run.id, {
      status: "failed",
      errorsJson: [{ message: error instanceof Error ? error.message : String(error) }],
      finishedAt: new Date()
    });
    throw error;
  }
}

if (import.meta.main) {
  await runIngestOnePieceJob({});
}
