import { Elysia } from "elysia";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerHealthRoutes } from "./routes/health";
import { registerJobRoutes } from "./routes/jobs";

export const app = new Elysia();

registerHealthRoutes(app);
registerDashboardRoutes(app);
registerJobRoutes(app);

if (import.meta.main) {
  app.listen(3000);
}
