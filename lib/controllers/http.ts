import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, decodeSession } from "@/lib/auth";

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(AUTH_COOKIE)?.value);
}

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
