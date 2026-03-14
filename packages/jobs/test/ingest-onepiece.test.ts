import { expect, test, beforeEach } from "bun:test";
import { runIngestOnePieceJob } from "../src/ingest-onepiece";

const mockRows = [
  { set_id: "OP-01", set_name: "Romance Dawn", card_set_id: "OP01-001", card_name: "Zoro", rarity: "L", market_price: "2.55", card_image: "https://img" },
  { set_id: "OP-01", set_name: "Romance Dawn", card_set_id: "OP01-002", card_name: "Nami", rarity: "C", market_price: "0.25", card_image: "" },
  { set_id: "OP-02", set_name: "Paramount War", card_set_id: "OP02-001", card_name: "Luffy", rarity: "L", market_price: "5.00", card_image: "https://img2" }
];

let fetchCalls: string[] = [];

beforeEach(() => {
  fetchCalls = [];
});

test("ingest calls allSetCards once and filters setIds", async () => {
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  
  globalThis.fetch = (async (url: string) => {
    fetchCalls.push(url);
    callCount++;
    if (url.includes("/api/allSetCards/")) {
      return new Response(JSON.stringify(mockRows), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  }) as any;

  const { setsRepo } = await import("../../data/src/repos/sets-repo");
  const originalUpsert = setsRepo.upsertMany;
  setsRepo.upsertMany = async (sets: any[]) => {
    return {
      created: sets.length,
      updated: 0,
      rows: sets.map((s, i) => ({ ...s, id: `set-${i}`, sourceSetId: s.sourceSetId }))
    };
  };

  const { cardsRepo } = await import("../../data/src/repos/cards-repo");
  const originalCardsUpsert = cardsRepo.upsertMany;
  let upsertedCards: any[] = [];
  cardsRepo.upsertMany = async (cards: any[]) => {
    upsertedCards = cards;
    return { created: cards.length, updated: 0, rows: cards.map((c, i) => ({ ...c, id: `card-${i}` })) };
  };

  const { jobsRepo } = await import("../../data/src/repos/jobs-repo");
  const originalCreate = jobsRepo.create;
  const originalMarkRunning = jobsRepo.markRunning;
  const originalFinalize = jobsRepo.finalize;
  (jobsRepo as any).create = async () => ({ id: "job-123" });
  (jobsRepo as any).markRunning = async () => {};
  (jobsRepo as any).finalize = async () => {};

  try {
    await runIngestOnePieceJob({ setIds: ["OP-01"] });
    expect(callCount).toBe(1);
    expect(fetchCalls[0]).toContain("/api/allSetCards/");
  } finally {
    globalThis.fetch = originalFetch;
    setsRepo.upsertMany = originalUpsert;
    cardsRepo.upsertMany = originalCardsUpsert;
    jobsRepo.create = originalCreate;
    jobsRepo.markRunning = originalMarkRunning;
    jobsRepo.finalize = originalFinalize;
  }
});

test("ingest completes with partial-invalid rows and invalid count", async () => {
  const rowsWithInvalid = [
    { set_id: "OP-01", set_name: "Romance Dawn", card_set_id: "OP01-001", card_name: "Zoro" },
    { set_id: "", set_name: "Bad Set", card_set_id: "BAD-001", card_name: "Bad Card" }
  ];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify(rowsWithInvalid), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as any;

  const { setsRepo } = await import("../../data/src/repos/sets-repo");
  const originalUpsert = setsRepo.upsertMany;
  setsRepo.upsertMany = async () => ({ created: 1, updated: 0, rows: [{ id: "set-1", sourceSetId: "OP-01" }] });

  const { cardsRepo } = await import("../../data/src/repos/cards-repo");
  const originalCardsUpsert = cardsRepo.upsertMany;
  cardsRepo.upsertMany = async () => ({ created: 1, updated: 0, rows: [{ id: "card-1" }] });

  const { jobsRepo } = await import("../../data/src/repos/jobs-repo");
  const originalCreate = jobsRepo.create;
  const originalMarkRunning = jobsRepo.markRunning;
  const originalFinalize = jobsRepo.finalize;
  let finalizeStats: any = null;
  (jobsRepo as any).create = async () => ({ id: "job-123" });
  (jobsRepo as any).markRunning = async () => {};
  (jobsRepo as any).finalize = async (_id: string, result: any) => { finalizeStats = result.statsJson; };

  try {
    await runIngestOnePieceJob({});
    expect(finalizeStats).not.toBeNull();
    expect(finalizeStats.invalidRows).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
    setsRepo.upsertMany = originalUpsert;
    cardsRepo.upsertMany = originalCardsUpsert;
    jobsRepo.create = originalCreate;
    jobsRepo.markRunning = originalMarkRunning;
    jobsRepo.finalize = originalFinalize;
  }
});

test("ingest fails INVALID_PAYLOAD when all rows invalid", async () => {
  const allInvalidRows = [
    { set_id: "", set_name: "", card_set_id: "", card_name: "" }
  ];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify(allInvalidRows), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as any;

  const { jobsRepo } = await import("../../data/src/repos/jobs-repo");
  const originalCreate = jobsRepo.create;
  const originalMarkRunning = jobsRepo.markRunning;
  const originalFinalize = jobsRepo.finalize;
  let finalizeStatus: string = "";
  (jobsRepo as any).create = async () => ({ id: "job-123" });
  (jobsRepo as any).markRunning = async () => {};
  (jobsRepo as any).finalize = async (_id: string, result: any) => { finalizeStatus = result.status; };

  try {
    await runIngestOnePieceJob({});
    expect(finalizeStatus).toBe("failed");
  } catch (error: any) {
    expect(error.message).toContain("INVALID_PAYLOAD");
  } finally {
    globalThis.fetch = originalFetch;
    jobsRepo.create = originalCreate;
    jobsRepo.markRunning = originalMarkRunning;
    jobsRepo.finalize = originalFinalize;
  }
});
