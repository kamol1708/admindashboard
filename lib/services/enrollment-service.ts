import { randomUUID } from "crypto";
import type { Enrollment, EnrollmentPaymentStatus } from "@/lib/types";
import type { EnrollmentModel } from "@/lib/models/bootcamp";
import { loadStore } from "@/lib/repositories/system-repository";
import { getDb } from "@/lib/sqlite";

export interface CreateEnrollmentInput {
  studentId: string;
  bootcampId: string;
  paymentAmount: number;
  paymentStatus: EnrollmentPaymentStatus;
  startDate: string;
}

export interface UpdateEnrollmentInput {
  paymentAmount?: number;
  paymentStatus?: EnrollmentPaymentStatus;
  startDate?: string;
}

function calculateRemaining(price: number, paymentAmount: number) {
  return Math.max(price - paymentAmount, 0);
}

function validateEnrollmentInput(input: CreateEnrollmentInput) {
  if (!input.studentId || !input.bootcampId) return "Student va bootcamp majburiy.";
  if (!input.startDate) return "Boshlanish sanasi majburiy.";
  if (!Number.isFinite(input.paymentAmount) || input.paymentAmount < 0) return "To'lov summasi noto'g'ri.";
  if (!["paid", "unpaid", "partial"].includes(input.paymentStatus)) return "To'lov holati noto'g'ri.";
  return null;
}

export function enrichEnrollment(
  enrollment: EnrollmentModel,
  context: {
    bootcampName?: string;
    bootcampPrice?: number;
  },
): Enrollment {
  return {
    ...enrollment,
    bootcampName: context.bootcampName,
    bootcampPrice: context.bootcampPrice,
    remainingBalance:
      typeof context.bootcampPrice === "number" ? calculateRemaining(context.bootcampPrice, enrollment.paymentAmount) : undefined,
  };
}

export async function listEnrollments(studentId?: string) {
  const store = await loadStore();
  const rows = studentId ? store.enrollments.filter((item) => item.studentId === studentId) : store.enrollments;

  return rows.map((enrollment) => {
    const bootcamp = store.bootcamps.find((item) => item.id === enrollment.bootcampId);
    return enrichEnrollment(enrollment, {
      bootcampName: bootcamp?.name,
      bootcampPrice: bootcamp?.price,
    });
  });
}

export async function createEnrollmentRecord(input: CreateEnrollmentInput) {
  const validationError = validateEnrollmentInput(input);
  if (validationError) return { error: validationError };

  const store = await loadStore();
  const student = store.students.find((item) => item.id === input.studentId);
  if (!student) return { error: "Student topilmadi." };

  const bootcamp = store.bootcamps.find((item) => item.id === input.bootcampId);
  if (!bootcamp) return { error: "Bootcamp topilmadi." };

  const duplicate = store.enrollments.some(
    (item) => item.studentId === input.studentId && item.bootcampId === input.bootcampId,
  );
  if (duplicate) return { error: "Student bu bootcampga allaqachon yozilgan." };

  if (input.paymentAmount > bootcamp.price) {
    return { error: "To'lov summasi bootcamp narxidan katta bo'lishi mumkin emas." };
  }

  const normalizedStatus: EnrollmentPaymentStatus =
    input.paymentAmount === 0 ? "unpaid" : input.paymentAmount >= bootcamp.price ? "paid" : input.paymentStatus;

  const enrollment: EnrollmentModel = {
    id: randomUUID(),
    studentId: input.studentId,
    bootcampId: input.bootcampId,
    paymentAmount: Number(input.paymentAmount),
    paymentStatus: normalizedStatus,
    startDate: input.startDate,
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO enrollments (id, student_id, bootcamp_id, payment_amount, payment_status, start_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    enrollment.id,
    enrollment.studentId,
    enrollment.bootcampId,
    enrollment.paymentAmount,
    enrollment.paymentStatus,
    enrollment.startDate,
  );

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    "enrollment",
    enrollment.id,
    "create",
    "admin-001",
    new Date().toISOString(),
    `${student.fullName} ${bootcamp.name} bootcampiga yozildi.`,
  );

  return {
    enrollment: enrichEnrollment(enrollment, {
      bootcampName: bootcamp.name,
      bootcampPrice: bootcamp.price,
    }),
  };
}

export async function updateEnrollmentRecord(enrollmentId: string, input: UpdateEnrollmentInput, actorUserId?: string) {
  const store = await loadStore();
  const enrollment = store.enrollments.find((item) => item.id === enrollmentId);
  if (!enrollment) return { error: "Enrollment topilmadi." };

  const bootcamp = store.bootcamps.find((item) => item.id === enrollment.bootcampId);
  if (!bootcamp) return { error: "Bootcamp topilmadi." };

  const nextPaymentAmount = input.paymentAmount !== undefined ? Number(input.paymentAmount) : enrollment.paymentAmount;
  if (!Number.isFinite(nextPaymentAmount) || nextPaymentAmount < 0) return { error: "To'lov summasi noto'g'ri." };
  if (nextPaymentAmount > bootcamp.price) return { error: "To'lov summasi bootcamp narxidan katta bo'lishi mumkin emas." };

  const nextStatus =
    nextPaymentAmount === 0
      ? "unpaid"
      : nextPaymentAmount >= bootcamp.price
        ? "paid"
        : input.paymentStatus ?? enrollment.paymentStatus;

  const nextStartDate = input.startDate ?? enrollment.startDate;
  if (!nextStartDate) return { error: "Boshlanish sanasi majburiy." };

  const db = getDb();
  db.prepare(`
    UPDATE enrollments
    SET payment_amount = ?, payment_status = ?, start_date = ?
    WHERE id = ?
  `).run(nextPaymentAmount, nextStatus, nextStartDate, enrollmentId);

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), "enrollment", enrollmentId, "update", actorUserId ?? "admin-001", new Date().toISOString(), `Enrollment yangilandi.`);

  return {
    enrollment: enrichEnrollment(
      {
        ...enrollment,
        paymentAmount: nextPaymentAmount,
        paymentStatus: nextStatus,
        startDate: nextStartDate,
      },
      {
        bootcampName: bootcamp.name,
        bootcampPrice: bootcamp.price,
      },
    ),
  };
}

export async function deleteEnrollmentRecord(enrollmentId: string, actorUserId?: string) {
  const store = await loadStore();
  const enrollment = store.enrollments.find((item) => item.id === enrollmentId);
  if (!enrollment) return { error: "Enrollment topilmadi." };

  const db = getDb();
  db.prepare(`DELETE FROM enrollments WHERE id = ?`).run(enrollmentId);
  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), "enrollment", enrollmentId, "delete", actorUserId ?? "admin-001", new Date().toISOString(), `Enrollment o'chirildi.`);

  return { enrollment };
}

export async function getStudentEnrollmentSummary(studentId: string) {
  const store = await loadStore();
  const studentEnrollments = store.enrollments.filter((item) => item.studentId === studentId);
  const enrollments = studentEnrollments.map((enrollment) => {
    const bootcamp = store.bootcamps.find((item) => item.id === enrollment.bootcampId);
    return enrichEnrollment(enrollment, {
      bootcampName: bootcamp?.name,
      bootcampPrice: bootcamp?.price,
    });
  });

  return {
    enrollments,
    totalPaid: enrollments.reduce((sum, item) => sum + item.paymentAmount, 0),
    totalRemaining: enrollments.reduce((sum, item) => sum + (item.remainingBalance ?? 0), 0),
  };
}
