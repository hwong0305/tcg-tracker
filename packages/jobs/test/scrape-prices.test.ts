import { expect, test } from "bun:test";
import { scrapeWithRetry, summarizeScrapeRun } from "../src/scrape-prices";

test("no targets => completed", () => {
  expect(summarizeScrapeRun({ totalTargets: 0, succeeded: 0, failed: 0 }).status).toBe("completed");
});

test("all failed => failed", () => {
  expect(summarizeScrapeRun({ totalTargets: 3, succeeded: 0, failed: 3 }).status).toBe("failed");
});

test("mixed => partial", () => {
  expect(summarizeScrapeRun({ totalTargets: 4, succeeded: 3, failed: 1 }).status).toBe("partial");
});

test("retry cap stops after max attempts", async () => {
  let calls = 0;
  const alwaysFail = async () => {
    calls += 1;
    throw new Error("network");
  };
  const ok = await scrapeWithRetry({ id: "x", url: "https://example.com" }, 3, [1, 1], alwaysFail as any);
  expect(ok).toBe(false);
  expect(calls).toBe(3);
});
