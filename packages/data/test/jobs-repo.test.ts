import { beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/client";
import { jobsRepo } from "../src/repos/jobs-repo";
import { jobRuns } from "../src/schema";

beforeEach(async () => {
  await db.delete(jobRuns);
});

test("create persists request payload and can be fetched", async () => {
  const created = await jobsRepo.create({
    type: "ingest-onepiece",
    status: "queued",
    requestPayloadJson: { devSeed: true }
  });

  expect(created.id).toBeString();

  const loaded = await jobsRepo.getById(created.id);
  expect(loaded).not.toBeNull();
  expect(loaded?.type).toBe("ingest-onepiece");
  expect(loaded?.status).toBe("queued");
  expect(loaded?.requestPayloadJson).toEqual({ devSeed: true });
});

test("markRunning and finalize persist lifecycle fields", async () => {
  const created = await jobsRepo.create({
    type: "scrape-prices",
    status: "queued"
  });

  await jobsRepo.markRunning(created.id);
  await jobsRepo.finalize(created.id, {
    status: "partial",
    statsJson: { totalTargets: 4, succeeded: 3, failed: 1 },
    errorsJson: [{ message: "one target failed" }],
    finishedAt: new Date("2026-03-14T00:00:00.000Z")
  });

  const row = await db.select().from(jobRuns).where(eq(jobRuns.id, created.id));
  expect(row.length).toBe(1);
  expect(row[0].status).toBe("partial");
  expect(row[0].startedAt).not.toBeNull();
  expect(row[0].finishedAt?.toISOString()).toBe("2026-03-14T00:00:00.000Z");
  expect(row[0].statsJson).toEqual({ totalTargets: 4, succeeded: 3, failed: 1 });
});
