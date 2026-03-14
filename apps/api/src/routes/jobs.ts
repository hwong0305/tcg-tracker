import type { Elysia } from "elysia";
import { jobsApi } from "../services/jobs-api";

export function registerJobRoutes(app: Elysia) {
  app.post("/jobs/ingest/onepiece", async ({ body }) => {
    const jobId = await jobsApi.queueIngest(body ?? {});
    return new Response(JSON.stringify({ jobId, status: "queued" }), { status: 202 });
  });

  app.post("/jobs/ingest/limitless", async ({ body }) => {
    const jobId = await jobsApi.queueIngestLimitless(body ?? {});
    return new Response(JSON.stringify({ jobId, status: "queued" }), { status: 202 });
  });

  app.post("/jobs/scrape/prices", async ({ body }) => {
    const queued = await jobsApi.queueScrape((body ?? {}) as any);
    return new Response(JSON.stringify({ jobId: queued.jobId, status: "queued", targetCount: queued.targetCount }), {
      status: 202
    });
  });

  app.post("/jobs/recompute/flags", async ({ body }) => {
    const jobId = await jobsApi.queueRecompute(body ?? {});
    return new Response(JSON.stringify({ jobId, status: "queued" }), { status: 202 });
  });

  app.get("/jobs/:id", async ({ params }) => {
    const job = await jobsApi.getById(params.id);
    if (!job) {
      return new Response(JSON.stringify({ error: "JOB_NOT_FOUND" }), { status: 404 });
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      requestedAt: job.requestedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      stats: job.statsJson,
      errors: job.errorsJson
    };
  });
}
