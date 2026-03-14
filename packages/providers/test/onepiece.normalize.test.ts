import { expect, test } from "bun:test";
import { normalizeCard, normalizeSet, normalizeAllSetCardRow } from "../src/onepiece/normalize";

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
