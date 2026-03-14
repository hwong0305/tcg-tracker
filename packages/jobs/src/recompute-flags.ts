import { computeChaseFlags, computePrintStatus } from "../../core/src/index";
import { jobsRepo } from "../../data/src/repos/jobs-repo";
import { cardsRepo } from "../../data/src/repos/cards-repo";
import { setsRepo } from "../../data/src/repos/sets-repo";

export async function recomputeFlags(setIds: string[], options?: { todayUtc?: string }) {
  const sets = await setsRepo.getByIds(setIds);
  const cardsBySet = await cardsRepo.getBySetIds(setIds);
  const setStatusByFixture = new Map<string, boolean>();
  const cardStatusByFixture = new Map<string, boolean>();
  const toNumberOrNull = (value: unknown) => (value == null ? null : Number(value));

  for (const set of sets) {
    if (!set.releaseDate) {
      await setsRepo.updatePrintStatus(set.id, set.isOutOfPrint);
    } else {
      const next = computePrintStatus({
        releaseDate: set.releaseDate,
        currentBoxPrice: toNumberOrNull(set.currentBoxPrice),
        todayUtc: options?.todayUtc ?? new Date().toISOString().slice(0, 10),
        previousIsOutOfPrint: set.isOutOfPrint
      });
      await setsRepo.updatePrintStatus(set.id, next.isOutOfPrint);
      if (set.fixtureKey) setStatusByFixture.set(set.fixtureKey, next.isOutOfPrint);
    }

    const normalizedCards = (cardsBySet.get(set.id) ?? []).map((card: any) => ({
      ...card,
      marketPrice: toNumberOrNull(card.marketPrice),
      msrpPackPrice: toNumberOrNull(card.msrpPackPrice),
      scrapedPackPrice: toNumberOrNull(card.scrapedPackPrice)
    }));
    const chaseMap = computeChaseFlags(normalizedCards);
    await cardsRepo.updateChaseFlags(set.id, chaseMap);

    for (const [cardId, status] of chaseMap.entries()) {
      const fixtureKey = cardsBySet.get(set.id)?.find((c: any) => c.id === cardId)?.fixtureKey;
      if (fixtureKey) cardStatusByFixture.set(fixtureKey, status.isChase);
    }
  }

  return {
    assertions: {
      fixtureA_OOP: setStatusByFixture.get("fixtureA") ?? false,
      fixtureB_OOP: setStatusByFixture.get("fixtureB") ?? false,
      fixtureC_Chase: cardStatusByFixture.get("fixtureC") ?? false,
      fixtureD_Chase: cardStatusByFixture.get("fixtureD") ?? false
    }
  };
}

export async function runRecomputeFlagsJob(
  input: { setIds?: string[]; todayUtc?: string },
  options?: { jobId?: string }
) {
  const run = options?.jobId
    ? { id: options.jobId }
    : await jobsRepo.create({ type: "recompute-flags", status: "queued", requestPayloadJson: input });

  try {
    await jobsRepo.markRunning(run.id);
    const allSets = await setsRepo.findFiltered({});
    const setIds = input.setIds ?? allSets.map((set) => set.id);
    const result = await recomputeFlags(setIds, { todayUtc: input.todayUtc });
    await jobsRepo.finalize(run.id, {
      status: "completed",
      statsJson: { setCount: setIds.length, assertions: result.assertions },
      finishedAt: new Date()
    });
    return result;
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
  await recomputeFlags([]);
}
