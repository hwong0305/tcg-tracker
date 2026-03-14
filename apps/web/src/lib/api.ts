export type DashboardCard = {
  id: string;
  cardName: string;
  printStatus: "in-print" | "out-of-print";
  tcgType: string;
  setId: string;
  rarity: string;
  isChase: boolean;
};

export type DashboardData = {
  sets: Array<{ id: string; setName: string }>;
  cards: DashboardCard[];
};

export async function fetchDashboard(): Promise<DashboardData> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  const res = await fetch(`${baseUrl}/dashboard`);
  if (!res.ok) throw new Error("DASHBOARD_FETCH_FAILED");
  return res.json();
}
