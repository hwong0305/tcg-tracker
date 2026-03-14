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

const setStore = new Map<string, SetRow>();

export const setsRepo = {
  async upsertMany(rows: Array<Omit<SetRow, "id">>) {
    let created = 0;
    let updated = 0;
    const outRows: SetRow[] = [];

    for (const row of rows) {
      const key = `${row.tcgType}:${row.sourceSetId}`;
      const existing = Array.from(setStore.values()).find((v) => `${v.tcgType}:${v.sourceSetId}` === key);

      if (existing) {
        setStore.set(existing.id, { ...existing, ...row });
        outRows.push(setStore.get(existing.id)!);
        updated += 1;
      } else {
        const id = crypto.randomUUID();
        const next: SetRow = {
          id,
          ...row
        };
        setStore.set(id, next);
        outRows.push(next);
        created += 1;
      }
    }

    return { created, updated, rows: outRows };
  },

  async updatePrintStatus(id: string, isOutOfPrint: boolean) {
    const row = setStore.get(id);
    if (!row) return;
    row.isOutOfPrint = isOutOfPrint;
  },

  async getByIds(ids: string[]) {
    return ids
      .map((id) => setStore.get(id))
      .filter((v): v is SetRow => Boolean(v));
  },

  async findFiltered(filters: {
    printStatus?: string;
    tcgType?: string;
    setId?: string;
  }) {
    return Array.from(setStore.values()).filter((set) => {
      if (filters.tcgType && filters.tcgType !== "all" && set.tcgType !== filters.tcgType) return false;
      if (filters.setId && filters.setId !== "all" && set.id !== filters.setId) return false;
      if (filters.printStatus === "in-print" && set.isOutOfPrint) return false;
      if (filters.printStatus === "out-of-print" && !set.isOutOfPrint) return false;
      return true;
    });
  },

  async seed(rows: SetRow[]) {
    for (const row of rows) {
      setStore.set(row.id, row);
    }
  }
};
