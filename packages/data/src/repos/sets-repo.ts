import { and, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import { sets } from "../schema";

export type SetRow = {
  id: string;
  tcgType: string;
  sourceSetId: string;
  setName: string;
  releaseDate: string | null;
  currentBoxPrice: number | null;
  msrpPackPrice: number | null;
  isOutOfPrint: boolean;
  fixtureKey?: string;
};

const fixtureBySetId = new Map<string, string>();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toDbDecimal(value: number | null | undefined) {
  if (value == null) return null;
  return value.toFixed(2);
}

function mapSet(row: typeof sets.$inferSelect): SetRow {
  return {
    id: row.id,
    tcgType: row.tcgType,
    sourceSetId: row.sourceSetId,
    setName: row.setName,
    releaseDate: row.releaseDate,
    currentBoxPrice: row.currentBoxPrice == null ? null : Number(row.currentBoxPrice),
    msrpPackPrice: row.msrpPackPrice == null ? null : Number(row.msrpPackPrice),
    isOutOfPrint: row.isOutOfPrint ?? false,
    fixtureKey: fixtureBySetId.get(row.id)
  };
}

export const setsRepo = {
  async upsertMany(rows: Array<Omit<SetRow, "id">>) {
    let created = 0;
    let updated = 0;
    const outRows: SetRow[] = [];

    for (const row of rows) {
      const existing = await db
        .select()
        .from(sets)
        .where(and(eq(sets.tcgType, row.tcgType), eq(sets.sourceSetId, row.sourceSetId)))
        .limit(1);

      const base = {
        tcgType: row.tcgType,
        sourceSetId: row.sourceSetId,
        setName: row.setName,
        releaseDate: row.releaseDate,
        currentBoxPrice: toDbDecimal(row.currentBoxPrice),
        msrpPackPrice: toDbDecimal(row.msrpPackPrice),
        isOutOfPrint: row.isOutOfPrint
      };

      if (existing[0]) {
        const updatedRows = await db
          .update(sets)
          .set(base)
          .where(eq(sets.id, existing[0].id))
          .returning();
        outRows.push(mapSet(updatedRows[0]));
        updated += 1;
      } else {
        const inserted = await db.insert(sets).values(base).returning();
        outRows.push(mapSet(inserted[0]));
        created += 1;
      }
    }

    return { created, updated, rows: outRows };
  },

  async updatePrintStatus(id: string, isOutOfPrint: boolean) {
    await db.update(sets).set({ isOutOfPrint }).where(eq(sets.id, id));
  },

  async getByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const rows = await db.select().from(sets).where(inArray(sets.id, ids));
    return rows.map(mapSet);
  },

  async findFiltered(filters: {
    printStatus?: string;
    tcgType?: string;
    setId?: string;
  }) {
    const conditions = [] as Array<any>;

    if (filters.tcgType && filters.tcgType !== "all") {
      conditions.push(eq(sets.tcgType, filters.tcgType));
    }
    if (filters.setId && filters.setId !== "all") {
      if (UUID_RE.test(filters.setId)) {
        conditions.push(eq(sets.id, filters.setId));
      } else {
        conditions.push(eq(sets.sourceSetId, filters.setId));
      }
    }
    if (filters.printStatus === "in-print") {
      conditions.push(eq(sets.isOutOfPrint, false));
    }
    if (filters.printStatus === "out-of-print") {
      conditions.push(eq(sets.isOutOfPrint, true));
    }

    const rows = conditions.length
      ? await db.select().from(sets).where(and(...conditions))
      : await db.select().from(sets);

    return rows.map(mapSet);
  },

  async seed(rows: SetRow[]) {
    for (const row of rows) {
      await db
        .insert(sets)
        .values({
          id: row.id,
          tcgType: row.tcgType,
          sourceSetId: row.sourceSetId,
          setName: row.setName,
          releaseDate: row.releaseDate,
          currentBoxPrice: toDbDecimal(row.currentBoxPrice),
          msrpPackPrice: toDbDecimal(row.msrpPackPrice),
          isOutOfPrint: row.isOutOfPrint
        })
        .onConflictDoUpdate({
          target: sets.id,
          set: {
            tcgType: row.tcgType,
            sourceSetId: row.sourceSetId,
            setName: row.setName,
            releaseDate: row.releaseDate,
            currentBoxPrice: toDbDecimal(row.currentBoxPrice),
            msrpPackPrice: toDbDecimal(row.msrpPackPrice),
            isOutOfPrint: row.isOutOfPrint
          }
        });

      if (row.fixtureKey) {
        fixtureBySetId.set(row.id, row.fixtureKey);
      }
    }
  }
};
