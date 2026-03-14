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

test("ingest calls all 3 endpoints and filters setIds", async () => {
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  
  globalThis.fetch = (async (url: string) => {
    fetchCalls.push(url);
    callCount++;
    if (url.includes("/api/allSetCards/")) {
      return new Response(JSON.stringify(mockRows), { status: 200 });
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
    expect(callCount).toBe(3);
    expect(fetchCalls).toEqual(expect.arrayContaining([
      expect.stringContaining("/api/allSetCards/"),
      expect.stringContaining("/api/allSTCards/"),
      expect.stringContaining("/api/allPromos/")
    ]));
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
    { set_id: "OP-01", set_name: "Romance Dawn", card_set_id: "OP01-001", card_name: "Zoro", rarity: "L" },
    { set_id: "", set_name: "Bad Set", card_set_id: "BAD-001", card_name: "Bad Card", rarity: "C" }
  ];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    if (url.includes("/api/allSetCards/")) {
      return new Response(JSON.stringify(rowsWithInvalid), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
  }) as any;

  const { setsRepo } = await import("../../data/src/repos/sets-repo");
  const originalUpsert = setsRepo.upsertMany;
  setsRepo.upsertMany = async () => ({ created: 1, updated: 0, rows: [{ id: "set-1", sourceSetId: "OP-01" }] }) as any;

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
  globalThis.fetch = (async (url: string) => {
    if (url.includes("/api/allSetCards/")) {
      return new Response(JSON.stringify(allInvalidRows), { status: 200 });
    }
    return new Response(JSON.stringify([]), { status: 200 });
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

test("ingest fetches from all 3 endpoints and deduplicates", async () => {
  const setCards = [
    { set_id: "OP-01", set_name: "Romance Dawn", card_set_id: "OP01-001", card_name: "Zoro", rarity: "L", date_scraped: "2026-03-12" }
  ];
  const stCards = [
    { set_id: "ST-01", set_name: "Starter 1", card_set_id: "ST01-001", card_name: "Luffy", rarity: "R", date_scraped: "2026-03-12" }
  ];
  const promos = [
    { set_id: "OP-01", set_name: "Romance Dawn", card_set_id: "OP01-001", card_name: "Zoro Promo", rarity: "L", date_scraped: "2026-03-13" }
  ];

  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    if (url.includes("/api/allSetCards/")) return new Response(JSON.stringify(setCards), { status: 200 });
    if (url.includes("/api/allSTCards/")) return new Response(JSON.stringify(stCards), { status: 200 });
    if (url.includes("/api/allPromos/")) return new Response(JSON.stringify(promos), { status: 200 });
    return new Response("[]", { status: 200 });
  }) as any;

  const { setsRepo } = await import("../../data/src/repos/sets-repo");
  const origSets = setsRepo.upsertMany;
  setsRepo.upsertMany = async (sets: any[]) => ({
    created: sets.length, updated: 0,
    rows: sets.map((s: any, i: number) => ({ ...s, id: `set-${i}`, sourceSetId: s.sourceSetId }))
  }) as any;

  const { cardsRepo } = await import("../../data/src/repos/cards-repo");
  const origCards = cardsRepo.upsertMany;
  let upsertedCards: any[] = [];
  cardsRepo.upsertMany = async (cards: any[]) => {
    upsertedCards = cards;
    return { created: cards.length, updated: 0, rows: cards.map((c: any, i: number) => ({ ...c, id: `card-${i}` })) };
  };

  const { jobsRepo } = await import("../../data/src/repos/jobs-repo");
  const origCreate = jobsRepo.create;
  const origMark = jobsRepo.markRunning;
  const origFin = jobsRepo.finalize;
  let finalStats: any = null;
  (jobsRepo as any).create = async () => ({ id: "job-multi" });
  (jobsRepo as any).markRunning = async () => {};
  (jobsRepo as any).finalize = async (_id: string, r: any) => { finalStats = r.statsJson; };

  try {
    await runIngestOnePieceJob({});

    expect(calls).toEqual(expect.arrayContaining([
      expect.stringContaining("/api/allSetCards/"),
      expect.stringContaining("/api/allSTCards/"),
      expect.stringContaining("/api/allPromos/")
    ]));
    expect(calls.length).toBe(3);

    // Promo OP01-001 overwrites set card OP01-001 (later date_scraped)
    expect(upsertedCards.length).toBe(2);
    const zoro = upsertedCards.find((c: any) => c.sourceCardId === "OP01-001");
    expect(zoro.cardName).toBe("Zoro Promo");

    expect(finalStats.totalFetched).toBe(3);
    expect(finalStats.duplicatesRemoved).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
    setsRepo.upsertMany = origSets;
    cardsRepo.upsertMany = origCards;
    jobsRepo.create = origCreate;
    jobsRepo.markRunning = origMark;
    jobsRepo.finalize = origFin;
  }
});
