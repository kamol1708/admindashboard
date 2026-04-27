import { randomUUID } from "crypto";
import type { SessionPayload } from "@/lib/auth";
import type {
  AttendanceFilterModel,
  AttendanceReasonModel,
  AttendanceRecordModel,
  AttendanceStatusModel,
  CalendarViewModel,
  HomeworkStatusModel,
} from "@/lib/models/attendance";
import { updateStore, loadStore } from "@/lib/repositories/system-repository";
import { computeStudentAttendanceStats } from "@/lib/services/analytics-service";
import { evaluateNotifications } from "@/lib/services/notification-service";
import { canTeacherManageStudent } from "@/lib/services/auth-service";
import { sendTelegramLessonNotification } from "@/lib/services/telegram-service";

export interface CreateAttendanceInput {
  studentId: string;
  date: string;
  lessonTitle: string;
  topic: string;
  status: AttendanceStatusModel;
  reason: AttendanceReasonModel;
  lateMinutes: number;
  earlyLeave: boolean;
  participationScore: number;
  homeworkStatus: HomeworkStatusModel;
  dailyGrade: number;
  comment?: string;
}

export interface CreateTeacherLessonEntryInput extends CreateAttendanceInput {
  maxScore?: number;
}

function validateAttendanceInput(input: CreateAttendanceInput) {
  if (!input.studentId || !input.date || !input.lessonTitle) return "Student, sana va lesson majburiy.";
  if (![1, 2, 3, 4, 5].includes(input.participationScore)) return "Participation faqat 1-5 bo'lishi mumkin.";
  if (input.lateMinutes < 0) return "Late time manfiy bo'lishi mumkin emas.";
  if (input.dailyGrade < 0 || input.dailyGrade > 100) return "Daily grade 0-100 oralig'ida bo'lishi kerak.";
  return null;
}

function inRange(date: string, from?: string, to?: string) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function matchesView(recordDate: string, view: CalendarViewModel | undefined, anchorDate: string | undefined) {
  if (!view || !anchorDate) return true;
  const date = new Date(`${recordDate}T00:00:00`);
  const anchor = new Date(`${anchorDate}T00:00:00`);
  if (view === "day") return recordDate === anchorDate;
  if (view === "month") return date.getFullYear() === anchor.getFullYear() && date.getMonth() === anchor.getMonth();

  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return date >= start && date <= end;
}

export async function createAttendanceRecord(input: CreateAttendanceInput, session: SessionPayload) {
  const validationError = validateAttendanceInput(input);
  if (validationError) return { error: validationError, status: 400 };

  const access = await canTeacherManageStudent(session, input.studentId);
  if (!access) return { error: "Bu student uchun davomat kiritishga ruxsat yo'q.", status: 403 };

  const result = await updateStore((store) => {
    const student = store.students.find((item) => item.id === input.studentId);
    if (!student) return { error: "Talaba topilmadi.", status: 404 };

    const existing = store.attendanceRecords.find(
      (record) =>
        record.studentId === input.studentId &&
        record.date === input.date &&
        record.lessonTitle.trim().toLowerCase() === input.lessonTitle.trim().toLowerCase(),
    );
    if (existing) {
      return { error: "Bu student uchun ushbu dars allaqachon saqlangan.", status: 409 };
    }

    const record: AttendanceRecordModel = {
      id: randomUUID(),
      studentId: input.studentId,
      date: input.date,
      lessonTitle: input.lessonTitle,
      topic: input.topic,
      status: input.status,
      reason: input.reason,
      lateMinutes: input.lateMinutes,
      earlyLeave: input.earlyLeave,
      participationScore: input.participationScore,
      homeworkStatus: input.homeworkStatus,
      dailyGrade: input.dailyGrade,
      comment: input.comment?.trim() ?? "",
      recordedAt: new Date().toISOString(),
      recordedByUserId: session.id,
    };

    store.attendanceRecords.unshift(record);
    student.attendance.unshift({
      id: record.id,
      date: record.date,
      status: record.status === "absent" ? "absent" : input.lateMinutes > 0 ? "late" : "present",
      lesson: record.lessonTitle,
      topic: record.topic,
      homework: record.dailyGrade,
      comment: record.comment,
    });

    evaluateNotifications(store, student, record);
    store.auditLogs.unshift({
      id: randomUUID(),
      entityType: "attendance",
      entityId: record.id,
      action: "create",
      actorUserId: session.id,
      createdAt: new Date().toISOString(),
      summary: `${student.fullName} uchun ${record.date} attendance yozildi.`,
    });

    return { record };
  });

  if (!("error" in result)) {
    const statusLabel = input.status === "present" ? "Keldi" : input.status === "late" ? "Kechikdi" : "Kelmadi";
    void sendTelegramLessonNotification({
      studentId: input.studentId,
      lessonTitle: input.lessonTitle,
      date: input.date,
      dailyGrade: input.dailyGrade,
      attendanceLabel: statusLabel,
      topic: input.topic,
      comment: input.comment,
      homeworkStatus: input.homeworkStatus,
    }).catch(() => {});
  }

  return result;
}

export async function createTeacherLessonEntry(input: CreateTeacherLessonEntryInput, session: SessionPayload) {
  const validationError = validateAttendanceInput(input);
  if (validationError) return { error: validationError, status: 400 };

  const access = await canTeacherManageStudent(session, input.studentId);
  if (!access) return { error: "Bu student uchun davomat kiritishga ruxsat yo'q.", status: 403 };

  const result = await updateStore((store) => {
    const student = store.students.find((item) => item.id === input.studentId);
    if (!student) return { error: "Talaba topilmadi.", status: 404 };

    const existing = store.attendanceRecords.find(
      (record) =>
        record.studentId === input.studentId &&
        record.date === input.date &&
        record.lessonTitle.trim().toLowerCase() === input.lessonTitle.trim().toLowerCase(),
    );
    if (existing) {
      return { error: "Bu student uchun ushbu dars allaqachon saqlangan.", status: 409 };
    }

    const normalizedGrade = input.status === "absent" ? 0 : Math.max(0, Math.min(100, Number(input.dailyGrade)));
    const normalizedHomeworkStatus =
      input.status === "absent" ? "not_done" : input.homeworkStatus;
    const normalizedParticipation =
      input.status === "absent" ? 1 : input.participationScore;

    const record: AttendanceRecordModel = {
      id: randomUUID(),
      studentId: input.studentId,
      date: input.date,
      lessonTitle: input.lessonTitle,
      topic: input.topic,
      status: input.status,
      reason: input.reason,
      lateMinutes: input.lateMinutes,
      earlyLeave: input.earlyLeave,
      participationScore: normalizedParticipation,
      homeworkStatus: normalizedHomeworkStatus,
      dailyGrade: normalizedGrade,
      comment: input.comment?.trim() ?? "",
      recordedAt: new Date().toISOString(),
      recordedByUserId: session.id,
    };

    store.attendanceRecords.unshift(record);
    student.attendance.unshift({
      id: record.id,
      date: record.date,
      status: record.status === "absent" ? "absent" : record.lateMinutes > 0 ? "late" : "present",
      lesson: record.lessonTitle,
      topic: record.topic,
      homework: record.dailyGrade,
      comment: record.comment,
    });

    let gradeRecordId: string | null = null;
    if (input.status !== "absent") {
      gradeRecordId = randomUUID();
      student.grades.unshift({
        id: gradeRecordId,
        subject: input.lessonTitle.trim(),
        score: normalizedGrade,
        maxScore: Math.max(1, Number(input.maxScore ?? 100)),
        examDate: input.date,
        note: input.comment?.trim() ?? "",
      });
    }

    evaluateNotifications(store, student, record);
    store.auditLogs.unshift({
      id: randomUUID(),
      entityType: "attendance",
      entityId: record.id,
      action: "create",
      actorUserId: session.id,
      createdAt: new Date().toISOString(),
      summary:
        input.status === "absent"
          ? `${student.fullName} uchun ${record.date} attendance yozildi.`
          : `${student.fullName} uchun ${record.date} attendance va baho yozildi.`,
    });

    return {
      record,
      gradeCreated: Boolean(gradeRecordId),
    };
  });

  if (!("error" in result)) {
    const statusLabel = input.status === "present" ? "Keldi" : input.status === "late" ? "Kechikdi" : "Kelmadi";
    void sendTelegramLessonNotification({
      studentId: input.studentId,
      lessonTitle: input.lessonTitle,
      date: input.date,
      dailyGrade: input.status === "absent" ? undefined : Number(input.dailyGrade),
      attendanceLabel: statusLabel,
      topic: input.topic,
      comment: input.comment,
      homeworkStatus: input.homeworkStatus,
    }).catch(() => {});
  }

  return result;
}

export async function updateAttendanceRecord(recordId: string, input: Partial<CreateAttendanceInput>, session: SessionPayload) {
  const store = await loadStore();
  const current = store.attendanceRecords.find((item) => item.id === recordId);
  if (!current) return { error: "Attendance topilmadi.", status: 404 };

  const access = await canTeacherManageStudent(session, current.studentId);
  if (!access) return { error: "Bu attendance yozuvini tahrirlashga ruxsat yo'q.", status: 403 };

  const result = await updateStore((store) => {
    const record = store.attendanceRecords.find((item) => item.id === recordId);
    if (!record) return { error: "Attendance topilmadi.", status: 404 };
    const student = store.students.find((item) => item.id === record.studentId);
    if (!student) return { error: "Talaba topilmadi.", status: 404 };
    const previousLessonTitle = record.lessonTitle;
    const previousDate = record.date;

    const today = new Date().toISOString().slice(0, 10);
    if (store.settings.restrictPastAttendanceEdits && record.date < today) {
      return { error: "Oldingi attendance yozuvlarini tahrirlash taqiqlangan.", status: 403 };
    }

    if (input.status) record.status = input.status;
    if (input.reason) record.reason = input.reason;
    if (input.lessonTitle) record.lessonTitle = input.lessonTitle;
    if (input.topic !== undefined) record.topic = input.topic;
    if (typeof input.lateMinutes === "number") record.lateMinutes = input.lateMinutes;
    if (typeof input.earlyLeave === "boolean") record.earlyLeave = input.earlyLeave;
    if (typeof input.participationScore === "number") record.participationScore = input.participationScore;
    if (input.homeworkStatus) record.homeworkStatus = input.homeworkStatus;
    if (typeof input.dailyGrade === "number") record.dailyGrade = input.dailyGrade;
    if (input.comment !== undefined) record.comment = input.comment;

    const attendanceIndex = student.attendance.findIndex((entry) => entry.id === record.id);
    const attendanceStatus: "present" | "late" | "absent" =
      record.status === "absent" ? "absent" : record.lateMinutes > 0 ? "late" : "present";
    const attendanceSnapshot = {
      id: record.id,
      date: record.date,
      status: attendanceStatus,
      lesson: record.lessonTitle,
      topic: record.topic,
      homework: record.dailyGrade,
      comment: record.comment,
      reason: record.reason,
      earlyLeave: record.earlyLeave,
    };
    if (attendanceIndex >= 0) {
      student.attendance[attendanceIndex] = attendanceSnapshot;
    } else {
      student.attendance.unshift(attendanceSnapshot);
    }

    const gradeIndex = student.grades.findIndex(
      (grade) =>
        grade.examDate === previousDate &&
        (grade.subject.trim().toLowerCase() === previousLessonTitle.trim().toLowerCase() ||
          grade.subject.trim().toLowerCase() === record.lessonTitle.trim().toLowerCase()),
    );

    if (record.status === "absent") {
      if (gradeIndex >= 0) {
        student.grades.splice(gradeIndex, 1);
      }
    } else {
      const nextGrade = {
        id: gradeIndex >= 0 ? student.grades[gradeIndex].id : randomUUID(),
        subject: record.lessonTitle.trim(),
        score: record.dailyGrade,
        maxScore: gradeIndex >= 0 ? student.grades[gradeIndex].maxScore : 100,
        examDate: record.date,
        note: record.comment?.trim() ?? "",
      };

      if (gradeIndex >= 0) {
        student.grades[gradeIndex] = nextGrade;
      } else {
        student.grades.unshift(nextGrade);
      }
    }

    store.auditLogs.unshift({
      id: randomUUID(),
      entityType: "attendance",
      entityId: record.id,
      action: "update",
      actorUserId: session.id,
      createdAt: new Date().toISOString(),
      summary: `${record.date} attendance yangilandi.`,
    });

    return { record };
  });

  if (!("error" in result)) {
    const statusLabel =
      result.record.status === "present" ? "Keldi" : result.record.status === "late" ? "Kechikdi" : "Kelmadi";
    void sendTelegramLessonNotification({
      studentId: result.record.studentId,
      lessonTitle: result.record.lessonTitle,
      date: result.record.date,
      dailyGrade: result.record.status === "absent" ? undefined : Number(result.record.dailyGrade),
      attendanceLabel: statusLabel,
      topic: result.record.topic,
      comment: result.record.comment,
      homeworkStatus: result.record.homeworkStatus,
    }).catch(() => {});
  }

  return result;
}

export async function listAttendanceRecords(filter: AttendanceFilterModel = {}) {
  const store = await loadStore();
  const analytics = store.students.map((student) => ({
    studentId: student.id,
    fullName: student.fullName,
    group: student.group,
    stats: computeStudentAttendanceStats(student, store.attendanceRecords),
  }));

  return store.attendanceRecords
    .filter((record) => {
      const student = store.students.find((item) => item.id === record.studentId);
      const studentStats = analytics.find((item) => item.studentId === record.studentId)?.stats;
      const searchTarget = `${student?.fullName ?? ""} ${student?.id ?? ""} ${record.lessonTitle} ${record.topic}`.toLowerCase();

      if (filter.studentId && record.studentId !== filter.studentId) return false;
      if (filter.group && student?.group !== filter.group) return false;
      if (filter.status && record.status !== filter.status) return false;
      if (filter.absentOnly && record.status !== "absent") return false;
      if (filter.lowAttendanceOnly && (studentStats?.attendancePercentage ?? 100) >= store.settings.attendanceThresholdPercent) return false;
      if (filter.search && !searchTarget.includes(filter.search.toLowerCase())) return false;
      if (!inRange(record.date, filter.dateFrom, filter.dateTo)) return false;
      if (!matchesView(record.date, filter.view, filter.anchorDate)) return false;
      return true;
    })
    .map((record) => {
      const student = store.students.find((item) => item.id === record.studentId);
      return {
        ...record,
        studentName: student?.fullName ?? "Unknown",
        studentCode: student?.id ?? "Unknown",
        group: student?.group ?? "Unknown",
      };
    });
}

function escapeCsv(value: string | number | boolean) {
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export async function exportAttendanceCsv(filter: AttendanceFilterModel = {}) {
  const rows = await listAttendanceRecords(filter);
  const header = [
    "student_id",
    "student_name",
    "group",
    "date",
    "status",
    "reason",
    "late_minutes",
    "early_leave",
    "participation_score",
    "homework_status",
    "daily_grade",
    "comment",
    "recorded_at",
  ];

  const body = rows.map((row) =>
    [
      row.studentCode,
      row.studentName,
      row.group,
      row.date,
      row.status,
      row.reason,
      row.lateMinutes,
      row.earlyLeave,
      row.participationScore,
      row.homeworkStatus,
      row.dailyGrade,
      row.comment,
      row.recordedAt,
    ]
      .map(escapeCsv)
      .join(","),
  );

  return [header.join(","), ...body].join("\n");
}

export async function importStudentsCsv(csv: string) {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  if (!headerLine) return { imported: 0 };
  const headers = headerLine.split(",").map((item) => item.trim().toLowerCase());

  return updateStore((store) => {
    let imported = 0;

    lines.forEach((line) => {
      if (!line.trim()) return;
      const columns = line.split(",").map((item) => item.trim());
      const record = Object.fromEntries(headers.map((header, index) => [header, columns[index] ?? ""]));
      if (!record.full_name || !record.group || !record.email || !record.password) return;

      if (store.users.some((user) => user.email.trim().toLowerCase() === record.email.toLowerCase())) return;

      const studentId = randomUUID();
      store.students.unshift({
        id: studentId,
        fullName: record.full_name,
        group: record.group,
        phone: record.phone || "",
        parentPhone: record.parent_phone || "",
        joinedAt: new Date().toISOString(),
        status: "active",
        balance: Number(record.balance || 0),
        notes: record.notes || "",
        grades: [],
        attendance: [],
        payments: [],
      });
      store.users.unshift({
        id: randomUUID(),
        fullName: record.full_name,
        email: record.email.toLowerCase(),
        password: record.password,
        role: "student",
        linkedStudentId: studentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      imported += 1;
    });

    return { imported };
  });
}
