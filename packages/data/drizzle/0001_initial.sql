CREATE TABLE "sets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tcg_type" text NOT NULL,
  "source_set_id" text NOT NULL,
  "set_name" text NOT NULL,
  "release_date" date,
  "msrp_pack_price" numeric(10, 2) DEFAULT '4.49',
  "current_box_price" numeric(10, 2),
  "is_out_of_print" boolean DEFAULT false,
  "data_quality" text DEFAULT 'stale',
  "last_scraped" timestamp DEFAULT now()
);

ALTER TABLE "sets" ADD CONSTRAINT "sets_tcg_type_source_set_id_unique" UNIQUE("tcg_type", "source_set_id");

CREATE TABLE "cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "set_id" uuid NOT NULL,
  "source_card_id" text NOT NULL,
  "card_name" text,
  "rarity" text,
  "market_price" numeric(10, 2),
  "is_chase" boolean DEFAULT false,
  "image_url" text,
  "last_price_updated" timestamp
);

ALTER TABLE "cards" ADD CONSTRAINT "cards_set_id_source_card_id_unique" UNIQUE("set_id", "source_card_id");
ALTER TABLE "cards" ADD CONSTRAINT "cards_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "sets"("id");

CREATE TABLE "job_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  "status" text NOT NULL,
  "request_payload_json" jsonb,
  "stats_json" jsonb,
  "errors_json" jsonb,
  "requested_at" timestamp DEFAULT now() NOT NULL,
  "started_at" timestamp,
  "finished_at" timestamp
);
