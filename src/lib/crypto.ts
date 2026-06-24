import { scrypt } from "@noble/hashes/scrypt";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dkLen: 32 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = scrypt(password.normalize("NFKC"), salt, SCRYPT_PARAMS);
  return `${bytesToHex(salt)}:${bytesToHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = hexToBytes(saltHex);
  const expected = hexToBytes(hashHex);
  const actual = scrypt(password.normalize("NFKC"), salt, SCRYPT_PARAMS);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

export function generateToken(): string {
  const bytes = randomBytes(32);
  return bytesToHex(bytes);
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86400000).toISOString();
}
