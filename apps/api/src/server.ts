import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { registerDashboardRoutes } from "./routes/dashboard";
import { registerHealthRoutes } from "./routes/health";
import { registerJobRoutes } from "./routes/jobs";

const corsOrigins =
  Bun.env.CORS_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0) ?? ["http://localhost:5173", "http://127.0.0.1:5173"];

export const app = new Elysia().use(
  cors({
    origin: corsOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type"]
  })
);

registerHealthRoutes(app);
registerDashboardRoutes(app);
registerJobRoutes(app);

if (import.meta.main) {
  app.listen(3000);
}
