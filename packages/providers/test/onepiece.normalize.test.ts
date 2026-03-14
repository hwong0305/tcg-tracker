import { expect, test } from "bun:test";
import { normalizeCard, normalizeSet } from "../src/onepiece/normalize";

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
