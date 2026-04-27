export const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || "edu_admin_session";
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@hems.uz";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin123!";
export const ADMIN_NAME = process.env.ADMIN_NAME || "Azizbek Rahimov";

export type SessionPayload = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  linkedStudentId?: string;
};

export function encodeSession(session: SessionPayload) {
  return Buffer.from(JSON.stringify(session)).toString("base64");
}

export function decodeSession(value?: string) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64").toString("utf8")) as SessionPayload;
    return parsed?.name && parsed?.role && parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}
