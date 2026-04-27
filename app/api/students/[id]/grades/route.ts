import { NextResponse } from "next/server";
import { addGrade } from "@/lib/store";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { canTeacherManageStudent, requireRole } from "@/lib/services/auth-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { id } = await params;
  const access = await canTeacherManageStudent(session, id);
  if (!access) return jsonError("Bu student uchun baho qo'yishga ruxsat yo'q.", 403);

  const payload = await request.json();

  if (!payload.subject || !payload.examDate) {
    return NextResponse.json({ error: "Fan va sana kiritilishi kerak." }, { status: 400 });
  }

  const student = await addGrade(id, {
    subject: payload.subject,
    score: Number(payload.score),
    maxScore: Number(payload.maxScore || 100),
    examDate: payload.examDate,
    note: payload.note,
  });

  if (!student) {
    return NextResponse.json({ error: "Talaba topilmadi." }, { status: 404 });
  }

  return NextResponse.json(student, { status: 201 });
}
