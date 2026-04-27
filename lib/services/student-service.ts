import { randomUUID } from "crypto";
import type { StudentModel } from "@/lib/models/student";
import type { UserModel } from "@/lib/models/user";
import { updateStore, loadStore } from "@/lib/repositories/system-repository";
import { getDb } from "@/lib/sqlite";
import { hashPassword } from "@/lib/services/password-service";

export interface CreateStudentInput {
  fullName: string;
  group: string;
  phone: string;
  parentPhone: string;
  balance?: number;
  notes?: string;
  email: string;
  password: string;
}

export interface UpdateStudentInput {
  fullName?: string;
  group?: string;
  phone?: string;
  parentPhone?: string;
  balance?: number;
  notes?: string;
  status?: StudentModel["status"];
}

function validateStudentInput(payload: CreateStudentInput | UpdateStudentInput) {
  if ("fullName" in payload && payload.fullName !== undefined && !payload.fullName.trim()) return "F.I.Sh majburiy.";
  if ("group" in payload && payload.group !== undefined && !payload.group.trim()) return "Guruh majburiy.";
  return null;
}

export async function listStudents() {
  const store = await loadStore();
  return store.students;
}

export async function getStudentById(studentId: string) {
  const store = await loadStore();
  return store.students.find((student) => student.id === studentId) ?? null;
}

export async function createStudentRecord(input: CreateStudentInput) {
  const validationError = validateStudentInput(input);
  if (validationError) {
    return { error: validationError };
  }

  const store = await loadStore();
  const emailExists = store.users.some((user) => user.email.trim().toLowerCase() === input.email.trim().toLowerCase());
  if (emailExists) {
    return { error: "Bu login allaqachon mavjud." };
  }

  const student: StudentModel = {
    id: randomUUID(),
    fullName: input.fullName.trim(),
    group: input.group.trim(),
    phone: input.phone.trim(),
    parentPhone: input.parentPhone.trim(),
    joinedAt: new Date().toISOString(),
    status: "active",
    balance: Number(input.balance ?? 0),
    notes: input.notes?.trim() ?? "",
    grades: [],
    attendance: [],
    payments: [],
    telegram: {},
  };

  const user: UserModel = {
    id: randomUUID(),
    fullName: student.fullName,
    email: input.email.trim().toLowerCase(),
    password: hashPassword(input.password.trim()),
    role: "student",
    linkedStudentId: student.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const createdAt = user.createdAt ?? new Date().toISOString();
  const updatedAt = user.updatedAt ?? createdAt;

  const db = getDb();
  db.prepare(`
    INSERT INTO students (
      id, full_name, group_name, phone, parent_phone, joined_at, status, balance, notes,
      telegram_chat_id, telegram_username, telegram_connected_at, telegram_link_token,
      telegram_link_expires_at, telegram_link_sent_at, telegram_credentials_sent_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    student.id,
    student.fullName,
    student.group,
    student.phone,
    student.parentPhone,
    student.joinedAt,
    student.status,
    student.balance,
    student.notes,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  );

  db.prepare(`
    INSERT INTO users (id, full_name, email, password, role, linked_student_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.fullName,
    user.email,
    user.password,
    user.role,
    user.linkedStudentId ?? null,
    createdAt,
    updatedAt,
  );

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    "student",
    student.id,
    "create",
    "admin-001",
    new Date().toISOString(),
    `${student.fullName} student yaratildi.`,
  );

  return { student, user };
}

export async function updateStudentRecord(studentId: string, input: UpdateStudentInput) {
  const validationError = validateStudentInput(input);
  if (validationError) {
    return { error: validationError };
  }

  return updateStore((store) => {
    const student = store.students.find((item) => item.id === studentId);
    if (!student) return { error: "Talaba topilmadi." };

    if (input.fullName !== undefined) student.fullName = input.fullName.trim();
    if (input.group !== undefined) student.group = input.group.trim();
    if (input.phone !== undefined) student.phone = input.phone.trim();
    if (input.parentPhone !== undefined) student.parentPhone = input.parentPhone.trim();
    if (input.notes !== undefined) student.notes = input.notes.trim();
    if (input.balance !== undefined) student.balance = Number(input.balance);
    if (input.status !== undefined) student.status = input.status;

    const linkedUser = store.users.find((user) => user.linkedStudentId === student.id);
    if (linkedUser) {
      linkedUser.fullName = student.fullName;
      linkedUser.updatedAt = new Date().toISOString();
    }

    return { student };
  });
}

export async function deleteStudentRecord(studentId: string) {
  return updateStore((store) => {
    const studentIndex = store.students.findIndex((item) => item.id === studentId);
    if (studentIndex === -1) return { error: "Talaba topilmadi." };

    const [student] = store.students.splice(studentIndex, 1);
    store.users = store.users.filter((user) => user.linkedStudentId !== studentId);
    store.attendanceRecords = store.attendanceRecords.filter((record) => record.studentId !== studentId);
    store.notifications = store.notifications.filter((notification) => notification.studentId !== studentId);
    store.enrollments = store.enrollments.filter((enrollment) => enrollment.studentId !== studentId);

    return { student };
  });
}

export async function createTeacherUser(input: { fullName: string; email: string; password: string }) {
  const store = await loadStore();
  const exists = store.users.some((user) => user.email.trim().toLowerCase() === input.email.trim().toLowerCase());
  if (exists) return { error: "Bu login allaqachon mavjud." };

  const user: UserModel = {
    id: randomUUID(),
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    password: hashPassword(input.password.trim()),
    role: "teacher",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const createdAt = user.createdAt ?? new Date().toISOString();
  const updatedAt = user.updatedAt ?? createdAt;

  const db = getDb();
  db.prepare(`
    INSERT INTO users (id, full_name, email, password, role, linked_student_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.fullName,
    user.email,
    user.password,
    user.role,
    null,
    createdAt,
    updatedAt,
  );

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    "user",
    user.id,
    "create",
    "admin-001",
    new Date().toISOString(),
    `${user.fullName} teacher yaratildi.`,
  );

  return { user };
}
