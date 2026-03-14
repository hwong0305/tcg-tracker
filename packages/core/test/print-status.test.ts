import { describe, expect, test } from "bun:test";
import { computePrintStatus } from "../src/print-status";

describe("computePrintStatus", () => {
  test("marks OOP when older than 24 months", () => {
    const result = computePrintStatus({
      releaseDate: "2023-01-01",
      currentBoxPrice: 120,
      todayUtc: "2026-03-13"
    });
    expect(result.isOutOfPrint).toBe(true);
  });

  test("marks OOP at exact 24-month boundary", () => {
    const result = computePrintStatus({
      releaseDate: "2024-03-13",
      currentBoxPrice: 120,
      todayUtc: "2026-03-13"
    });
    expect(result.isOutOfPrint).toBe(true);
  });

  test("marks OOP when current box price is above 196", () => {
    const result = computePrintStatus({
      releaseDate: "2025-08-01",
      currentBoxPrice: 200,
      todayUtc: "2026-03-13"
    });
    expect(result.isOutOfPrint).toBe(true);
  });

  test("marks in-print helper signal when <24 months and box below 168", () => {
    const result = computePrintStatus({
      releaseDate: "2025-09-01",
      currentBoxPrice: 150,
      todayUtc: "2026-03-13"
    });
    expect(result.isOutOfPrint).toBe(false);
  });

  test("does not flip to OOP on null box price for recent set", () => {
    const result = computePrintStatus({
      releaseDate: "2025-09-01",
      currentBoxPrice: null,
      todayUtc: "2026-03-13",
      previousIsOutOfPrint: false
    });
    expect(result.isOutOfPrint).toBe(false);
  });

  test("preserves prior OOP=true when box price is null", () => {
    const result = computePrintStatus({
      releaseDate: "2025-09-01",
      currentBoxPrice: null,
      todayUtc: "2026-03-13",
      previousIsOutOfPrint: true
    });
    expect(result.isOutOfPrint).toBe(true);
  });

  test("old set remains OOP even when box price is null", () => {
    const result = computePrintStatus({
      releaseDate: "2023-01-01",
      currentBoxPrice: null,
      todayUtc: "2026-03-13",
      previousIsOutOfPrint: false
    });
    expect(result.isOutOfPrint).toBe(true);
  });
});
