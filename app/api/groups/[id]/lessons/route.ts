import { NextResponse } from "next/server";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { requireRole } from "@/lib/services/auth-service";
import { createLessonForGroup } from "@/lib/services/lesson-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { id } = await params;
  const payload = (await request.json()) as { date?: string; title?: string; topic?: string };
  const result = await createLessonForGroup(id, {
    date: payload.date ?? "",
    title: payload.title ?? "",
    topic: payload.topic ?? "",
  });

  if ("error" in result && result.error) return jsonError(result.error, result.status);
  return NextResponse.json(result.lesson, { status: 201 });
}
