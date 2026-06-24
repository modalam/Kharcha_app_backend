import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import auth from "./routes/auth";
import categories from "./routes/categories";
import expenses from "./routes/expenses";
import journals from "./routes/journals";
import { dashboard, analytics, reports, exportRoutes } from "./routes/analytics";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => origin ?? c.env.FRONTEND_URL,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.get("/api/health", (c) => c.json({ status: "ok", service: "kharcha-api" }));

app.get("/api/health/db", async (c) => {
  try {
    const row = await c.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).first();
    const count = await c.env.DB.prepare("SELECT COUNT(*) as total FROM users").first<{ total: number }>();
    const users = await c.env.DB.prepare("SELECT id, name, email FROM users LIMIT 5").all();
    return c.json({
      status: "ok",
      database: "connected",
      usersTable: Boolean(row),
      userCount: count?.total ?? 0,
      users: users.results ?? [],
      tip: "Local dev data is NOT in Cloudflare dashboard. Use pnpm dev:remote for cloud D1.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return c.json({
      status: "error",
      database: "not ready",
      message,
      fix: "Run: cd backend && pnpm db:migrate",
    }, 500);
  }
});

app.route("/api/auth", auth);
app.route("/api/categories", categories);
app.route("/api/expenses", expenses);
app.route("/api/journals", journals);
app.route("/api/dashboard", dashboard);
app.route("/api/analytics", analytics);
app.route("/api/reports", reports);
app.route("/api/export", exportRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "InternalError", message: "An unexpected error occurred" }, 500);
});

app.notFound((c) => c.json({ error: "NotFound", message: "Route not found" }, 404));

export default app;
