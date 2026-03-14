import { expect, test } from "bun:test";

test("migration has required constraints", async () => {
  const migrationSql = await Bun.file("packages/data/drizzle/0001_initial.sql").text();
  expect(migrationSql).toMatch(/set_id"\s+uuid\s+NOT NULL/i);
  expect(migrationSql).toMatch(/references\s+"sets"\("id"\)/i);
  expect(migrationSql).toMatch(/msrp_pack_price"\s+numeric\(10,\s*2\)\s+DEFAULT\s+'4\.49'/i);
  expect(migrationSql).toMatch(/is_out_of_print"\s+boolean\s+DEFAULT\s+false/i);
  expect(migrationSql).toMatch(/data_quality"\s+text\s+DEFAULT\s+'stale'/i);
  expect(migrationSql).toMatch(/last_scraped"\s+timestamp(?:\s+with\s+time\s+zone)?\s+DEFAULT\s+now\(\)/i);
  expect(migrationSql).toMatch(/is_chase"\s+boolean\s+DEFAULT\s+false/i);
  expect(migrationSql).toMatch(/sets_tcg_type_source_set_id_unique/i);
  expect(migrationSql).toMatch(/cards_set_id_source_card_id_unique/i);
});
