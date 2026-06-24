import { DEFAULT_CATEGORIES } from "@/shared";
import type { Env } from "../types";
import {
  addDays,
  generateToken,
  hashPassword,
  hashToken,
  nowISO,
  verifyPassword,
} from "../lib/crypto";
import { createAccessToken, createRefreshTokenJwt } from "../lib/jwt";
import { mapUser, newId } from "../lib/mappers";

export async function seedDefaultCategories(db: D1Database, userId: string) {
  const stmt = db.prepare(
    "INSERT INTO categories (id, user_id, name, icon, color, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const batch = DEFAULT_CATEGORIES.map((cat) =>
    stmt.bind(newId(), userId, cat.name, cat.icon, cat.color, nowISO())
  );
  await db.batch(batch);
}

export async function issueTokens(env: Env, userId: string, email: string) {
  const tokenId = newId();
  const opaqueToken = generateToken();
  const tokenHash = await hashToken(opaqueToken);
  const expiresAt = addDays(new Date(), 7);

  await env.DB.prepare(
    "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(tokenId, userId, tokenHash, expiresAt)
    .run();

  const accessToken = await createAccessToken(env, { sub: userId, email });
  const refreshToken = await createRefreshTokenJwt(env, { sub: userId, tokenId });
  const refreshTokenCombined = `${opaqueToken}::${refreshToken}`;

  return { accessToken, refreshToken: refreshTokenCombined };
}

export async function rotateRefreshToken(
  env: Env,
  refreshTokenCombined: string
) {
  const [opaqueToken, jwtPart] = refreshTokenCombined.split("::");
  if (!opaqueToken || !jwtPart) throw new Error("Invalid refresh token");

  const payload = await import("../lib/jwt").then((m) =>
    m.verifyRefreshTokenJwt(env, jwtPart)
  );
  if (!payload) throw new Error("Invalid refresh token");

  const tokenHash = await hashToken(opaqueToken);
  const stored = await env.DB.prepare(
    "SELECT * FROM refresh_tokens WHERE id = ? AND token_hash = ? AND revoked_at IS NULL"
  )
    .bind(payload.tokenId, tokenHash)
    .first<Record<string, unknown>>();

  if (!stored) {
    await env.DB.prepare(
      "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL"
    )
      .bind(nowISO(), payload.sub)
      .run();
    throw new Error("Refresh token reuse detected");
  }

  if (new Date(stored.expires_at as string) < new Date()) {
    throw new Error("Refresh token expired");
  }

  await env.DB.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?")
    .bind(nowISO(), payload.tokenId)
    .run();

  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(payload.sub)
    .first<Record<string, unknown>>();
  if (!user) throw new Error("User not found");

  return issueTokens(env, user.id as string, user.email as string);
}

export async function revokeRefreshToken(
  env: Env,
  refreshTokenCombined: string
) {
  const [opaqueToken, jwtPart] = refreshTokenCombined.split("::");
  if (!opaqueToken || !jwtPart) return;

  const payload = await import("../lib/jwt").then((m) =>
    m.verifyRefreshTokenJwt(env, jwtPart)
  );
  if (!payload) return;

  const tokenHash = await hashToken(opaqueToken);
  await env.DB.prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?")
    .bind(nowISO(), payload.tokenId)
    .run();
}

export async function registerUser(
  env: Env,
  name: string,
  email: string,
  password: string
) {
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) throw new Error("Email already registered");

  const id = newId();
  const passwordHash = await hashPassword(password);
  const createdAt = nowISO();

  await env.DB.prepare(
    "INSERT INTO users (id, name, email, password_hash, is_verified, created_at) VALUES (?, ?, ?, ?, 1, ?)"
  )
    .bind(id, name, email, passwordHash, createdAt)
    .run();

  await seedDefaultCategories(env.DB, id);

  return mapUser({ id, name, email, is_verified: 1, created_at: createdAt });
}

export async function loginUser(env: Env, email: string, password: string) {
  const row = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<Record<string, unknown>>();
  if (!row || !row.password_hash) throw new Error("Invalid email or password");

  const valid = await verifyPassword(password, row.password_hash as string);
  if (!valid) throw new Error("Invalid email or password");

  const tokens = await issueTokens(env, row.id as string, row.email as string);
  return { user: mapUser(row), ...tokens };
}
