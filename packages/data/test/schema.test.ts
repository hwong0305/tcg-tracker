import { expect, test } from "bun:test";
import { cards, jobRuns, sets } from "../src/schema";

test("schema exports required table objects", () => {
  expect(sets).toBeDefined();
  expect(cards).toBeDefined();
  expect(jobRuns).toBeDefined();
});
