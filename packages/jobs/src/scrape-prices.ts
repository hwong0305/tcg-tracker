import { jobsRepo } from "../../data/src/repos/jobs-repo";
import { scrapeOnce } from "../../providers/src/index";
import { resolveTargetsUnion, type ScrapeTarget } from "./resolve-targets";

const userAgents = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Mozilla/5.0 (X11; Linux x86_64)"
];

export async function scrapeWithRetry(
  target: ScrapeTarget,
  maxAttempts = 3,
  backoffMs = [1000, 3000],
  scrapeFn = scrapeOnce
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    try {
      const result = await scrapeFn(target.url, {
        "user-agent": userAgent,
        "accept-language": "en-US,en;q=0.9"
      });

      if (result.ok) return true;
      if (attempt === maxAttempts) return false;
      await Bun.sleep(backoffMs[Math.min(attempt - 1, backoffMs.length - 1)]);
    } catch {
      if (attempt === maxAttempts) return false;
      await Bun.sleep(backoffMs[Math.min(attempt - 1, backoffMs.length - 1)]);
    }
  }
  return false;
}

export function summarizeScrapeRun(stats: { totalTargets: number; succeeded: number; failed: number }) {
  if (stats.totalTargets === 0) return { status: "completed" as const };
  if (stats.succeeded === 0) return { status: "failed" as const };
  if (stats.failed > 0) return { status: "partial" as const };
  return { status: "completed" as const };
}

export async function runScrapePricesJob(input: { setIds?: string[]; cardIds?: string[] }, options?: { jobId?: string }) {
  const run = options?.jobId
    ? { id: options.jobId }
    : await jobsRepo.create({ type: "scrape-prices", status: "queued", requestPayloadJson: input });
  try {
    await jobsRepo.markRunning(run.id);

    const targets = await resolveTargetsUnion(input, 200);
    let succeeded = 0;
    let failed = 0;

    for (const target of targets) {
      const ok = await scrapeWithRetry(target, 3, [1000, 3000]);
      if (ok) succeeded += 1;
      else failed += 1;
    }

    const summary = summarizeScrapeRun({ totalTargets: targets.length, succeeded, failed });
    await jobsRepo.finalize(run.id, {
      status: summary.status,
      statsJson: { totalTargets: targets.length, succeeded, failed },
      finishedAt: new Date()
    });
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
  await runScrapePricesJob({});
}
