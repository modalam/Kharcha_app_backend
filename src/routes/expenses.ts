import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  bulkDeleteSchema,
  bulkCreateExpenseSchema,
  createExpenseSchema,
  duplicateExpenseSchema,
  expenseQuerySchema,
  updateExpenseSchema,
} from "@/shared";
import type { Env, AppVariables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { mapExpense, newId } from "../lib/mappers";
import { nowISO } from "../lib/crypto";

const EXPENSE_SELECT = `
  SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
  FROM expenses e
  LEFT JOIN categories c ON e.category_id = c.id
`;

function buildExpenseQuery(userId: string, query: ReturnType<typeof expenseQuerySchema.parse>) {
  const conditions = ["e.user_id = ?"];
  const params: unknown[] = [userId];

  if (query.q) {
    conditions.push("(e.title LIKE ? OR e.notes LIKE ?)");
    const term = `%${query.q}%`;
    params.push(term, term);
  }
  if (query.categoryId) {
    conditions.push("e.category_id = ?");
    params.push(query.categoryId);
  }
  if (query.month && query.year) {
    conditions.push("strftime('%m', e.expense_date) = ? AND strftime('%Y', e.expense_date) = ?");
    params.push(String(query.month).padStart(2, "0"), String(query.year));
  } else if (query.year) {
    conditions.push("strftime('%Y', e.expense_date) = ?");
    params.push(String(query.year));
  }
  if (query.paymentMethod) {
    conditions.push("e.payment_method = ?");
    params.push(query.paymentMethod);
  }
  if (query.amountMin !== undefined) {
    conditions.push("e.amount >= ?");
    params.push(query.amountMin);
  }
  if (query.amountMax !== undefined) {
    conditions.push("e.amount <= ?");
    params.push(query.amountMax);
  }
  if (query.dateFrom) {
    conditions.push("e.expense_date >= ?");
    params.push(query.dateFrom);
  }
  if (query.dateTo) {
    conditions.push("e.expense_date <= ?");
    params.push(query.dateTo);
  }

  const where = conditions.join(" AND ");
  const sortCol = query.sortBy === "expense_date" ? "e.expense_date" :
    query.sortBy === "amount" ? "e.amount" :
    query.sortBy === "title" ? "e.title" : "e.created_at";

  return { where, params, sortCol, order: query.order.toUpperCase() };
}

const expenses = new Hono<{ Bindings: Env; Variables: AppVariables }>();

expenses.use("*", authMiddleware);

expenses.get("/", zValidator("query", expenseQuerySchema), async (c) => {
  const userId = c.get("userId");
  const query = c.req.valid("query");
  const { where, params, sortCol, order } = buildExpenseQuery(userId, query);
  const offset = (query.page - 1) * query.limit;

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM expenses e WHERE ${where}`
  )
    .bind(...params)
    .first<{ total: number }>();

  const { results } = await c.env.DB.prepare(
    `${EXPENSE_SELECT} WHERE ${where} ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`
  )
    .bind(...params, query.limit, offset)
    .all();

  const total = countRow?.total ?? 0;
  return c.json({
    data: (results ?? []).map((r) => mapExpense(r as Record<string, unknown>)),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  });
});

expenses.post("/bulk-delete", zValidator("json", bulkDeleteSchema), async (c) => {
  const userId = c.get("userId");
  const { ids } = c.req.valid("json");
  const placeholders = ids.map(() => "?").join(",");
  const result = await c.env.DB.prepare(
    `DELETE FROM expenses WHERE user_id = ? AND id IN (${placeholders})`
  )
    .bind(userId, ...ids)
    .run();
  return c.json({ message: "Expenses deleted", count: result.meta.changes });
});

expenses.post("/duplicate", zValidator("json", duplicateExpenseSchema), async (c) => {
  const userId = c.get("userId");
  const { id, expenseDate } = c.req.valid("json");

  const source = await c.env.DB.prepare(
    "SELECT * FROM expenses WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .first<Record<string, unknown>>();
  if (!source) return c.json({ error: "NotFound", message: "Expense not found" }, 404);

  const newExpenseId = newId();
  const ts = nowISO();
  const date = expenseDate ?? (source.expense_date as string);

  await c.env.DB.prepare(
    `INSERT INTO expenses (id, user_id, category_id, title, amount, expense_date, subcategory, notes, payment_method, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      newExpenseId, userId, source.category_id, source.title, source.amount, date,
      source.subcategory, source.notes, source.payment_method, ts, ts
    )
    .run();

  const row = await c.env.DB.prepare(`${EXPENSE_SELECT} WHERE e.id = ?`)
    .bind(newExpenseId)
    .first();
  return c.json(mapExpense(row as Record<string, unknown>), 201);
});

expenses.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(`${EXPENSE_SELECT} WHERE e.id = ? AND e.user_id = ?`)
    .bind(id, userId)
    .first();
  if (!row) return c.json({ error: "NotFound", message: "Expense not found" }, 404);
  return c.json(mapExpense(row as Record<string, unknown>));
});

expenses.post("/", zValidator("json", createExpenseSchema), async (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");
  const id = newId();
  const ts = nowISO();

  await c.env.DB.prepare(
    `INSERT INTO expenses (id, user_id, category_id, title, amount, expense_date, subcategory, notes, payment_method, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, userId, body.categoryId, body.title, body.amount, body.expenseDate,
      body.subcategory ?? null, body.notes ?? null, body.paymentMethod ?? null, ts, ts
    )
    .run();

  const row = await c.env.DB.prepare(`${EXPENSE_SELECT} WHERE e.id = ?`).bind(id).first();
  return c.json(mapExpense(row as Record<string, unknown>), 201);
});

expenses.post("/bulk", zValidator("json", bulkCreateExpenseSchema), async (c) => {
  const userId = c.get("userId");
  const { expenses: items } = c.req.valid("json");
  const ts = nowISO();

  const insertStmt = c.env.DB.prepare(
    `INSERT INTO expenses (id, user_id, category_id, title, amount, expense_date, subcategory, notes, payment_method, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const operations = items.map((item) =>
    insertStmt.bind(
      newId(),
      userId,
      item.categoryId,
      item.title,
      item.amount,
      item.expenseDate,
      item.subcategory ?? null,
      item.notes ?? null,
      item.paymentMethod ?? null,
      ts,
      ts
    )
  );

  await c.env.DB.batch(operations);

  return c.json({ message: "Expenses imported", count: items.length }, 201);
});

expenses.put("/:id", zValidator("json", updateExpenseSchema), async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = c.req.valid("json");

  const existing = await c.env.DB.prepare(
    "SELECT id FROM expenses WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .first();
  if (!existing) return c.json({ error: "NotFound", message: "Expense not found" }, 404);

  const fields: string[] = ["updated_at = ?"];
  const values: unknown[] = [nowISO()];
  if (body.title !== undefined) { fields.push("title = ?"); values.push(body.title); }
  if (body.amount !== undefined) { fields.push("amount = ?"); values.push(body.amount); }
  if (body.categoryId !== undefined) { fields.push("category_id = ?"); values.push(body.categoryId); }
  if (body.expenseDate !== undefined) { fields.push("expense_date = ?"); values.push(body.expenseDate); }
  if (body.subcategory !== undefined) { fields.push("subcategory = ?"); values.push(body.subcategory); }
  if (body.notes !== undefined) { fields.push("notes = ?"); values.push(body.notes); }
  if (body.paymentMethod !== undefined) { fields.push("payment_method = ?"); values.push(body.paymentMethod); }

  await c.env.DB.prepare(
    `UPDATE expenses SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`
  )
    .bind(...values, id, userId)
    .run();

  const row = await c.env.DB.prepare(`${EXPENSE_SELECT} WHERE e.id = ?`).bind(id).first();
  return c.json(mapExpense(row as Record<string, unknown>));
});

expenses.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await c.env.DB.prepare(
    "DELETE FROM expenses WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .run();
  if (!result.meta.changes) {
    return c.json({ error: "NotFound", message: "Expense not found" }, 404);
  }
  return c.json({ message: "Expense deleted" });
});

export default expenses;
