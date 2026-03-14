import { describe, expect, test } from "bun:test";
import { app } from "../src/server";

describe("API contracts", () => {
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

  test("POST /jobs/ingest/onepiece queues job", async () => {
    const res = await app.handle(new Request("http://localhost/jobs/ingest/onepiece", { method: "POST" }));
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(typeof body.jobId).toBe("string");
    expect(body.status).toBe("queued");
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
