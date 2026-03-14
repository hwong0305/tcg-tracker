import { cardsRepo } from "../../data/src/repos/cards-repo";
import { jobsRepo } from "../../data/src/repos/jobs-repo";
import { setsRepo } from "../../data/src/repos/sets-repo";
import { fetchOnePieceAllSetCards, fetchOnePieceAllSTCards, fetchOnePieceAllPromos, normalizeAllSetCardRow, deduplicateRows } from "../../providers/src";

type IngestInput = { setIds?: string[]; devSeed?: boolean; forceFailure?: boolean; onePieceBaseUrl?: string };

async function seedDevData() {
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

  const cards = await cardsRepo.upsertMany([
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

  return {
    createdSets: seeded.created,
    updatedSets: seeded.updated,
    createdCards: cards.created,
    updatedCards: cards.updated
  };
}

export async function runIngestOnePieceJob(input: IngestInput, options?: { jobId?: string }) {
  const run = options?.jobId
    ? { id: options.jobId }
    : await jobsRepo.create({ type: "ingest-onepiece", status: "queued", requestPayloadJson: input });

  try {
    await jobsRepo.markRunning(run.id);

    if (input.forceFailure === true) {
      throw new Error("FORCED_INGEST_FAILURE");
    }

    if (input.devSeed === true) {
      const stats = await seedDevData();
      await jobsRepo.finalize(run.id, { status: "completed", statsJson: stats, finishedAt: new Date() });
      return { status: "completed" as const, stats };
    }

    const baseUrl = input.onePieceBaseUrl || process.env.ONEPIECE_API_BASE_URL || "https://www.optcgapi.com";
    const rawSetCards = await fetchOnePieceAllSetCards(baseUrl) as any[];
    const rawSTCards = await fetchOnePieceAllSTCards(baseUrl) as any[];
    const rawPromos = await fetchOnePieceAllPromos(baseUrl) as any[];

    const allRawRows = [...rawSetCards, ...rawSTCards, ...rawPromos];
    const totalFetched = allRawRows.length;
    const { deduplicated: rawRows, duplicatesRemoved } = deduplicateRows(allRawRows);

    const validRows: ReturnType<typeof normalizeAllSetCardRow>[] = [];
    let invalidRowCount = 0;

    for (const row of rawRows as any[]) {
      try {
        const normalized = normalizeAllSetCardRow(row);
        if (!input.setIds || input.setIds.includes(normalized.sourceSetId)) {
          validRows.push(normalized);
        }
      } catch {
        invalidRowCount++;
      }
    }

    if (validRows.length === 0) {
      throw Object.assign(new Error("INVALID_PAYLOAD"), { code: "INVALID_PAYLOAD", entity: "card" });
    }

    const uniqueSets = Array.from(new Map(validRows.map(r => [r.sourceSetId, { sourceSetId: r.sourceSetId, setName: r.setName }])).values());

    const setUpsert = await setsRepo.upsertMany(uniqueSets.map(s => ({
      tcgType: "OnePiece" as const,
      sourceSetId: s.sourceSetId,
      setName: s.setName,
      releaseDate: null,
      currentBoxPrice: null,
      msrpPackPrice: 4.49,
      isOutOfPrint: false
    })));

    const setIdBySource = new Map(setUpsert.rows.map((row: { sourceSetId: string; id: string }) => [row.sourceSetId, row.id]));

    const cardsToUpsert = validRows
      .map(row => {
        const persistedSetId = setIdBySource.get(row.sourceSetId);
        if (!persistedSetId) return null;
        return {
          sourceCardId: row.sourceCardId,
          setId: persistedSetId,
          cardName: row.cardName,
          rarity: row.rarity,
          marketPrice: row.marketPrice,
          isChase: false,
          imageUrl: row.imageUrl,
          tcgType: "OnePiece" as const,
          printStatus: "in-print" as const
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    const cardStats = cardsToUpsert.length > 0
      ? await cardsRepo.upsertMany(cardsToUpsert)
      : { created: 0, updated: 0, rows: [] };

    const stats = {
      totalFetched,
      duplicatesRemoved,
      createdSets: setUpsert.created,
      updatedSets: setUpsert.updated,
      createdCards: cardStats.created,
      updatedCards: cardStats.updated,
      invalidRows: invalidRowCount
    };
    await jobsRepo.finalize(run.id, { status: "completed", statsJson: stats, finishedAt: new Date() });
    return { status: "completed" as const, stats };
  } catch (error) {
    const isProviderError = error && typeof error === "object" && "code" in error && "retryable" in error;
    await jobsRepo.finalize(run.id, {
      status: "failed",
      errorsJson: isProviderError
        ? [{ message: (error as any).reason, code: (error as any).code, entity: (error as any).entity }]
        : [{ message: error instanceof Error ? error.message : String(error), code: "UNKNOWN", entity: "card" }],
      finishedAt: new Date()
    });
    throw error;
  }
}

if (import.meta.main) {
  await runIngestOnePieceJob({});
}
