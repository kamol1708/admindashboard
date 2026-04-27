import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const HASH_PREFIX = "scrypt";

export function isPasswordHashed(value: string) {
  return value.startsWith(`${HASH_PREFIX}$`);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${HASH_PREFIX}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  if (!isPasswordHashed(stored)) {
    return stored.trim() === password.trim();
  }

  const [, salt, hash] = stored.split("$");
  if (!salt || !hash) return false;

  const derived = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, "hex");
  if (derived.length !== original.length) return false;
  return timingSafeEqual(derived, original);
}
