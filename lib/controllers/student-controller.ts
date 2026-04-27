import { NextResponse } from "next/server";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { canAccessStudent, requireRole, teacherOwnsGroup } from "@/lib/services/auth-service";
import { createStudentRecord, deleteStudentRecord, getStudentById, updateStudentRecord } from "@/lib/services/student-service";
import { getDashboardData } from "@/lib/store";

export async function listStudentsController() {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const dashboard = await getDashboardData();
  if (session?.role === "teacher") {
    const teacherGroups = dashboard.groups.filter((group) =>
      teacherOwnsGroup(group.teacher, {
        name: session.name,
        email: session.email,
      }),
    );
    const groupNames = new Set(teacherGroups.map((group) => group.name));
    const students = dashboard.students.filter((student) => groupNames.has(student.group));
    const studentIds = new Set(students.map((student) => student.id));

    return NextResponse.json({
      ...dashboard,
      students,
      groups: teacherGroups,
      insights: dashboard.insights.filter((insight) => studentIds.has(insight.id)),
      enrollments: dashboard.enrollments.filter((enrollment) => studentIds.has(enrollment.studentId)),
      users: dashboard.users.filter((user) => user.role !== "student" || (user.linkedStudentId && studentIds.has(user.linkedStudentId))),
    });
  }

  return NextResponse.json(dashboard);
}

export async function createStudentController(request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const payload = await request.json();
  const result = await createStudentRecord(payload);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", 400);
  return NextResponse.json(result.student, { status: 201 });
}

export async function getStudentController(studentId: string) {
  const session = await getCurrentSession();
  if (!canAccessStudent(session, studentId)) return jsonError("Bu student ma'lumotiga ruxsat yo'q.", 403);
  const student = await getStudentById(studentId);
  if (!student) return jsonError("Talaba topilmadi.", 404);
  return NextResponse.json(student);
}

export async function updateStudentController(studentId: string, request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const payload = await request.json();
  const result = await updateStudentRecord(studentId, payload);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", result.error === "Talaba topilmadi." ? 404 : 400);
  return NextResponse.json(result.student);
}

export async function deleteStudentController(studentId: string) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const result = await deleteStudentRecord(studentId);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", 404);
  return NextResponse.json({ ok: true, student: result.student });
}
