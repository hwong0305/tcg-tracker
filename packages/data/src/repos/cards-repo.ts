import { and, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import { cards, sets } from "../schema";

export type CardRow = {
  id: string;
  sourceCardId: string;
  setId: string;
  cardName: string;
  rarity: string | null;
  marketPrice: number | null;
  msrpPackPrice?: number | null;
  scrapedPackPrice?: number | null;
  isChase: boolean;
  imageUrl: string | null;
  fixtureKey?: string;
  tcgType?: string;
  printStatus?: "in-print" | "out-of-print";
  setName?: string;
};

const fixtureByCardId = new Map<string, string>();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toDbDecimal(value: number | null | undefined) {
  if (value == null) return null;
  return value.toFixed(2);
}

function mapCard(
  row: typeof cards.$inferSelect,
  extras?: {
    tcgType?: string;
    printStatus?: "in-print" | "out-of-print";
    setName?: string;
  }
): CardRow {
  return {
    id: row.id,
    sourceCardId: row.sourceCardId,
    setId: row.setId,
    cardName: row.cardName ?? "",
    rarity: row.rarity,
    marketPrice: row.marketPrice == null ? null : Number(row.marketPrice),
    isChase: row.isChase ?? false,
    imageUrl: row.imageUrl,
    fixtureKey: fixtureByCardId.get(row.id),
    tcgType: extras?.tcgType,
    printStatus: extras?.printStatus,
    setName: extras?.setName
  };
}

export const cardsRepo = {
  async upsertMany(rows: Array<Omit<CardRow, "id">>) {
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = await db
        .select()
        .from(cards)
        .where(and(eq(cards.setId, row.setId), eq(cards.sourceCardId, row.sourceCardId)))
        .limit(1);

      const base = {
        sourceCardId: row.sourceCardId,
        setId: row.setId,
        cardName: row.cardName,
        rarity: row.rarity,
        marketPrice: toDbDecimal(row.marketPrice),
        isChase: row.isChase,
        imageUrl: row.imageUrl
      };

      if (existing[0]) {
        await db.update(cards).set(base).where(eq(cards.id, existing[0].id));
        updated += 1;
      } else {
        await db.insert(cards).values(base);
        created += 1;
      }
    }

    return { created, updated };
  },

  async getBySetIds(setIds: string[]) {
    const map = new Map<string, CardRow[]>();
    if (setIds.length === 0) return map;

    const rows = await db.select().from(cards).where(inArray(cards.setId, setIds));
    for (const id of setIds) {
      map.set(
        id,
        rows.filter((row) => row.setId === id).map((row) => mapCard(row))
      );
    }
    return map;
  },

  async updateChaseFlags(setId: string, chaseMap: Map<string, { isChase: boolean }>) {
    for (const [cardId, status] of chaseMap.entries()) {
      await db
        .update(cards)
        .set({ isChase: status.isChase })
        .where(and(eq(cards.id, cardId), eq(cards.setId, setId)));
    }
  },

  async findBySetIds(setIds: string[]) {
    const validSetIds = setIds.filter((id) => UUID_RE.test(id));
    if (validSetIds.length === 0) return [];
    const rows = await db.select().from(cards).where(inArray(cards.setId, validSetIds));
    return rows.map((row) => mapCard(row));
  },

  async findByIds(ids: string[]) {
    const validIds = ids.filter((id) => UUID_RE.test(id));
    if (validIds.length === 0) return [];
    const rows = await db.select().from(cards).where(inArray(cards.id, validIds));
    return rows.map((row) => mapCard(row));
  },

  async findTrackedTargets() {
    const rows = await db.select().from(cards);
    return rows.map((row) => ({ id: row.id, sourceCardId: row.sourceCardId, cardName: row.cardName ?? "" }));
  },

  async findFiltered(filters: {
    setId?: string;
    rarity?: string;
    chaseOnly?: boolean;
    tcgType?: string;
    printStatus?: string;
  }) {
    const rows = await db
      .select({ card: cards, set: sets })
      .from(cards)
      .leftJoin(sets, eq(cards.setId, sets.id));

    return rows
      .filter(({ card, set }) => {
        if (filters.setId && filters.setId !== "all" && card.setId !== filters.setId) return false;
        if (filters.rarity && filters.rarity !== "all" && card.rarity !== filters.rarity) return false;
        if (filters.chaseOnly && !card.isChase) return false;
        if (filters.tcgType && filters.tcgType !== "all" && set?.tcgType !== filters.tcgType) return false;
        if (filters.printStatus === "in-print" && set?.isOutOfPrint) return false;
        if (filters.printStatus === "out-of-print" && !set?.isOutOfPrint) return false;
        return true;
      })
      .map(({ card, set }) =>
        mapCard(card, {
          tcgType: set?.tcgType,
          printStatus: set?.isOutOfPrint ? "out-of-print" : "in-print",
          setName: set?.setName
        })
      );
  },

  async seed(rows: CardRow[]) {
    for (const row of rows) {
      await db
        .insert(cards)
        .values({
          id: row.id,
          sourceCardId: row.sourceCardId,
          setId: row.setId,
          cardName: row.cardName,
          rarity: row.rarity,
          marketPrice: toDbDecimal(row.marketPrice),
          isChase: row.isChase,
          imageUrl: row.imageUrl
        })
        .onConflictDoUpdate({
          target: cards.id,
          set: {
            sourceCardId: row.sourceCardId,
            setId: row.setId,
            cardName: row.cardName,
            rarity: row.rarity,
            marketPrice: toDbDecimal(row.marketPrice),
            isChase: row.isChase,
            imageUrl: row.imageUrl
          }
        });

      if (row.fixtureKey) {
        fixtureByCardId.set(row.id, row.fixtureKey);
      }
    }
  }
};
