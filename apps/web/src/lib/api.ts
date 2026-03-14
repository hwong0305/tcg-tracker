export type DashboardCard = {
  id: string;
  sourceCardId: string;
  cardName: string;
  setId: string;
  setName: string;
  rarity: string | null;
  marketPrice: number | null;
  imageUrl: string | null;
  isChase: boolean;
  tcgType: string;
  printStatus: "in-print" | "out-of-print";
};

export type DashboardData = {
  sets: Array<{ id: string; setName: string; sourceSetId: string }>;
  cards: DashboardCard[];
};

export async function fetchDashboard(): Promise<DashboardData> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  const res = await fetch(`${baseUrl}/dashboard`);
  if (!res.ok) throw new Error("DASHBOARD_FETCH_FAILED");
  return res.json();
}
