"use client";

import type { EnrollmentPaymentStatus } from "@/lib/types";

export type AdminTab =
  | "dashboard"
  | "students"
  | "teachers"
  | "groups"
  | "courses"
  | "payments"
  | "settings";

export type ThemeMode = "day" | "night";
export type StudentFilter = "all" | "active" | "risk" | "debt";
export type StudentSort = "name" | "attendance" | "balance";
export type StudentPaymentFilter = "all" | "paid" | "partial" | "unpaid" | "overdue";

export type AttendanceLessonDraft = {
  id: string;
  title: string;
  date: string;
  topic: string;
};

export type StudentFormState = {
  fullName: string;
  teacher: string;
  group: string;
  phone: string;
  parentPhone: string;
  balance: string;
  paymentStatus: "unpaid" | "partial" | "full";
  paidAmount: string;
  email: string;
  password: string;
  notes: string;
};

export type GroupFormState = {
  name: string;
  teacher: string;
  schedule: string;
  room: string;
  monthlyFee: string;
};

export type PaymentFormState = {
  amount: string;
  paidAt: string;
  method: "cash" | "card" | "transfer";
  month: string;
  transactionId: string;
  proofNote: string;
  note: string;
};

export type TeacherFormState = {
  fullName: string;
  email: string;
  password: string;
};

export type BootcampFormState = {
  name: string;
  price: string;
};

export type EnrollmentFormState = {
  studentId: string;
  bootcampId: string;
  paymentAmount: string;
  paymentStatus: EnrollmentPaymentStatus;
  startDate: string;
};

export const dayShell = {
  shell: "min-h-screen bg-[radial-gradient(circle_at_top,#d9e6ff,transparent_24%),linear-gradient(180deg,#f8fbff,#eaf1fb)] text-slate-950",
  sidebar: "border-slate-200/80 bg-white/90 text-slate-950 shadow-[0_22px_80px_rgba(148,163,184,0.22)]",
  panel: "border-slate-200/80 bg-white/92 text-slate-950 shadow-[0_20px_70px_rgba(148,163,184,0.14)]",
  panelSoft: "border-slate-200 bg-[#f5f8fd] text-slate-950",
  panelMuted: "border-slate-200 bg-[#eef3fb] text-slate-950",
  input: "border-slate-200 bg-white text-slate-900",
  muted: "text-slate-500",
} as const;

export const sidebarItems: { id: AdminTab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Bosh sahifa", icon: "⌂" },
  { id: "students", label: "O'quvchilar", icon: "◉" },
  { id: "teachers", label: "O'qituvchilar", icon: "◍" },
  { id: "groups", label: "Guruhlar", icon: "◫" },
  { id: "courses", label: "Kurslar", icon: "▤" },
  { id: "payments", label: "To'lovlar", icon: "◧" },
  { id: "settings", label: "Sozlamalar", icon: "⚙" },
];

export const teacherPool = [
  { name: "Azizbek Rahimov", subject: "English Mentor", groups: ["IELTS Evening", "ENG-401"], load: "92%" },
  { name: "Malika Sobirova", subject: "Matematika Mentor", groups: ["Kids Math", "MATH-220"], load: "81%" },
  { name: "Bekzod Karimov", subject: "Frontend Mentor", groups: ["Frontend Bootcamp"], load: "88%" },
  { name: "Dilfuza Aliyeva", subject: "Administrator", groups: ["Admissions"], load: "64%" },
];

export const defaultStudentForm: StudentFormState = {
  fullName: "",
  teacher: "",
  group: "",
  phone: "",
  parentPhone: "",
  balance: "0",
  paymentStatus: "unpaid",
  paidAmount: "0",
  email: "",
  password: "",
  notes: "",
};

export const defaultGroupForm: GroupFormState = {
  name: "",
  teacher: "",
  schedule: "",
  room: "",
  monthlyFee: "0",
};

export const defaultPaymentForm: PaymentFormState = {
  amount: "",
  paidAt: new Date().toISOString().slice(0, 10),
  method: "cash",
  month: new Date().toISOString().slice(0, 7),
  transactionId: "",
  proofNote: "",
  note: "",
};

export const defaultTeacherForm: TeacherFormState = {
  fullName: "",
  email: "",
  password: "",
};

export const defaultBootcampForm: BootcampFormState = {
  name: "",
  price: "",
};

export const defaultEnrollmentForm: EnrollmentFormState = {
  studentId: "",
  bootcampId: "",
  paymentAmount: "0",
  paymentStatus: "unpaid",
  startDate: new Date().toISOString().slice(0, 10),
};
