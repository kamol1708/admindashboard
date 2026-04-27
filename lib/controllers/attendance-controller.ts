import { NextResponse } from "next/server";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { requireRole } from "@/lib/services/auth-service";
import { loadStore } from "@/lib/repositories/system-repository";
import {
  createAttendanceRecord,
  createTeacherLessonEntry,
  exportAttendanceCsv,
  importStudentsCsv,
  listAttendanceRecords,
  updateAttendanceRecord,
} from "@/lib/services/attendance-service";
import { teacherOwnsGroup } from "@/lib/services/auth-service";

export async function listAttendanceController(request: Request) {
  const session = await getCurrentSession();
  if (!session) return jsonError("Autentifikatsiya talab qilinadi.", 401);

  const { searchParams } = new URL(request.url);
  const filter = {
    studentId: searchParams.get("studentId") || undefined,
    group: searchParams.get("group") || undefined,
    status: (searchParams.get("status") as "present" | "late" | "absent" | null) || undefined,
    lowAttendanceOnly: searchParams.get("lowAttendance") === "true",
    absentOnly: searchParams.get("absentOnly") === "true",
    search: searchParams.get("search") || undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    view: (searchParams.get("view") as "day" | "week" | "month" | null) || undefined,
    anchorDate: searchParams.get("anchorDate") || undefined,
  };

  if (session.role === "student") {
    filter.studentId = session.linkedStudentId;
  }

  let records = await listAttendanceRecords(filter);
  if (session.role === "teacher") {
    const store = await loadStore();
    const allowedGroups = new Set(
      store.groups
        .filter((group) =>
          teacherOwnsGroup(group.teacher, {
            name: session.name,
            email: session.email,
          }),
        )
        .map((group) => group.name),
    );
    records = records.filter((record) => allowedGroups.has(record.group));
  }
  return NextResponse.json(records);
}

export async function createAttendanceController(request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher"]);
  if (!auth.ok || !session) return jsonError(auth.ok ? "Session topilmadi." : auth.error, auth.ok ? 401 : auth.status);

  const payload = await request.json();
  const result = await createAttendanceRecord(payload, session);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", result.status ?? 400);
  return NextResponse.json(result.record, { status: 201 });
}

export async function createStudentAttendanceController(studentId: string, request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher"]);
  if (!auth.ok || !session) return jsonError(auth.ok ? "Session topilmadi." : auth.error, auth.ok ? 401 : auth.status);

  const payload = await request.json();
  const result = await createAttendanceRecord({ ...payload, studentId }, session);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", result.status ?? 400);
  return NextResponse.json(result.record, { status: 201 });
}

export async function createTeacherLessonEntryController(request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher"]);
  if (!auth.ok || !session) return jsonError(auth.ok ? "Session topilmadi." : auth.error, auth.ok ? 401 : auth.status);

  const payload = await request.json();
  const result = await createTeacherLessonEntry(payload, session);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", result.status ?? 400);
  return NextResponse.json(result, { status: 201 });
}

export async function updateAttendanceController(recordId: string, request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher"]);
  if (!auth.ok || !session) return jsonError(auth.ok ? "Session topilmadi." : auth.error, auth.ok ? 401 : auth.status);

  const payload = await request.json();
  const result = await updateAttendanceRecord(recordId, payload, session);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", result.status ?? 400);
  return NextResponse.json(result.record);
}

export async function exportAttendanceController(request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { searchParams } = new URL(request.url);
  const csv = await exportAttendanceCsv({
    studentId: searchParams.get("studentId") || undefined,
    group: searchParams.get("group") || undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
  });
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attendance-export.csv"',
    },
  });
}

export async function importStudentsController(request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const csv = await request.text();
  const result = await importStudentsCsv(csv);
  return NextResponse.json(result);
}
