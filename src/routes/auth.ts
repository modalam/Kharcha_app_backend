import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { loginSchema, registerSchema, refreshTokenSchema } from "@/shared";
import type { Env } from "../types";
import {
  loginUser,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from "../services/auth";

const auth = new Hono<{ Bindings: Env }>();

auth.post("/register", zValidator("json", registerSchema), async (c) => {
  try {
    const { name, email, password } = c.req.valid("json");
    const user = await registerUser(c.env, name, email, password);
    return c.json({ message: "Account created successfully", user }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    const isDbError = message.includes("no such table") || message.includes("D1");
    return c.json(
      {
        error: "RegistrationError",
        message,
        hint: isDbError
          ? "Database not migrated. Run: cd backend && wrangler d1 migrations apply DB --remote"
          : undefined,
      },
      isDbError ? 500 : 400
    );
  }
});

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  try {
    const { email, password } = c.req.valid("json");
    const result = await loginUser(c.env, email, password);
    return c.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login failed";
    return c.json({ error: "LoginError", message }, 401);
  }
});

auth.post("/refresh-token", zValidator("json", refreshTokenSchema), async (c) => {
  try {
    const { refreshToken } = c.req.valid("json");
    const tokens = await rotateRefreshToken(c.env, refreshToken);
    return c.json(tokens);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Token refresh failed";
    return c.json({ error: "TokenError", message }, 401);
  }
});

auth.post("/logout", zValidator("json", refreshTokenSchema), async (c) => {
  const { refreshToken } = c.req.valid("json");
  await revokeRefreshToken(c.env, refreshToken);
  return c.json({ message: "Logged out successfully" });
});

export default auth;
