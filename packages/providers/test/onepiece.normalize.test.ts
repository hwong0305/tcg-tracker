import { expect, test } from "bun:test";
import { normalizeCard, normalizeSet, normalizeAllSetCardRow, deduplicateRows } from "../src/onepiece/normalize";

test("normalizeSet maps provider fields", () => {
  const dto = normalizeSet({ id: "op-01", name: "Romance Dawn", releaseDate: "2022-12-02" });
  expect(dto).toEqual({
    sourceSetId: "op-01",
    setName: "Romance Dawn",
    releaseDate: "2022-12-02",
    tcgType: "OnePiece"
  });
});

test("normalizeCard maps provider fields", () => {
  const dto = normalizeCard({ id: "op01-001", name: "Luffy", rarity: "Leader", image: "https://img" }, "set-uuid");
  expect(dto.sourceCardId).toBe("op01-001");
  expect(dto.setId).toBe("set-uuid");
});

test("normalizeAllSetCardRow maps required and optional fields", () => {
  const row = normalizeAllSetCardRow({
    set_id: "OP-01",
    set_name: "Romance Dawn",
    card_set_id: "OP01-001",
    card_name: "Zoro",
    rarity: "L",
    market_price: "2.55",
    card_image: "https://img"
  });
  expect(row.marketPrice).toBe(2.55);
  expect(row.sourceCardId).toBe("OP01-001");
});

test("normalizeAllSetCardRow rejects missing required fields", () => {
  expect(() => normalizeAllSetCardRow({ set_id: "OP-01" })).toThrow();
});

test("normalizeAllSetCardRow rejects empty or whitespace required fields", () => {
  expect(() =>
    normalizeAllSetCardRow({ set_id: "  ", set_name: "Romance Dawn", card_set_id: "OP01-001", card_name: "Zoro" })
  ).toThrow();
});

test("normalizeAllSetCardRow normalizes optional field empties", () => {
  const row = normalizeAllSetCardRow({
    set_id: "OP-01",
    set_name: "Romance Dawn",
    card_set_id: "OP01-001",
    card_name: "Zoro",
    rarity: "",
    card_image: "",
    inventory_price: "not-a-number"
  });
  expect(row.rarity).toBeNull();
  expect(row.imageUrl).toBeNull();
  expect(row.marketPrice).toBeNull();
});

test("deduplicateRows keeps row with latest date_scraped for same card_set_id and rarity", () => {
  const rows = [
    { card_set_id: "OP01-001", rarity: "L", card_name: "Zoro", set_id: "OP-01", set_name: "Romance Dawn", date_scraped: "2026-03-12" },
    { card_set_id: "OP01-001", rarity: "L", card_name: "Zoro Promo", set_id: "OP-01", set_name: "Romance Dawn", date_scraped: "2026-03-13" }
  ];
  const result = deduplicateRows(rows);
  expect(result.deduplicated.length).toBe(1);
  expect(result.deduplicated[0].card_name).toBe("Zoro Promo");
  expect(result.duplicatesRemoved).toBe(1);
});

test("deduplicateRows keeps last-in-array when date_scraped is equal", () => {
  const rows = [
    { card_set_id: "ST01-015", rarity: "R", card_name: "First", set_id: "ST-01", set_name: "Starter 1", date_scraped: "2026-03-13" },
    { card_set_id: "ST01-015", rarity: "R", card_name: "Second", set_id: "ST-01", set_name: "Starter 1", date_scraped: "2026-03-13" }
  ];
  const result = deduplicateRows(rows);
  expect(result.deduplicated.length).toBe(1);
  expect(result.deduplicated[0].card_name).toBe("Second");
  expect(result.duplicatesRemoved).toBe(1);
});

test("deduplicateRows skips rows without card_set_id or rarity", () => {
  const rows = [
    { card_set_id: "X-001", rarity: "R", card_name: "First", set_id: "X", set_name: "Set X" },
    { card_set_id: "X-001", card_name: "Second", set_id: "X", set_name: "Set X" }
  ];
  const result = deduplicateRows(rows);
  expect(result.deduplicated.length).toBe(1);
  expect(result.deduplicated[0].card_name).toBe("First");
});

test("deduplicateRows keeps all rows with different card_set_id", () => {
  const rows = [
    { card_set_id: "OP01-001", rarity: "L", card_name: "A", set_id: "OP-01", set_name: "S1", date_scraped: "2026-03-12" },
    { card_set_id: "OP01-002", rarity: "L", card_name: "B", set_id: "OP-01", set_name: "S1", date_scraped: "2026-03-12" }
  ];
  const result = deduplicateRows(rows);
  expect(result.deduplicated.length).toBe(2);
  expect(result.duplicatesRemoved).toBe(0);
});

test("deduplicateRows keeps rows with same card_set_id but different rarity", () => {
  const rows = [
    { card_set_id: "OP09-118", rarity: "R", card_name: "Card A", set_id: "OP-09", set_name: "Set 9" },
    { card_set_id: "OP09-118", rarity: "SR", card_name: "Card B", set_id: "OP-09", set_name: "Set 9" }
  ];
  const result = deduplicateRows(rows);
  expect(result.deduplicated.length).toBe(2);
  expect(result.duplicatesRemoved).toBe(0);
});
