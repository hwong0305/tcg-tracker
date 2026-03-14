export interface PrintStatusInput {
  releaseDate: string;
  currentBoxPrice: number | null;
  todayUtc: string;
  previousIsOutOfPrint?: boolean;
}

export interface PrintStatusResult {
  isOutOfPrint: boolean;
  reason: "age" | "price" | "recent-and-sub-20-percent" | "preserve-on-null-price" | "default-in-print";
}

export interface ChaseInput {
  id: string;
  marketPrice: number | null;
  rarity: string | null;
  scrapedPackPrice?: number | null;
  msrpPackPrice?: number | null;
}

export interface ChaseResult {
  isChase: boolean;
  reasons: string[];
}
