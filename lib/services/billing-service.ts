import type { GroupItem, Student, StudentBillingSummary } from "@/lib/types";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthDiffInclusive(from: Date, to: Date) {
  const yearMonths = (to.getFullYear() - from.getFullYear()) * 12;
  return yearMonths + (to.getMonth() - from.getMonth()) + 1;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDueDate(joinedAt: string, now = new Date()) {
  const joined = new Date(joinedAt);
  if (Number.isNaN(joined.getTime())) return null;

  const dueDay = Math.min(Math.max(joined.getDate(), 1), 28);
  return formatDate(new Date(now.getFullYear(), now.getMonth(), dueDay));
}

export function buildStudentBillingSummary(student: Student, groups: GroupItem[], now = new Date()): StudentBillingSummary {
  const group = groups.find((item) => item.name === student.group);
  const monthlyFee = group?.monthlyFee ?? 0;
  const joinedAtDate = new Date(student.joinedAt);
  const joinedMonthStart =
    Number.isNaN(joinedAtDate.getTime()) || joinedAtDate > now ? startOfMonth(now) : startOfMonth(joinedAtDate);

  const activeMonths = monthlyFee > 0 ? Math.max(monthDiffInclusive(joinedMonthStart, startOfMonth(now)), 1) : 0;
  const totalDue = monthlyFee * activeMonths;
  const totalPaid = student.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = Math.max(totalDue - totalPaid, 0);
  const currentCycleDue = monthlyFee;
  const dueDate = getDueDate(student.joinedAt, now);
  const isOverdue = Boolean(dueDate && dueDate < formatDate(now) && outstanding > 0);

  let status: StudentBillingSummary["status"] = "paid";
  if (outstanding <= 0) {
    status = "paid";
  } else if (totalPaid > 0) {
    status = "partial";
  } else if (isOverdue) {
    status = "overdue";
  } else {
    status = "unpaid";
  }

  return {
    studentId: student.id,
    group: student.group,
    monthlyFee,
    activeMonths,
    totalDue,
    totalPaid,
    outstanding,
    currentCycleDue,
    dueDate,
    status,
  };
}

export function buildBillingSummaries(students: Student[], groups: GroupItem[], now = new Date()) {
  return students.map((student) => buildStudentBillingSummary(student, groups, now));
}
