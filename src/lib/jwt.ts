import { SignJWT, jwtVerify } from "jose";
import type { Env } from "../types";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_DAYS = 7;

function getAccessSecret(env: Env) {
  return new TextEncoder().encode(env.JWT_SECRET);
}

function getRefreshSecret(env: Env) {
  return new TextEncoder().encode(env.JWT_REFRESH_SECRET);
}

export async function createAccessToken(
  env: Env,
  payload: { sub: string; email: string }
): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getAccessSecret(env));
}

export async function verifyAccessToken(
  env: Env,
  token: string
): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessSecret(env));
    return {
      sub: payload.sub as string,
      email: payload.email as string,
    };
  } catch {
    return null;
  }
}

export async function createRefreshTokenJwt(
  env: Env,
  payload: { sub: string; tokenId: string }
): Promise<string> {
  return new SignJWT({ tokenId: payload.tokenId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_DAYS}d`)
    .sign(getRefreshSecret(env));
}

export async function verifyRefreshTokenJwt(
  env: Env,
  token: string
): Promise<{ sub: string; tokenId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecret(env));
    return {
      sub: payload.sub as string,
      tokenId: payload.tokenId as string,
    };
  } catch {
    return null;
  }
}

export { REFRESH_TOKEN_DAYS };
