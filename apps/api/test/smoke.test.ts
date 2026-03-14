import { expect, test } from "bun:test";

test("workspace scripts are defined", async () => {
  const pkgFile = Bun.file("package.json");
  expect(await pkgFile.exists()).toBe(true);

  const pkg = await pkgFile.json();
  expect(typeof pkg.scripts["dev:api"]).toBe("string");
  expect(typeof pkg.scripts["dev:web"]).toBe("string");
  expect(typeof pkg.scripts["test"]).toBe("string");
  expect(typeof pkg.scripts["jobs:ingest"]).toBe("string");
  expect(typeof pkg.scripts["jobs:scrape"]).toBe("string");
  expect(typeof pkg.scripts["jobs:recompute"]).toBe("string");
});

test("shared tsconfig exists", async () => {
  const paths = [
    "tsconfig.base.json",
    "apps/api/tsconfig.json",
    "apps/web/tsconfig.json",
    "packages/core/tsconfig.json",
    "packages/data/tsconfig.json",
    "packages/providers/tsconfig.json",
    "packages/jobs/tsconfig.json",
    "packages/core/package.json",
    "packages/data/package.json",
    "packages/providers/package.json",
    "packages/jobs/package.json"
  ];

  for (const path of paths) {
    expect(await Bun.file(path).exists()).toBe(true);
  }
});
