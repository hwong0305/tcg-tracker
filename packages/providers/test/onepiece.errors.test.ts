import { expect, test } from "bun:test";
import { mapOnePieceError, fetchOnePieceAllSetCards, fetchOnePieceAllSTCards, fetchOnePieceAllPromos } from "../src/onepiece/client";

test("maps timeout to retryable network error", () => {
  const err = mapOnePieceError(new Error("ETIMEDOUT"), "set");
  expect(err).toEqual({
    code: "NETWORK_ERROR",
    source: "onepiece",
    entity: "set",
    reason: "ETIMEDOUT",
    retryable: true
  });
});

test("maps bad payload to non-retryable error", () => {
  const err = mapOnePieceError(new Error("INVALID_PAYLOAD"), "card");
  expect(err.retryable).toBe(false);
});

test("fetchOnePieceAllSetCards calls /api/allSetCards", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify([{ set_id: "OP-01", set_name: "Romance Dawn", card_set_id: "OP01-001", card_name: "Zoro" }]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as any;

  const rows = await fetchOnePieceAllSetCards("https://www.optcgapi.com");
  expect(calls[0]).toBe("https://www.optcgapi.com/api/allSetCards/");
  expect(Array.isArray(rows)).toBe(true);
});

test("fetchOnePieceAllSetCards maps network failure to provider error", async () => {
  globalThis.fetch = (async () => {
    throw new Error("ETIMEDOUT");
  }) as any;

  await expect(fetchOnePieceAllSetCards("https://www.optcgapi.com")).rejects.toMatchObject({
    code: "NETWORK_ERROR",
    entity: "card",
    retryable: true
  });
});

test("fetchOnePieceAllSetCards maps invalid JSON parse failure", async () => {
  globalThis.fetch = (async () => new Response("not-json", { status: 200 })) as any;
  await expect(fetchOnePieceAllSetCards("https://www.optcgapi.com")).rejects.toMatchObject({
    code: "HTTP_ERROR",
    entity: "card"
  });
});

test("fetchOnePieceAllSTCards calls /api/allSTCards/", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify([{ set_id: "ST-01", set_name: "Starter Deck 1", card_set_id: "ST01-001", card_name: "Luffy" }]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as any;

  const rows = await fetchOnePieceAllSTCards("https://www.optcgapi.com");
  expect(calls[0]).toBe("https://www.optcgapi.com/api/allSTCards/");
  expect(Array.isArray(rows)).toBe(true);
});

test("fetchOnePieceAllPromos calls /api/allPromos/", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify([{ set_id: "P", set_name: "Promos", card_set_id: "P-001", card_name: "Promo Luffy" }]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as any;

  const rows = await fetchOnePieceAllPromos("https://www.optcgapi.com");
  expect(calls[0]).toBe("https://www.optcgapi.com/api/allPromos/");
  expect(Array.isArray(rows)).toBe(true);
});
