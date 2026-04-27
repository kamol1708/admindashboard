import { NextResponse } from "next/server";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { requireRole, canAccessStudent } from "@/lib/services/auth-service";
import { createBootcampRecord, deleteBootcampRecord, listBootcamps, updateBootcampRecord } from "@/lib/services/bootcamp-service";
import { createEnrollmentRecord, deleteEnrollmentRecord, getStudentEnrollmentSummary, listEnrollments, updateEnrollmentRecord } from "@/lib/services/enrollment-service";

export async function listBootcampsController() {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher", "student"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const bootcamps = await listBootcamps();
  return NextResponse.json(bootcamps);
}

export async function createBootcampController(request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const payload = await request.json();
  const result = await createBootcampRecord(payload, session?.id);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", 400);
  return NextResponse.json(result.bootcamp, { status: 201 });
}

export async function updateBootcampController(bootcampId: string, request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const payload = await request.json();
  const result = await updateBootcampRecord(bootcampId, payload, session?.id);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", result.error === "Bootcamp topilmadi." ? 404 : 400);
  return NextResponse.json(result.bootcamp);
}

export async function deleteBootcampController(bootcampId: string) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const result = await deleteBootcampRecord(bootcampId, session?.id);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", result.error === "Bootcamp topilmadi." ? 404 : 400);
  return NextResponse.json({ ok: true, bootcamp: result.bootcamp });
}

export async function listEnrollmentsController(request: Request) {
  const session = await getCurrentSession();
  if (!session) return jsonError("Autentifikatsiya talab qilinadi.", 401);

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId") || undefined;

  if (studentId && !canAccessStudent(session, studentId)) {
    return jsonError("Bu student enrollment ma'lumotiga ruxsat yo'q.", 403);
  }

  const enrollments = await listEnrollments(session.role === "student" ? session.linkedStudentId : studentId);
  return NextResponse.json(enrollments);
}

export async function createEnrollmentController(request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const payload = await request.json();
  const result = await createEnrollmentRecord(payload);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", 400);
  return NextResponse.json(result.enrollment, { status: 201 });
}

export async function updateEnrollmentController(enrollmentId: string, request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const payload = await request.json();
  const result = await updateEnrollmentRecord(enrollmentId, payload, session?.id);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", result.error === "Enrollment topilmadi." ? 404 : 400);
  return NextResponse.json(result.enrollment);
}

export async function deleteEnrollmentController(enrollmentId: string) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const result = await deleteEnrollmentRecord(enrollmentId, session?.id);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", result.error === "Enrollment topilmadi." ? 404 : 400);
  return NextResponse.json({ ok: true, enrollment: result.enrollment });
}

export async function studentEnrollmentSummaryController(studentId: string) {
  const session = await getCurrentSession();
  if (!canAccessStudent(session, studentId)) {
    return jsonError("Bu student enrollment ma'lumotiga ruxsat yo'q.", 403);
  }

  const summary = await getStudentEnrollmentSummary(studentId);
  return NextResponse.json(summary);
}
