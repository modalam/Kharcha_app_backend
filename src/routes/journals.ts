import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createJournalSchema,
  journalQuerySchema,
  updateJournalSchema,
} from "@/shared";
import type { Env, AppVariables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { mapJournal, newId } from "../lib/mappers";
import { nowISO } from "../lib/crypto";

const journals = new Hono<{ Bindings: Env; Variables: AppVariables }>();

journals.use("*", authMiddleware);

journals.get("/", zValidator("query", journalQuerySchema), async (c) => {
  const userId = c.get("userId");
  const query = c.req.valid("query");
  const conditions = ["user_id = ?"];
  const params: unknown[] = [userId];

  if (query.dateFrom) {
    conditions.push("journal_date >= ?");
    params.push(query.dateFrom);
  }
  if (query.dateTo) {
    conditions.push("journal_date <= ?");
    params.push(query.dateTo);
  }

  const where = conditions.join(" AND ");
  const offset = (query.page - 1) * query.limit;

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM daily_journals WHERE ${where}`
  )
    .bind(...params)
    .first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM daily_journals WHERE ${where} ORDER BY journal_date DESC LIMIT ? OFFSET ?`
  )
    .bind(...params, query.limit, offset)
    .all();

  const total = countRow?.total ?? 0;
  return c.json({
    data: (results ?? []).map((r) => mapJournal(r as Record<string, unknown>)),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  });
});

journals.post("/", zValidator("json", createJournalSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM daily_journals WHERE user_id = ? AND journal_date = ?"
  )
    .bind(userId, body.journalDate)
    .first();

  if (existing) {
    await c.env.DB.prepare("UPDATE daily_journals SET notes = ? WHERE id = ?")
      .bind(body.notes ?? null, existing.id)
      .run();
    const row = await c.env.DB.prepare("SELECT * FROM daily_journals WHERE id = ?")
      .bind(existing.id)
      .first();
    return c.json(mapJournal(row as Record<string, unknown>));
  }

  const id = newId();
  await c.env.DB.prepare(
    "INSERT INTO daily_journals (id, user_id, journal_date, notes, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, userId, body.journalDate, body.notes ?? null, nowISO())
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM daily_journals WHERE id = ?").bind(id).first();
  return c.json(mapJournal(row as Record<string, unknown>), 201);
});

journals.put("/:id", zValidator("json", updateJournalSchema), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = c.req.valid("json");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM daily_journals WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .first();
  if (!existing) return c.json({ error: "NotFound", message: "Journal not found" }, 404);

  await c.env.DB.prepare("UPDATE daily_journals SET notes = ? WHERE id = ? AND user_id = ?")
    .bind(body.notes ?? null, id, userId)
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM daily_journals WHERE id = ?").bind(id).first();
  return c.json(mapJournal(row as Record<string, unknown>));
});

journals.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await c.env.DB.prepare(
    "DELETE FROM daily_journals WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .run();
  if (!result.meta.changes) {
    return c.json({ error: "NotFound", message: "Journal not found" }, 404);
  }
  return c.json({ message: "Journal deleted" });
});

export default journals;
