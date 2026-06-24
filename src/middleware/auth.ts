import type { Context, Next } from "hono";
import type { Env, AppVariables } from "../types";
import { verifyAccessToken } from "../lib/jwt";

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized", message: "Missing access token" }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(c.env, token);
  if (!payload) {
    return c.json({ error: "Unauthorized", message: "Invalid or expired token" }, 401);
  }

  c.set("userId", payload.sub);
  c.set("email", payload.email);
  await next();
}
