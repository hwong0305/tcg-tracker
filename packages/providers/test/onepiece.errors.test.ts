import { expect, test } from "bun:test";
import { mapOnePieceError } from "../src/onepiece/client";

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
