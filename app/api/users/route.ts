import { NextResponse } from "next/server";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { requireRole } from "@/lib/services/auth-service";
import { createTeacherUser } from "@/lib/services/student-service";
import { loadStore } from "@/lib/repositories/system-repository";

export async function GET() {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const store = await loadStore();
  return NextResponse.json(store.users);
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const payload = await request.json();

  if (!payload.fullName || !payload.email || !payload.password || payload.role !== "teacher") {
    return NextResponse.json({ error: "Teacher account maydonlari to'liq emas." }, { status: 400 });
  }

  const result = await createTeacherUser({
    fullName: payload.fullName,
    email: payload.email,
    password: payload.password,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.user, { status: 201 });
}
