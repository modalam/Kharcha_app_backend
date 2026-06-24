import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createCategorySchema,
  deleteCategorySchema,
  getCategorySchema,
  updateCategoryBodySchema,
} from "@/shared";
import type { Env, AppVariables } from "../types";
import { authMiddleware } from "../middleware/auth";
import { mapCategory, newId } from "../lib/mappers";
import { nowISO } from "../lib/crypto";

const categories = new Hono<{ Bindings: Env; Variables: AppVariables }>();

categories.use("*", authMiddleware);

categories.get("/list", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC"
  )
    .bind(userId)
    .all();
  return c.json((results ?? []).map((r) => mapCategory(r as Record<string, unknown>)));
});

categories.post("/id", zValidator("json", getCategorySchema), async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.valid("json");
  const row = await c.env.DB.prepare(
    "SELECT * FROM categories WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .first();
  if (!row) return c.json({ error: "NotFound", message: "Category not found" }, 404);
  return c.json(mapCategory(row as Record<string, unknown>));
});

categories.post("/create", zValidator("json", createCategorySchema), async (c) => {
  const userId = c.get("userId");
  const body = c.req.valid("json");
  const id = newId();
  await c.env.DB.prepare(
    "INSERT INTO categories (id, user_id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, userId, body.name, body.icon ?? null, body.color ?? null, nowISO())
    .run();
  const row = await c.env.DB.prepare("SELECT * FROM categories WHERE id = ?")
    .bind(id)
    .first();
  return c.json(mapCategory(row as Record<string, unknown>), 201);
});

categories.post("/update", zValidator("json", updateCategoryBodySchema), async (c) => {
  const userId = c.get("userId");
  const { id, name, icon, color } = c.req.valid("json");

  const existing = await c.env.DB.prepare(
    "SELECT * FROM categories WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .first<Record<string, unknown>>();
  if (!existing) return c.json({ error: "NotFound", message: "Category not found" }, 404);

  const nextName = name ?? (existing.name as string);
  const nextIcon = icon !== undefined ? icon : (existing.icon as string | null);
  const nextColor = color !== undefined ? color : (existing.color as string | null);

  await c.env.DB.prepare(
    "UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ? AND user_id = ?"
  )
    .bind(nextName, nextIcon, nextColor, id, userId)
    .run();

  return c.json(
    mapCategory({
      ...existing,
      name: nextName,
      icon: nextIcon,
      color: nextColor,
    })
  );
});

categories.post("/delete", zValidator("json", deleteCategorySchema), async (c) => {
  const userId = c.get("userId");
  const { id } = c.req.valid("json");

  const existing = await c.env.DB.prepare(
    "SELECT * FROM categories WHERE id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .first();
  if (!existing) return c.json({ error: "NotFound", message: "Category not found" }, 404);

  const expenseCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM expenses WHERE category_id = ? AND user_id = ?"
  )
    .bind(id, userId)
    .first<{ count: number }>();

  if (expenseCount && expenseCount.count > 0) {
    const other = await c.env.DB.prepare(
      "SELECT id FROM categories WHERE user_id = ? AND name = 'Other' LIMIT 1"
    )
      .bind(userId)
      .first<{ id: string }>();

    if (other) {
      await c.env.DB.prepare(
        "UPDATE expenses SET category_id = ? WHERE category_id = ? AND user_id = ?"
      )
        .bind(other.id, id, userId)
        .run();
    } else {
      return c.json(
        { error: "Conflict", message: "Category has expenses. Create an 'Other' category first." },
        409
      );
    }
  }

  await c.env.DB.prepare("DELETE FROM categories WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return c.json({ message: "Category deleted" });
});

export default categories;
