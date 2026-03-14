import { describe, expect, test } from "bun:test";
import { computeChaseFlags } from "../src/chase";

describe("computeChaseFlags", () => {
  test("uses scraped pack price before msrp and fallback", () => {
    const result = computeChaseFlags([
      { id: "a", marketPrice: 55, rarity: "Rare", scrapedPackPrice: 5.5, msrpPackPrice: 4.49 },
      { id: "b", marketPrice: 44, rarity: "Rare", scrapedPackPrice: null, msrpPackPrice: 4.0 },
      { id: "c", marketPrice: 45, rarity: "Rare", scrapedPackPrice: null, msrpPackPrice: null }
    ]);
    expect(result.get("a")?.reasons.includes("10x")).toBe(false);
    expect(result.get("b")?.reasons.includes("10x")).toBe(true);
    expect(result.get("c")?.reasons.includes("10x")).toBe(true);
  });

  test("excludes null market price from 10x and percentile", () => {
    const result = computeChaseFlags([{ id: "n", marketPrice: null, rarity: "Rare", msrpPackPrice: 4.49 }]);
    expect(result.get("n")?.reasons.includes("10x")).toBe(false);
    expect(result.get("n")?.reasons.includes("top-5-percent")).toBe(false);
  });

  test("marks rarity chase when market price is null", () => {
    const result = computeChaseFlags([{ id: "r", marketPrice: null, rarity: "Manga Rare", msrpPackPrice: 4.49 }]);
    expect(result.get("r")?.isChase).toBe(true);
  });

  test("includes ties at percentile boundary", () => {
    const cards = Array.from({ length: 20 }, (_, i) => ({
      id: `c-${i + 1}`,
      marketPrice: i < 2 ? 100 : 10,
      rarity: "Rare",
      msrpPackPrice: 20
    }));
    const result = computeChaseFlags(cards);
    expect(result.get("c-1")?.reasons.includes("top-5-percent")).toBe(true);
    expect(result.get("c-2")?.reasons.includes("top-5-percent")).toBe(true);
  });
});
