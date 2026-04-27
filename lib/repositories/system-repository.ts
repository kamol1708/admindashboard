import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } from "../auth";
import type { AttendanceReasonModel, AttendanceRecordModel, AttendanceStatusModel, HomeworkStatusModel } from "../models/attendance";
import type { BootcampModel, EnrollmentModel } from "../models/bootcamp";
import type { PersistedStoreModel } from "../models/system";
import type { StudentModel } from "../models/student";
import type { UserModel } from "../models/user";
import type { GroupItem } from "../types";
import { getDb } from "../sqlite";

const dataPath = path.join(process.cwd(), "data", "store.json");

function defaultSettings() {
  return {
    attendanceThresholdPercent: 70,
    consecutiveAbsenceThreshold: 3,
    restrictPastAttendanceEdits: true,
  };
}

function normalizeUsers(users: UserModel[] | undefined) {
  const baseUsers = users ?? [];
  if (baseUsers.some((user) => user.role === "admin")) return baseUsers;

  return [
    {
      id: "admin-001",
      fullName: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: "admin" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    ...baseUsers,
  ];
}

function toBool(value: unknown) {
  return Number(value) === 1;
}

function normalizeStudentStatus(value: unknown): StudentModel["status"] {
  if (value === "warning" || value === "probation" || value === "removed") return value;
  return "active";
}

function attendanceSnapshot(record: AttendanceRecordModel): StudentModel["attendance"][number] {
  return {
    id: record.id,
    date: record.date,
    status: record.status === "absent" ? "absent" : record.lateMinutes > 0 ? "late" : "present",
    lesson: record.lessonTitle,
    topic: record.topic,
    homework: record.dailyGrade,
    comment: record.comment,
    reason: record.reason,
    earlyLeave: record.earlyLeave,
  };
}

function normalizeTelegramMeta(student: StudentModel) {
  return {
    chatId: student.telegram?.chatId,
    username: student.telegram?.username,
    connectedAt: student.telegram?.connectedAt,
    inviteToken: student.telegram?.inviteToken,
    inviteExpiresAt: student.telegram?.inviteExpiresAt,
    inviteSentAt: student.telegram?.inviteSentAt,
    credentialsSentAt: student.telegram?.credentialsSentAt,
  };
}

async function readLegacyStore(): Promise<PersistedStoreModel> {
  const raw = await fs.readFile(dataPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<PersistedStoreModel> & {
    students?: StudentModel[];
    groups?: GroupItem[];
  };

  const students = (parsed.students ?? []) as StudentModel[];
  const users = normalizeUsers(parsed.users);
  const attendanceRecords =
    parsed.attendanceRecords?.length
      ? parsed.attendanceRecords
      : students.flatMap((student) =>
          (student.attendance ?? []).map((entry) => ({
            id: entry.id || randomUUID(),
            studentId: student.id,
            date: entry.date,
            lessonTitle: entry.lesson,
            topic: entry.topic || "",
            status: (entry.status === "absent" ? "absent" : "present") as AttendanceStatusModel,
            reason: "no_reason" as AttendanceReasonModel,
            lateMinutes: entry.status === "late" ? 10 : 0,
            earlyLeave: false,
            participationScore: Math.min(5, Math.max(1, Math.round((entry.homework ?? 0) / 20) || 1)),
            homeworkStatus: ((entry.homework ?? 0) > 0 ? "done" : "not_done") as HomeworkStatusModel,
            dailyGrade: Math.min(100, Math.max(0, entry.homework ?? 0)),
            comment: "",
            recordedAt: new Date(`${entry.date}T08:00:00.000Z`).toISOString(),
            recordedByUserId: "admin-001",
          })),
        );

  return {
    students,
    groups: parsed.groups ?? [],
    bootcamps: parsed.bootcamps ?? [],
    enrollments: parsed.enrollments ?? [],
    users,
    attendanceRecords,
    notifications: parsed.notifications ?? [],
    auditLogs: parsed.auditLogs ?? [],
    settings: parsed.settings ?? defaultSettings(),
  };
}

function ensureAdminAndSettings() {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO users (id, full_name, email, password, role, linked_student_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
  `).run(
    "admin-001",
    ADMIN_NAME,
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    "admin",
    new Date().toISOString(),
    new Date().toISOString(),
  );

  db.prepare(`
    INSERT OR IGNORE INTO system_settings (
      id,
      attendance_threshold_percent,
      consecutive_absence_threshold,
      restrict_past_attendance_edits
    ) VALUES (?, ?, ?, ?)
  `).run(
    "default",
    70,
    3,
    1,
  );
}

function isDatabaseEmpty() {
  const db = getDb();
  const tables = ["students", "groups_table", "bootcamps", "enrollments", "attendance_records", "grades", "payments"];
  let total = 0;

  for (const table of tables) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      total += Number(row.count ?? 0);
    } catch {
      total += 0;
    }
  }

  return total === 0;
}

async function seedDatabaseFromJson() {
  ensureAdminAndSettings();
  if (!isDatabaseEmpty()) return;

  const store = await readLegacyStore();
  await saveStore(store);
}

function mapStoreRows(): PersistedStoreModel {
  ensureAdminAndSettings();
  const db = getDb();

  const users = db.prepare(`
    SELECT id, full_name, email, password, role, linked_student_id, created_at, updated_at
    FROM users
    ORDER BY datetime(created_at) DESC
  `).all() as Array<Record<string, unknown>>;

  const students = db.prepare(`
    SELECT
      id, full_name, group_name, phone, parent_phone, joined_at, status, balance, notes,
      telegram_chat_id, telegram_username, telegram_connected_at, telegram_link_token,
      telegram_link_expires_at, telegram_link_sent_at, telegram_credentials_sent_at
    FROM students
    ORDER BY datetime(joined_at) DESC
  `).all() as Array<Record<string, unknown>>;

  const grades = db.prepare(`
    SELECT id, student_id, subject, score, max_score, exam_date, note
    FROM grades
    ORDER BY exam_date DESC
  `).all() as Array<Record<string, unknown>>;

  const payments = db.prepare(`
    SELECT id, student_id, amount, paid_at, method, status, month, requested_at, confirmed_at, transaction_id, proof_note, reviewed_by_user_id, note
    FROM payments
    ORDER BY paid_at DESC
  `).all() as Array<Record<string, unknown>>;

  const attendanceRecords = db.prepare(`
    SELECT
      id, student_id, date, lesson_title, topic, status, reason, late_minutes,
      early_leave, participation_score, homework_status, daily_grade, comment,
      recorded_at, recorded_by_user_id
    FROM attendance_records
    ORDER BY date DESC, datetime(recorded_at) DESC
  `).all() as Array<Record<string, unknown>>;

  const notifications = db.prepare(`
    SELECT id, student_id, type, title, message, created_at, read
    FROM notifications
    ORDER BY datetime(created_at) DESC
  `).all() as Array<Record<string, unknown>>;

  const auditLogs = db.prepare(`
    SELECT id, entity_type, entity_id, action, actor_user_id, created_at, summary
    FROM audit_logs
    ORDER BY datetime(created_at) DESC
  `).all() as Array<Record<string, unknown>>;

  const groups = db.prepare(`
    SELECT id, name, teacher, schedule, room, monthly_fee
    FROM groups_table
    ORDER BY name ASC
  `).all() as Array<Record<string, unknown>>;

  const bootcamps = db.prepare(`
    SELECT id, name, price
    FROM bootcamps
    ORDER BY name ASC
  `).all() as Array<Record<string, unknown>>;

  const enrollments = db.prepare(`
    SELECT id, student_id, bootcamp_id, payment_amount, payment_status, start_date
    FROM enrollments
    ORDER BY start_date DESC
  `).all() as Array<Record<string, unknown>>;

  const settings = db.prepare(`
    SELECT attendance_threshold_percent, consecutive_absence_threshold, restrict_past_attendance_edits
    FROM system_settings
    WHERE id = ?
  `).get("default") as Record<string, unknown> | undefined;

  const attendanceByStudent = new Map<string, StudentModel["attendance"]>();
  const gradeByStudent = new Map<string, StudentModel["grades"]>();
  const paymentByStudent = new Map<string, StudentModel["payments"]>();

  for (const row of attendanceRecords) {
    const record: AttendanceRecordModel = {
      id: String(row.id),
      studentId: String(row.student_id),
      date: String(row.date),
      lessonTitle: String(row.lesson_title),
      topic: String(row.topic ?? ""),
      status: String(row.status) as AttendanceStatusModel,
      reason: String(row.reason) as AttendanceReasonModel,
      lateMinutes: Number(row.late_minutes),
      earlyLeave: toBool(row.early_leave),
      participationScore: Number(row.participation_score),
      homeworkStatus: String(row.homework_status) as HomeworkStatusModel,
      dailyGrade: Number(row.daily_grade),
      comment: String(row.comment ?? ""),
      recordedAt: String(row.recorded_at),
      recordedByUserId: String(row.recorded_by_user_id),
    };

    const list = attendanceByStudent.get(record.studentId) ?? [];
    list.push(attendanceSnapshot(record));
    attendanceByStudent.set(record.studentId, list);
  }

  for (const row of grades) {
    const list = gradeByStudent.get(String(row.student_id)) ?? [];
    list.push({
      id: String(row.id),
      subject: String(row.subject),
      score: Number(row.score),
      maxScore: Number(row.max_score),
      examDate: String(row.exam_date),
      note: row.note ? String(row.note) : undefined,
    });
    gradeByStudent.set(String(row.student_id), list);
  }

  for (const row of payments) {
    const list = paymentByStudent.get(String(row.student_id)) ?? [];
    list.push({
      id: String(row.id),
      amount: Number(row.amount),
      paidAt: String(row.paid_at),
      method: String(row.method) as "cash" | "card" | "transfer",
      status: (row.status ? String(row.status) : "approved") as "pending" | "approved" | "rejected",
      month: row.month ? String(row.month) : undefined,
      requestedAt: row.requested_at ? String(row.requested_at) : undefined,
      confirmedAt: row.confirmed_at ? String(row.confirmed_at) : undefined,
      transactionId: row.transaction_id ? String(row.transaction_id) : undefined,
      proofNote: row.proof_note ? String(row.proof_note) : undefined,
      reviewedByUserId: row.reviewed_by_user_id ? String(row.reviewed_by_user_id) : undefined,
      note: row.note ? String(row.note) : undefined,
    });
    paymentByStudent.set(String(row.student_id), list);
  }

  return {
    students: students.map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      group: String(row.group_name),
      phone: String(row.phone),
      parentPhone: String(row.parent_phone),
      joinedAt: String(row.joined_at),
      status: normalizeStudentStatus(row.status),
      balance: Number(row.balance),
      notes: String(row.notes ?? ""),
      grades: gradeByStudent.get(String(row.id)) ?? [],
      attendance: attendanceByStudent.get(String(row.id)) ?? [],
      payments: paymentByStudent.get(String(row.id)) ?? [],
      telegram: {
        chatId: row.telegram_chat_id ? String(row.telegram_chat_id) : undefined,
        username: row.telegram_username ? String(row.telegram_username) : undefined,
        connectedAt: row.telegram_connected_at ? String(row.telegram_connected_at) : undefined,
        inviteToken: row.telegram_link_token ? String(row.telegram_link_token) : undefined,
        inviteExpiresAt: row.telegram_link_expires_at ? String(row.telegram_link_expires_at) : undefined,
        inviteSentAt: row.telegram_link_sent_at ? String(row.telegram_link_sent_at) : undefined,
        credentialsSentAt: row.telegram_credentials_sent_at ? String(row.telegram_credentials_sent_at) : undefined,
      },
    })),
    groups: groups.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      teacher: String(row.teacher),
      schedule: String(row.schedule),
      room: String(row.room),
      monthlyFee: Number(row.monthly_fee),
    })),
    bootcamps: bootcamps.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      price: Number(row.price),
    })),
    enrollments: enrollments.map((row) => ({
      id: String(row.id),
      studentId: String(row.student_id),
      bootcampId: String(row.bootcamp_id),
      paymentAmount: Number(row.payment_amount),
      paymentStatus: String(row.payment_status) as EnrollmentModel["paymentStatus"],
      startDate: String(row.start_date),
    })),
    users: users.map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name),
      email: String(row.email),
      password: String(row.password),
      role: String(row.role) as UserModel["role"],
      linkedStudentId: row.linked_student_id ? String(row.linked_student_id) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
    attendanceRecords: attendanceRecords.map((row) => ({
      id: String(row.id),
      studentId: String(row.student_id),
      date: String(row.date),
      lessonTitle: String(row.lesson_title),
      topic: String(row.topic ?? ""),
      status: String(row.status) as AttendanceStatusModel,
      reason: String(row.reason) as AttendanceReasonModel,
      lateMinutes: Number(row.late_minutes),
      earlyLeave: toBool(row.early_leave),
      participationScore: Number(row.participation_score),
      homeworkStatus: String(row.homework_status) as HomeworkStatusModel,
      dailyGrade: Number(row.daily_grade),
      comment: String(row.comment ?? ""),
      recordedAt: String(row.recorded_at),
      recordedByUserId: String(row.recorded_by_user_id),
    })),
    notifications: notifications.map((row) => ({
      id: String(row.id),
      studentId: String(row.student_id),
      type: String(row.type) as PersistedStoreModel["notifications"][number]["type"],
      title: String(row.title),
      message: String(row.message),
      createdAt: String(row.created_at),
      read: toBool(row.read),
    })),
    auditLogs: auditLogs.map((row) => ({
      id: String(row.id),
      entityType: String(row.entity_type) as PersistedStoreModel["auditLogs"][number]["entityType"],
      entityId: String(row.entity_id),
      action: String(row.action) as PersistedStoreModel["auditLogs"][number]["action"],
      actorUserId: row.actor_user_id ? String(row.actor_user_id) : undefined,
      createdAt: String(row.created_at),
      summary: String(row.summary),
    })),
    settings: {
      attendanceThresholdPercent: Number(settings?.attendance_threshold_percent ?? 70),
      consecutiveAbsenceThreshold: Number(settings?.consecutive_absence_threshold ?? 3),
      restrictPastAttendanceEdits: toBool(settings?.restrict_past_attendance_edits ?? 1),
    },
  };
}

export async function loadStore(): Promise<PersistedStoreModel> {
  await seedDatabaseFromJson();
  return mapStoreRows();
}

export async function saveStore(store: PersistedStoreModel) {
  const db = getDb();
  const normalizedUsers = normalizeUsers(store.users);

  db.exec("BEGIN TRANSACTION");
  try {
    db.exec(`
      DELETE FROM notifications;
      DELETE FROM audit_logs;
      DELETE FROM attendance_records;
      DELETE FROM grades;
      DELETE FROM payments;
      DELETE FROM users;
      DELETE FROM groups_table;
      DELETE FROM enrollments;
      DELETE FROM bootcamps;
      DELETE FROM students;
      DELETE FROM system_settings;
    `);

    const insertStudent = db.prepare(`
      INSERT INTO students (
        id, full_name, group_name, phone, parent_phone, joined_at, status, balance, notes,
        telegram_chat_id, telegram_username, telegram_connected_at, telegram_link_token,
        telegram_link_expires_at, telegram_link_sent_at, telegram_credentials_sent_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertGroup = db.prepare(`
      INSERT INTO groups_table (id, name, teacher, schedule, room, monthly_fee)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertBootcamp = db.prepare(`
      INSERT INTO bootcamps (id, name, price)
      VALUES (?, ?, ?)
    `);
    const insertEnrollment = db.prepare(`
      INSERT INTO enrollments (id, student_id, bootcamp_id, payment_amount, payment_status, start_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertUser = db.prepare(`
      INSERT INTO users (id, full_name, email, password, role, linked_student_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertGrade = db.prepare(`
      INSERT INTO grades (id, student_id, subject, score, max_score, exam_date, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPayment = db.prepare(`
      INSERT INTO payments (id, student_id, amount, paid_at, method, status, month, requested_at, confirmed_at, transaction_id, proof_note, reviewed_by_user_id, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAttendance = db.prepare(`
      INSERT INTO attendance_records (
        id, student_id, date, lesson_title, topic, status, reason, late_minutes, early_leave,
        participation_score, homework_status, daily_grade, comment, recorded_at, recorded_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertNotification = db.prepare(`
      INSERT INTO notifications (id, student_id, type, title, message, created_at, read)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertSettings = db.prepare(`
      INSERT INTO system_settings (
        id,
        attendance_threshold_percent,
        consecutive_absence_threshold,
        restrict_past_attendance_edits
      ) VALUES (?, ?, ?, ?)
    `);

    for (const student of store.students) {
      insertStudent.run(
        student.id,
        student.fullName,
        student.group,
        student.phone,
        student.parentPhone,
        student.joinedAt,
        student.status,
        student.balance,
        student.notes,
        normalizeTelegramMeta(student).chatId ?? null,
        normalizeTelegramMeta(student).username ?? null,
        normalizeTelegramMeta(student).connectedAt ?? null,
        normalizeTelegramMeta(student).inviteToken ?? null,
        normalizeTelegramMeta(student).inviteExpiresAt ?? null,
        normalizeTelegramMeta(student).inviteSentAt ?? null,
        normalizeTelegramMeta(student).credentialsSentAt ?? null,
      );
    }

    for (const group of store.groups) {
      insertGroup.run(group.id, group.name, group.teacher, group.schedule, group.room, group.monthlyFee);
    }

    for (const bootcamp of store.bootcamps) {
      insertBootcamp.run(bootcamp.id, bootcamp.name, bootcamp.price);
    }

    for (const user of normalizedUsers) {
      insertUser.run(
        user.id,
        user.fullName,
        user.email.toLowerCase(),
        user.password,
        user.role,
        user.linkedStudentId ?? null,
        user.createdAt ?? new Date().toISOString(),
        user.updatedAt ?? new Date().toISOString(),
      );
    }

    for (const enrollment of store.enrollments) {
      insertEnrollment.run(
        enrollment.id,
        enrollment.studentId,
        enrollment.bootcampId,
        enrollment.paymentAmount,
        enrollment.paymentStatus,
        enrollment.startDate,
      );
    }

    for (const student of store.students) {
      for (const grade of student.grades) {
        insertGrade.run(grade.id, student.id, grade.subject, grade.score, grade.maxScore, grade.examDate, grade.note ?? null);
      }

      for (const payment of student.payments) {
        insertPayment.run(
          payment.id,
          student.id,
          payment.amount,
          payment.paidAt,
          payment.method,
          payment.status ?? "approved",
          payment.month ?? null,
          payment.requestedAt ?? null,
          payment.confirmedAt ?? null,
          payment.transactionId ?? null,
          payment.proofNote ?? null,
          payment.reviewedByUserId ?? null,
          payment.note ?? null,
        );
      }
    }

    for (const record of store.attendanceRecords) {
      insertAttendance.run(
        record.id,
        record.studentId,
        record.date,
        record.lessonTitle,
        record.topic,
        record.status,
        record.reason,
        record.lateMinutes,
        record.earlyLeave ? 1 : 0,
        record.participationScore,
        record.homeworkStatus,
        record.dailyGrade,
        record.comment,
        record.recordedAt,
        record.recordedByUserId,
      );
    }

    for (const notification of store.notifications) {
      insertNotification.run(
        notification.id,
        notification.studentId,
        notification.type,
        notification.title,
        notification.message,
        notification.createdAt,
        notification.read ? 1 : 0,
      );
    }

    for (const log of store.auditLogs) {
      insertAudit.run(
        log.id,
        log.entityType,
        log.entityId,
        log.action,
        log.actorUserId ?? null,
        log.createdAt,
        log.summary,
      );
    }

    insertSettings.run(
      "default",
      store.settings.attendanceThresholdPercent,
      store.settings.consecutiveAbsenceThreshold,
      store.settings.restrictPastAttendanceEdits ? 1 : 0,
    );

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function updateStore<T>(mutator: (store: PersistedStoreModel) => T | Promise<T>) {
  const store = await loadStore();
  const result = await mutator(store);
  await saveStore(store);
  return result;
}
