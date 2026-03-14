import { boolean, date, decimal, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const sets = pgTable(
  "sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tcgType: text("tcg_type").notNull(),
    sourceSetId: text("source_set_id").notNull(),
    setName: text("set_name").notNull(),
    releaseDate: date("release_date"),
    msrpPackPrice: decimal("msrp_pack_price", { precision: 10, scale: 2 }).default("4.49"),
    currentBoxPrice: decimal("current_box_price", { precision: 10, scale: 2 }),
    isOutOfPrint: boolean("is_out_of_print").default(false),
    dataQuality: text("data_quality").default("stale"),
    lastScraped: timestamp("last_scraped").defaultNow()
  },
  (t) => [unique("sets_tcg_type_source_set_id_unique").on(t.tcgType, t.sourceSetId)]
);

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    setId: uuid("set_id").notNull().references(() => sets.id),
    sourceCardId: text("source_card_id").notNull(),
    cardName: text("card_name"),
    rarity: text("rarity"),
    marketPrice: decimal("market_price", { precision: 10, scale: 2 }),
    isChase: boolean("is_chase").default(false),
    imageUrl: text("image_url"),
    lastPriceUpdated: timestamp("last_price_updated")
  },
  (t) => [unique("cards_set_id_source_card_id_unique").on(t.setId, t.sourceCardId)]
);

export const jobRuns = pgTable("job_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  requestPayloadJson: jsonb("request_payload_json"),
  statsJson: jsonb("stats_json"),
  errorsJson: jsonb("errors_json"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at")
});
