import { cardsRepo } from "../../../../packages/data/src/repos/cards-repo";
import { jobsRepo } from "../../../../packages/data/src/repos/jobs-repo";
import { resolveTargetsUnion } from "../../../../packages/jobs/src/resolve-targets";
import { runIngestOnePieceJob } from "../../../../packages/jobs/src/ingest-onepiece";
import { runIngestLimitlessJob } from "../../../../packages/jobs/src/ingest-limitless";
import { runRecomputeFlagsJob } from "../../../../packages/jobs/src/recompute-flags";
import { runScrapePricesJob } from "../../../../packages/jobs/src/scrape-prices";

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

    queueMicrotask(() => {
      void runIngestOnePieceJob(payload ?? {}, { jobId: run.id }).catch(() => {
        // Job failure state is persisted by job runner.
      });
    });

    return run.id;
  },

  async queueIngestLimitless(payload: any) {
    const run = await jobsRepo.create({ type: "ingest-limitless", status: "queued", requestPayloadJson: payload });

    queueMicrotask(() => {
      void runIngestLimitlessJob(payload ?? {}, { jobId: run.id }).catch(() => {
        // Job failure state is persisted by job runner.
      });
    });

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

    queueMicrotask(() => {
      void runScrapePricesJob(normalized, { jobId: run.id }).catch(() => {
        // Job failure state is persisted by job runner.
      });
    });

    return { jobId: run.id, targetCount: targets.length };
  },

  async queueRecompute(payload: any) {
    const run = await jobsRepo.create({ type: "recompute-flags", status: "queued", requestPayloadJson: payload });

    queueMicrotask(() => {
      void runRecomputeFlagsJob(payload ?? {}, { jobId: run.id }).catch(() => {
        // Job failure state is persisted by job runner.
      });
    });

    return run.id;
  },

  async getById(id: string) {
    return jobsRepo.getById(id);
  }
};
