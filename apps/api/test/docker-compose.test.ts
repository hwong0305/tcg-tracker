import { expect, test } from "bun:test";

test("docker-compose defines postgres, api, and web services", async () => {
  const file = Bun.file("docker-compose.yml");
  expect(await file.exists()).toBe(true);

  const content = await file.text();
  expect(content).toContain("postgres:");
  expect(content).toContain("api:");
  expect(content).toContain("web:");
  expect(content).toContain("image: postgres:16");
});
