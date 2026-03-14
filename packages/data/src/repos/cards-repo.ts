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
};

const cardStore = new Map<string, CardRow>();

export const cardsRepo = {
  async upsertMany(rows: Array<Omit<CardRow, "id">>) {
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = Array.from(cardStore.values()).find(
        (v) => v.setId === row.setId && v.sourceCardId === row.sourceCardId
      );
      if (existing) {
        cardStore.set(existing.id, { ...existing, ...row });
        updated += 1;
      } else {
        const id = crypto.randomUUID();
        cardStore.set(id, { id, ...row });
        created += 1;
      }
    }

    return { created, updated };
  },

  async getBySetIds(setIds: string[]) {
    const map = new Map<string, CardRow[]>();
    for (const id of setIds) {
      map.set(id, Array.from(cardStore.values()).filter((c) => c.setId === id));
    }
    return map;
  },

  async updateChaseFlags(setId: string, chaseMap: Map<string, { isChase: boolean }>) {
    for (const card of Array.from(cardStore.values())) {
      if (card.setId !== setId) continue;
      const next = chaseMap.get(card.id);
      if (next) {
        card.isChase = next.isChase;
      }
    }
  },

  async findBySetIds(setIds: string[]) {
    return Array.from(cardStore.values()).filter((c) => setIds.includes(c.setId));
  },

  async findByIds(ids: string[]) {
    return Array.from(cardStore.values()).filter((c) => ids.includes(c.id));
  },

  async findTrackedTargets() {
    return Array.from(cardStore.values()).map((c) => ({ id: c.id, sourceCardId: c.sourceCardId, cardName: c.cardName }));
  },

  async findFiltered(filters: {
    setId?: string;
    rarity?: string;
    chaseOnly?: boolean;
    tcgType?: string;
    printStatus?: string;
  }) {
    return Array.from(cardStore.values()).filter((card) => {
      if (filters.setId && filters.setId !== "all" && card.setId !== filters.setId) return false;
      if (filters.rarity && filters.rarity !== "all" && card.rarity !== filters.rarity) return false;
      if (filters.chaseOnly && !card.isChase) return false;
      if (filters.tcgType && filters.tcgType !== "all" && card.tcgType !== filters.tcgType) return false;
      if (filters.printStatus && filters.printStatus !== "all" && card.printStatus !== filters.printStatus) return false;
      return true;
    });
  },

  async seed(rows: CardRow[]) {
    for (const row of rows) {
      cardStore.set(row.id, row);
    }
  }
};
