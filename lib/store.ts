import { randomUUID } from "crypto";
import type {
  AppUser,
  Bootcamp,
  AttendanceEntry,
  AttendanceState,
  DashboardMetrics,
  DashboardResponse,
  Enrollment,
  GradeEntry,
  GroupItem,
  PaymentEntry,
  PaymentMethod,
  PaymentRequestStatus,
  Student,
  StudentBillingSummary,
  StudentInsight,
  StudentStatus,
} from "@/lib/types";
import { loadStore, updateStore } from "@/lib/repositories/system-repository";
import { createStudentRecord, createTeacherUser } from "@/lib/services/student-service";
import { authenticateUser } from "@/lib/services/auth-service";
import { computeStudentAttendanceStats } from "@/lib/services/analytics-service";
import { buildBillingSummaries } from "@/lib/services/billing-service";
import { sendTelegramLessonNotification } from "@/lib/services/telegram-service";
import { getDb } from "@/lib/sqlite";

function normalizeAttendanceState(entry: { status: "present" | "late" | "absent" }): AttendanceState {
  return entry.status;
}

function toLegacyAttendance(entry: Student["attendance"][number]): AttendanceEntry {
  return {
    id: entry.id,
    date: entry.date,
    status: normalizeAttendanceState(entry),
    lesson: entry.lesson,
    topic: entry.topic ?? "",
    homework: entry.homework ?? 0,
  };
}

function toLegacyStudent(student: Student): Student {
  return {
    ...student,
    attendance: student.attendance.map(toLegacyAttendance),
    grades: student.grades.map((grade) => ({ ...grade })),
    payments: student.payments.map((payment) => ({ ...payment })),
  };
}

function averageGrades(grades: GradeEntry[]) {
  if (!grades.length) return 0;
  const total = grades.reduce((sum, grade) => sum + (grade.score / grade.maxScore) * 100, 0);
  return Math.round((total / grades.length) * 10) / 10;
}

function toPublicUser(user: Awaited<ReturnType<typeof loadStore>>["users"][number]): AppUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    linkedStudentId: user.linkedStudentId,
  } satisfies AppUser;
}

function deriveStatus(student: Student, attendancePercentage: number): StudentStatus {
  if (!student.attendance.length && !student.grades.length) return student.status ?? "active";

  if (student.status === "removed") return "removed";

  const avgScore = averageGrades(student.grades);
  if (avgScore < 50 || attendancePercentage < 55) return "removed";
  if (avgScore < 65 || attendancePercentage < 70) return "probation";
  if (avgScore < 75 || attendancePercentage < 80) return "warning";
  return "active";
}

function latestLesson(attendance: AttendanceEntry[]) {
  return [...attendance].sort((a, b) => b.date.localeCompare(a.date))[0]?.lesson ?? "No lessons yet";
}

function riskLabel(status: StudentStatus, score: number, rate: number) {
  if (status === "removed") return "Chetlashtirilgan";
  if (status === "probation") return `Kritik: ${score}% / ${rate}%`;
  if (status === "warning") return `Ogohlantirish: ${score}% / ${rate}%`;
  return "Barqaror";
}

function buildInsights(students: Student[], storeAttendanceRecords: Awaited<ReturnType<typeof loadStore>>["attendanceRecords"]) {
  return students.map((student) => {
    const stats = computeStudentAttendanceStats(student, storeAttendanceRecords);
    const score = averageGrades(student.grades);
    const status = deriveStatus(student, stats.attendancePercentage);

    return {
      id: student.id,
      fullName: student.fullName,
      group: student.group,
      status,
      averageScore: score,
      attendanceRate: stats.attendancePercentage,
      latestLesson: latestLesson(student.attendance),
      riskLabel: riskLabel(status, score, stats.attendancePercentage),
    } satisfies StudentInsight;
  });
}

function buildMetrics(insights: StudentInsight[]): DashboardMetrics {
  const totalStudents = insights.length;
  const averageScore = totalStudents
    ? Math.round((insights.reduce((sum, item) => sum + item.averageScore, 0) / totalStudents) * 10) / 10
    : 0;
  const overallAttendance = totalStudents
    ? Math.round((insights.reduce((sum, item) => sum + item.attendanceRate, 0) / totalStudents) * 10) / 10
    : 0;

  return {
    totalStudents,
    activeStudents: insights.filter((student) => student.status === "active").length,
    warnings: insights.filter((student) => student.status === "warning" || student.status === "probation").length,
    removedStudents: insights.filter((student) => student.status === "removed").length,
    averageScore,
    attendanceRate: overallAttendance,
  };
}

export async function getDashboardData(): Promise<DashboardResponse> {
  const store = await loadStore();
  const students = store.students.map(toLegacyStudent);
  const insights = buildInsights(students, store.attendanceRecords);
  const billing = buildBillingSummaries(students, store.groups) satisfies StudentBillingSummary[];

  return {
    students: students.map((student) => ({
      ...student,
      status: student.status ?? "active",
    })),
    insights,
    metrics: buildMetrics(insights),
    alerts: store.notifications.slice(0, 5).map((notification) => `${notification.title}: ${notification.message}`),
    groups: store.groups.map((group) => ({ ...group })),
    bootcamps: store.bootcamps.map((bootcamp) => ({ ...bootcamp })) satisfies Bootcamp[],
    enrollments: store.enrollments.map((enrollment) => {
      const bootcamp = store.bootcamps.find((item) => item.id === enrollment.bootcampId);
      return {
        ...enrollment,
        bootcampName: bootcamp?.name,
        bootcampPrice: bootcamp?.price,
        remainingBalance: Math.max((bootcamp?.price ?? 0) - enrollment.paymentAmount, 0),
      };
    }) satisfies Enrollment[],
    billing,
    users: store.users.map(toPublicUser),
  };
}

export async function createStudent(payload: {
  fullName: string;
  group: string;
  phone: string;
  parentPhone: string;
  balance: number;
  notes?: string;
  email?: string;
  password?: string;
}) {
  const result = await createStudentRecord({
    fullName: payload.fullName,
    group: payload.group,
    phone: payload.phone,
    parentPhone: payload.parentPhone,
    balance: payload.balance,
    notes: payload.notes,
    email: payload.email?.trim().toLowerCase() || `${randomUUID()}@placeholder.local`,
    password: payload.password?.trim() || randomUUID(),
  });

  if ("error" in result) {
    throw new Error(result.error);
  }

  return result.student;
}

export async function createTeacherAccount(payload: {
  fullName: string;
  email: string;
  password: string;
}) {
  const result = await createTeacherUser(payload);
  if ("error" in result) {
    throw new Error(result.error);
  }
  return {
    id: result.user.id,
    fullName: result.user.fullName,
    email: result.user.email,
    role: result.user.role,
  } satisfies AppUser;
}

export async function findUserByCredentials(email: string, password: string) {
  const user = await authenticateUser(email, password);
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    linkedStudentId: user.linkedStudentId,
  } satisfies AppUser;
}

export async function addGrade(
  studentId: string,
  payload: { subject: string; score: number; maxScore: number; examDate: string; note?: string },
) {
  const result = await updateStore((store) => {
    const student = store.students.find((item) => item.id === studentId);
    if (!student) return null;

    student.grades.unshift({
      id: randomUUID(),
      subject: payload.subject.trim(),
      score: Number(payload.score),
      maxScore: Number(payload.maxScore || 100),
      examDate: payload.examDate,
      note: payload.note?.trim(),
    });

    store.auditLogs.unshift({
      id: randomUUID(),
      entityType: "student",
      entityId: student.id,
      action: "update",
      createdAt: new Date().toISOString(),
      summary: `${student.fullName} uchun baho qo'shildi.`,
    });

    return student;
  });

  if (result?.telegram?.chatId) {
    void sendTelegramLessonNotification({
      studentId,
      lessonTitle: payload.subject.trim(),
      date: payload.examDate,
      dailyGrade: Number(payload.score),
      attendanceLabel: "Yangi baho qo'yildi",
    }).catch(() => {});
  }

  return result ? toLegacyStudent(result) : null;
}

export async function addAttendance(
  studentId: string,
  payload: { date: string; status: AttendanceState; lesson: string; topic?: string; homework?: number },
) {
  const result = await updateStore((store) => {
    const student = store.students.find((item) => item.id === studentId);
    if (!student) return { error: "not_found" as const };

    const sameLesson = store.attendanceRecords.some(
      (entry) =>
        entry.studentId === studentId &&
        entry.date === payload.date &&
        entry.lessonTitle.trim().toLowerCase() === payload.lesson.trim().toLowerCase(),
    );
    if (sameLesson) return { error: "attendance_locked" as const };

    const id = randomUUID();
    student.attendance.unshift({
      id,
      date: payload.date,
      status: payload.status,
      lesson: payload.lesson,
      topic: payload.topic ?? "",
      homework: payload.homework ?? 0,
    });
    store.attendanceRecords.unshift({
      id,
      studentId,
      date: payload.date,
      lessonTitle: payload.lesson,
      topic: payload.topic ?? "",
      status: payload.status === "absent" ? "absent" : "present",
      reason: payload.status === "absent" ? "no_reason" : "no_reason",
      lateMinutes: payload.status === "late" ? 10 : 0,
      earlyLeave: false,
      participationScore: 3,
      homeworkStatus: (payload.homework ?? 0) > 0 ? "done" : "not_done",
      dailyGrade: Number(payload.homework ?? 0),
      comment: "",
      recordedAt: new Date().toISOString(),
      recordedByUserId: "admin-001",
    });
    return { student };
  });

  if ("error" in result) return result;
  if (result.student.telegram?.chatId) {
    void sendTelegramLessonNotification({
      studentId,
      lessonTitle: payload.lesson.trim(),
      date: payload.date,
      dailyGrade: typeof payload.homework === "number" ? Number(payload.homework) : undefined,
      attendanceLabel: payload.status === "present" ? "Keldi" : payload.status === "late" ? "Kechikdi" : "Kelmadi",
    }).catch(() => {});
  }
  return { student: toLegacyStudent(result.student) };
}

export async function updateStudentStatus(
  studentId: string,
  payload: { status?: StudentStatus; notes?: string; balance?: number },
) {
  const result = await updateStore((store) => {
    const student = store.students.find((item) => item.id === studentId);
    if (!student) return null;

    if (typeof payload.notes === "string") student.notes = payload.notes;
    if (typeof payload.balance === "number") student.balance = payload.balance;
    if (payload.status) student.status = payload.status;

    store.auditLogs.unshift({
      id: randomUUID(),
      entityType: "student",
      entityId: student.id,
      action: "update",
      createdAt: new Date().toISOString(),
      summary: `${student.fullName} statusi yangilandi.`,
    });

    return student;
  });

  return result ? toLegacyStudent(result) : null;
}

export async function addPayment(
  studentId: string,
  payload: {
    amount: number;
    paidAt: string;
    method: PaymentMethod;
    note?: string;
    month?: string;
    transactionId?: string;
    proofNote?: string;
    actorUserId?: string;
  },
) {
  const store = await loadStore();
  const student = store.students.find((item) => item.id === studentId);
  if (!student) return null;

  const paymentId = randomUUID();
  const amount = Number(payload.amount);
  const note = payload.note?.trim() || null;
  const proofNote = payload.proofNote?.trim() || null;
  const transactionId = payload.transactionId?.trim() || null;
  const month = payload.month?.trim() || payload.paidAt.slice(0, 7);
  const confirmedAt = new Date().toISOString();
  const actorUserId = payload.actorUserId ?? "admin-001";
  const nextBalance = student.balance + amount;
  const db = getDb();

  db.prepare(`
    INSERT INTO payments (id, student_id, amount, paid_at, method, status, month, requested_at, confirmed_at, transaction_id, proof_note, reviewed_by_user_id, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(paymentId, studentId, amount, payload.paidAt, payload.method, "approved", month, confirmedAt, confirmedAt, transactionId, proofNote, actorUserId, note);

  db.prepare(`
    UPDATE students
    SET balance = ?
    WHERE id = ?
  `).run(nextBalance, studentId);

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    "student",
    studentId,
    "update",
    actorUserId,
    new Date().toISOString(),
    `${student.fullName} uchun to'lov qo'shildi.`,
  );

  return toLegacyStudent({
    ...student,
    balance: nextBalance,
    payments: [
      {
        id: paymentId,
        amount,
        paidAt: payload.paidAt,
        method: payload.method,
        status: "approved",
        month,
        requestedAt: confirmedAt,
        confirmedAt,
        transactionId: transactionId ?? undefined,
        proofNote: proofNote ?? undefined,
        reviewedByUserId: actorUserId,
        note: payload.note?.trim(),
      },
      ...student.payments,
    ],
  });
}

export async function requestStudentPayment(
  studentId: string,
  payload: {
    amount: number;
    paidAt: string;
    method: PaymentMethod;
    note?: string;
    month: string;
    transactionId?: string;
    proofNote?: string;
  },
) {
  const store = await loadStore();
  const student = store.students.find((item) => item.id === studentId);
  if (!student) return null;

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("To'lov summasi noto'g'ri.");
  }

  const paymentId = randomUUID();
  const requestedAt = new Date().toISOString();
  const note = payload.note?.trim() || null;
  const transactionId = payload.transactionId?.trim() || null;
  const proofNote = payload.proofNote?.trim() || null;
  const db = getDb();

  db.prepare(`
    INSERT INTO payments (id, student_id, amount, paid_at, method, status, month, requested_at, transaction_id, proof_note, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(paymentId, studentId, amount, payload.paidAt, payload.method, "pending", payload.month, requestedAt, transactionId, proofNote, note);

  db.prepare(`
    INSERT INTO notifications (id, student_id, type, title, message, created_at, read)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    studentId,
    "payment_request",
    "To'lov so'rovi yuborildi",
    `${student.fullName} uchun ${amount} so'mlik to'lov so'rovi yuborildi.`,
    requestedAt,
    0,
  );

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    "payment",
    paymentId,
    "request",
    studentId,
    requestedAt,
    `${student.fullName} to'lov tasdiqlash so'rovi yubordi.`,
  );

  return toLegacyStudent({
    ...student,
    payments: [
      {
        id: paymentId,
        amount,
        paidAt: payload.paidAt,
        method: payload.method,
        status: "pending",
        month: payload.month,
        requestedAt,
        transactionId: transactionId ?? undefined,
        proofNote: proofNote ?? undefined,
        note: payload.note?.trim(),
      },
      ...student.payments,
    ],
  });
}

export async function reviewPaymentRequest(
  studentId: string,
  paymentId: string,
  nextStatus: Extract<PaymentRequestStatus, "approved" | "rejected">,
  reviewerUserId: string,
  reviewNote?: string,
) {
  const store = await loadStore();
  const student = store.students.find((item) => item.id === studentId);
  if (!student) return null;

  const payment = student.payments.find((item) => item.id === paymentId);
  if (!payment) return null;
  if ((payment.status ?? "approved") !== "pending") {
    throw new Error("Faqat pending to'lovni tasdiqlash yoki rad etish mumkin.");
  }

  const db = getDb();
  const reviewedAt = new Date().toISOString();
  const normalizedReviewNote = reviewNote?.trim() || "";
  const mergedNote = [payment.note, normalizedReviewNote].filter(Boolean).join(" | ");
  const nextBalance = nextStatus === "approved" ? student.balance + payment.amount : student.balance;

  db.prepare(`
    UPDATE payments
    SET status = ?, confirmed_at = ?, reviewed_by_user_id = ?, note = ?
    WHERE id = ? AND student_id = ?
  `).run(nextStatus, reviewedAt, reviewerUserId, mergedNote || null, paymentId, studentId);

  if (nextStatus === "approved") {
    db.prepare(`
      UPDATE students
      SET balance = ?
      WHERE id = ?
    `).run(nextBalance, studentId);
  }

  db.prepare(`
    INSERT INTO notifications (id, student_id, type, title, message, created_at, read)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    studentId,
    nextStatus === "approved" ? "payment_approved" : "payment_rejected",
    nextStatus === "approved" ? "To'lov tasdiqlandi" : "To'lov rad etildi",
    nextStatus === "approved"
      ? `${payment.amount} so'mlik to'lovingiz tasdiqlandi.`
      : `${payment.amount} so'mlik to'lovingiz rad etildi.${normalizedReviewNote ? ` ${normalizedReviewNote}` : ""}`,
    reviewedAt,
    0,
  );

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    "payment",
    paymentId,
    nextStatus,
    reviewerUserId,
    reviewedAt,
    `${student.fullName} uchun to'lov ${nextStatus === "approved" ? "tasdiqlandi" : "rad etildi"}.`,
  );

  return toLegacyStudent({
    ...student,
    balance: nextBalance,
    payments: student.payments.map((item) =>
      item.id === paymentId
        ? {
            ...item,
            status: nextStatus,
            confirmedAt: reviewedAt,
            reviewedByUserId: reviewerUserId,
            note: mergedNote || undefined,
          }
        : item,
    ),
  });
}

export async function createGroup(payload: {
  name: string;
  teacher: string;
  schedule: string;
  room: string;
  monthlyFee: number;
}) {
  return updateStore((store) => {
    const group: GroupItem = {
      id: randomUUID(),
      name: payload.name.trim(),
      teacher: payload.teacher.trim(),
      schedule: payload.schedule.trim(),
      room: payload.room.trim(),
      monthlyFee: Number(payload.monthlyFee ?? 0),
    };

    store.groups.unshift(group);
    store.auditLogs.unshift({
      id: randomUUID(),
      entityType: "group",
      entityId: group.id,
      action: "create",
      createdAt: new Date().toISOString(),
      summary: `${group.name} guruhi yaratildi.`,
    });

    return group;
  });
}
