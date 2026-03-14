import { setsRepo } from "../../data/src/repos/sets-repo";
import { cardsRepo } from "../../data/src/repos/cards-repo";
import { jobsRepo } from "../../data/src/repos/jobs-repo";
import { fetchLimitlessSets, fetchLimitlessCards, normalizeLimitlessSet, normalizeLimitlessCard } from "../../providers/src";

type IngestInput = { baseUrl?: string; setIds?: string[] };

export async function runIngestLimitlessJob(input: IngestInput, options?: { jobId?: string }) {
  const run = options?.jobId
    ? { id: options.jobId }
    : await jobsRepo.create({ type: "ingest-limitless", status: "queued", requestPayloadJson: input });

  try {
    await jobsRepo.markRunning(run.id);

    const baseUrl = input.baseUrl || "https://onepiece.limitlesstcg.com";

    const rawSets = await fetchLimitlessSets(baseUrl);
    const validSets = rawSets.map(normalizeLimitlessSet);

    const filteredSets = input.setIds
      ? validSets.filter(s => input.setIds!.includes(s.sourceSetId))
      : validSets;

    const setUpsert = await setsRepo.upsertMany(
      filteredSets.map(s => ({
        tcgType: "OnePiece" as const,
        sourceSetId: s.sourceSetId,
        setName: s.setName,
        releaseDate: s.releaseDate,
        currentBoxPrice: s.currentBoxPrice,
        msrpPackPrice: 4.49,
        isOutOfPrint: false
      }))
    );

    const setIdBySource = new Map(setUpsert.rows.map((row: any) => [row.sourceSetId, row.id]));

    let totalCardsScraped = 0;
    let cardsCreated = 0;
    let cardsUpdated = 0;

    for (const set of filteredSets) {
      await new Promise(r => setTimeout(r, 500));

      const slug = set.sourceSetId.toLowerCase().replace("OP", "op").replace("ST", "st").replace("EB", "eb").replace("PRB", "prb");
      const setSlug = `${slug}-${set.setName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-")}`;

      try {
        const rawCards = await fetchLimitlessCards(baseUrl, slug);
        totalCardsScraped += rawCards.length;

        const setId = setIdBySource.get(set.sourceSetId);
        if (!setId) continue;

        const cardsToUpsert = rawCards.map(card => {
          const normalized = normalizeLimitlessCard(card);
          return {
            sourceCardId: normalized.sourceCardId,
            setId,
            cardName: normalized.sourceCardId,
            rarity: null,
            marketPrice: null,
            isChase: false,
            imageUrl: normalized.imageUrl,
            tcgType: "OnePiece" as const
          };
        });

        if (cardsToUpsert.length > 0) {
          const cardStats = await cardsRepo.upsertMany(cardsToUpsert);
          cardsCreated += cardStats.created;
          cardsUpdated += cardStats.updated;
        }
      } catch (e) {
        console.error(`Failed to fetch cards for ${set.sourceSetId}:`, e);
      }
    }

    const stats = {
      createdSets: setUpsert.created,
      updatedSets: setUpsert.updated,
      createdCards: cardsCreated,
      updatedCards: cardsUpdated,
      totalSetsScraped: filteredSets.length,
      totalCardsScraped
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
  await runIngestLimitlessJob({});
}
