import type { SessionPayload } from "@/lib/auth";
import type { UserModel, UserRoleModel } from "@/lib/models/user";
import { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } from "@/lib/auth";
import { loadStore } from "@/lib/repositories/system-repository";
import { getDb } from "@/lib/sqlite";
import { hashPassword, isPasswordHashed, verifyPassword } from "@/lib/services/password-service";

function normalizeTeacherIdentity(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function teacherOwnsGroup(
  groupTeacher: string | undefined | null,
  teacher: { name?: string | null; email?: string | null },
) {
  const normalizedGroupTeacher = normalizeTeacherIdentity(groupTeacher);
  if (!normalizedGroupTeacher) return false;

  const candidates = new Set(
    [teacher.name, teacher.email]
      .map(normalizeTeacherIdentity)
      .filter(Boolean),
  );

  return candidates.has(normalizedGroupTeacher);
}

export async function authenticateUser(email: string, password: string): Promise<UserModel | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (!normalizedEmail || !normalizedPassword) return null;

  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT id, full_name, email, password, role, linked_student_id, created_at, updated_at
      FROM users
      WHERE lower(trim(email)) = ?
      LIMIT 1
    `).get(normalizedEmail) as
      | {
          id: string;
          full_name: string;
          email: string;
          password: string;
          role: UserRoleModel;
          linked_student_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        }
      | undefined;

    if (row && verifyPassword(normalizedPassword, row.password)) {
      if (!isPasswordHashed(row.password)) {
        const nextPassword = hashPassword(normalizedPassword);
        db.prepare(`
          UPDATE users
          SET password = ?, updated_at = ?
          WHERE id = ?
        `).run(nextPassword, new Date().toISOString(), row.id);
        row.password = nextPassword;
      }

      return {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        password: row.password,
        role: row.role,
        linkedStudentId: row.linked_student_id ?? undefined,
        createdAt: row.created_at ?? undefined,
        updatedAt: row.updated_at ?? undefined,
      };
    }
  } catch {
    // Fallback below keeps login available even if store loading is unstable.
  }

  try {
    const store = await loadStore();
    const matched =
      store.users.find((user) => user.email.trim().toLowerCase() === normalizedEmail && verifyPassword(normalizedPassword, user.password)) ?? null;
    if (matched) return matched;
  } catch {
    // Fallback to hardcoded admin demo below.
  }

  if (normalizedEmail === ADMIN_EMAIL.toLowerCase() && normalizedPassword === ADMIN_PASSWORD) {
    return {
      id: "admin-001",
      fullName: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
}

export async function changeOwnPassword(session: SessionPayload, currentPassword: string, nextPassword: string) {
  const normalizedCurrent = currentPassword.trim();
  const normalizedNext = nextPassword.trim();

  if (!normalizedCurrent || !normalizedNext) {
    return { error: "Joriy va yangi parol kiritilishi shart." };
  }

  if (normalizedNext.length < 6) {
    return { error: "Yangi parol kamida 6 belgidan iborat bo'lishi kerak." };
  }

  const user = await authenticateUser(session.email, normalizedCurrent);
  if (!user || user.id !== session.id) {
    return { error: "Joriy parol noto'g'ri." };
  }

  const db = getDb();
  db.prepare(`
    UPDATE users
    SET password = ?, updated_at = ?
    WHERE id = ?
  `).run(hashPassword(normalizedNext), new Date().toISOString(), session.id);

  return { ok: true as const };
}

export function toSessionPayload(user: UserModel): SessionPayload {
  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    linkedStudentId: user.linkedStudentId,
  };
}

export function requireRole(session: SessionPayload | null, roles: UserRoleModel[]) {
  if (!session) {
    return { ok: false as const, status: 401, error: "Autentifikatsiya talab qilinadi." };
  }

  if (!roles.includes(session.role)) {
    return { ok: false as const, status: 403, error: "Bu amal uchun ruxsat yo'q." };
  }

  return { ok: true as const };
}

export function canAccessStudent(session: SessionPayload | null, studentId: string) {
  if (!session) return false;
  if (session.role === "admin" || session.role === "teacher") return true;
  return session.linkedStudentId === studentId;
}

export async function canTeacherManageStudent(session: SessionPayload | null, studentId: string) {
  if (!session) return false;
  if (session.role === "admin") return true;
  if (session.role !== "teacher") return false;

  const store = await loadStore();
  const student = store.students.find((item) => item.id === studentId);
  if (!student) return false;

  return store.groups.some(
    (group) =>
      group.name === student.group &&
      teacherOwnsGroup(group.teacher, {
        name: session.name,
        email: session.email,
      }),
  );
}
