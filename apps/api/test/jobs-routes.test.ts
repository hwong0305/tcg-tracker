import { describe, expect, test } from "bun:test";
import { app } from "../src/server";

describe("API contracts", () => {
  test("CORS preflight allows web client origin", async () => {
    const res = await app.handle(
      new Request("http://localhost/health", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "GET"
        }
      })
    );

    expect(res.status).not.toBe(404);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  test("GET /health contract", async () => {
    const res = await app.handle(new Request("http://localhost/health"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("cardtracker-core");
    expect(typeof body.timestamp).toBe("string");
  });

  test("GET /dashboard supports query filters", async () => {
    const url = "http://localhost/dashboard?printStatus=in-print&tcgType=OnePiece&setId=s1&rarity=Alt%20Art&chaseOnly=true";
    const res = await app.handle(new Request(url));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.sets)).toBe(true);
    expect(Array.isArray(body.cards)).toBe(true);
    expect(typeof body.meta.generatedAt).toBe("string");
  });

  test("GET /dashboard includes additive allsetcards card fields", async () => {
    const ingestRes = await app.handle(
      new Request("http://localhost/jobs/ingest/onepiece", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ devSeed: true })
      })
    );
    expect(ingestRes.status).toBe(202);
    const { jobId } = await ingestRes.json();

    let completed = false;
    for (let i = 0; i < 10; i += 1) {
      const statusRes = await app.handle(new Request(`http://localhost/jobs/${jobId}`));
      const statusBody = await statusRes.json();
      if (statusBody.status === "completed") {
        completed = true;
        break;
      }
      await Bun.sleep(10);
    }
    expect(completed).toBe(true);

    const res = await app.handle(new Request("http://localhost/dashboard"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cards.length).toBeGreaterThan(0);
    const first = body.cards[0];
    expect(typeof first.sourceCardId).toBe("string");
    expect(typeof first.setName).toBe("string");
    expect(first.marketPrice === null || typeof first.marketPrice === "number").toBe(true);
    expect(first.imageUrl === null || typeof first.imageUrl === "string").toBe(true);
  });

  test("POST /jobs/ingest/onepiece queues job", async () => {
    const res = await app.handle(new Request("http://localhost/jobs/ingest/onepiece", { method: "POST" }));
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(typeof body.jobId).toBe("string");
    expect(body.status).toBe("queued");
  });

  test("POST /jobs/ingest/onepiece with devSeed seeds dashboard fallback data", async () => {
    const ingestRes = await app.handle(
      new Request("http://localhost/jobs/ingest/onepiece", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ devSeed: true })
      })
    );
    const ingest = await ingestRes.json();
    expect(ingestRes.status).toBe(202);

    let completed = false;
    for (let i = 0; i < 10; i += 1) {
      const statusRes = await app.handle(new Request(`http://localhost/jobs/${ingest.jobId}`));
      const statusBody = await statusRes.json();
      if (statusBody.status === "completed") {
        completed = true;
        break;
      }
      await Bun.sleep(10);
    }

    expect(completed).toBe(true);

    const dashboardRes = await app.handle(new Request("http://localhost/dashboard"));
    const dashboard = await dashboardRes.json();

    expect(dashboardRes.status).toBe(200);
    expect(dashboard.sets.length).toBeGreaterThan(0);
    expect(dashboard.cards.length).toBeGreaterThan(0);
  });

  test("queued ingest job transitions to completed", async () => {
    const create = await app.handle(
      new Request("http://localhost/jobs/ingest/onepiece", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ devSeed: true })
      })
    );
    const created = await create.json();

    let completed: any = null;
    for (let i = 0; i < 20; i += 1) {
      const statusRes = await app.handle(new Request(`http://localhost/jobs/${created.jobId}`));
      const status = await statusRes.json();
      if (status.status === "completed") {
        completed = status;
        break;
      }
      await Bun.sleep(10);
    }

    expect(completed).not.toBeNull();
    expect(completed.status).toBe("completed");
    expect(typeof completed.finishedAt).toBe("string");
  });

  test("failed ingest job persists failed status and errors", async () => {
    const create = await app.handle(
      new Request("http://localhost/jobs/ingest/onepiece", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ devSeed: true, forceFailure: true })
      })
    );
    const created = await create.json();

    let failed: any = null;
    for (let i = 0; i < 10; i += 1) {
      const statusRes = await app.handle(new Request(`http://localhost/jobs/${created.jobId}`));
      const status = await statusRes.json();
      if (status.status === "failed") {
        failed = status;
        break;
      }
      await Bun.sleep(10);
    }

    expect(failed).not.toBeNull();
    expect(failed.status).toBe("failed");
    expect(Array.isArray(failed.errors)).toBe(true);
    expect(failed.errors.length).toBeGreaterThan(0);
  });

  test("POST /jobs/scrape/prices handles union+dedupe semantics", async () => {
    const res = await app.handle(
      new Request("http://localhost/jobs/scrape/prices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setIds: ["s1"], cardIds: ["c1", "c1"] })
      })
    );
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(body.targetCount).toBeLessThanOrEqual(200);
  });

  test("POST /jobs/scrape/prices empty body defaults to tracked targets cap=200", async () => {
    const res = await app.handle(new Request("http://localhost/jobs/scrape/prices", { method: "POST" }));
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(body.targetCount).toBeLessThanOrEqual(200);
  });

  test("POST /jobs/recompute/flags queues job", async () => {
    const res = await app.handle(new Request("http://localhost/jobs/recompute/flags", { method: "POST" }));
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(body.status).toBe("queued");
  });

  test("GET /jobs/:id returns status payload", async () => {
    const create = await app.handle(new Request("http://localhost/jobs/ingest/onepiece", { method: "POST" }));
    const created = await create.json();
    const res = await app.handle(new Request(`http://localhost/jobs/${created.jobId}`));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(typeof body.id).toBe("string");
    expect(typeof body.type).toBe("string");
    expect(typeof body.status).toBe("string");
    expect(typeof body.requestedAt).toBe("string");
  });

  test("GET /jobs/:id returns 404 for unknown id", async () => {
    const res = await app.handle(new Request("http://localhost/jobs/not-found"));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toBe("JOB_NOT_FOUND");
  });
});
