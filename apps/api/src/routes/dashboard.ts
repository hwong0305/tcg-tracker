import type { Elysia } from "elysia";
import { dashboardRepo } from "../services/dashboard-repo";

export function registerDashboardRoutes(app: Elysia) {
  app.get("/dashboard", async ({ query }) => {
    const filters = {
      printStatus: query.printStatus as string | undefined,
      tcgType: query.tcgType as string | undefined,
      setId: query.setId as string | undefined,
      rarity: query.rarity as string | undefined,
      chaseOnly: query.chaseOnly === "true"
    };

    const data = await dashboardRepo.getDashboard(filters);
    return {
      sets: data.sets,
      cards: data.cards,
      meta: { generatedAt: new Date().toISOString() }
    };
  });
}
