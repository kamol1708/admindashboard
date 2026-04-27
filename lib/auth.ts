import { createHmac, timingSafeEqual } from "crypto";

export const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || "edu_admin_session";
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@hems.uz";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin123!";
export const ADMIN_NAME = process.env.ADMIN_NAME || "Azizbek Rahimov";
const DEV_SESSION_SECRET = "local-dev-session-secret-change-me";

export type SessionPayload = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  linkedStudentId?: string;
};

function getSessionSecret() {
  return process.env.SESSION_SECRET?.trim() || DEV_SESSION_SECRET;
}

export function encodeSession(session: SessionPayload) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function decodeSession(value?: string) {
  if (!value) return null;

  try {
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return null;

    const expected = createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
    const matches =
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

    if (!matches) return null;

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    return parsed?.name && parsed?.role && parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}
