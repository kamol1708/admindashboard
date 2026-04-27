export type StudentStatus = "active" | "warning" | "probation" | "removed";
export type AttendanceState = "present" | "late" | "absent";
export type UserRole = "admin" | "teacher" | "student";
export type EnrollmentPaymentStatus = "paid" | "unpaid" | "partial";
export type PaymentMethod = "cash" | "card" | "transfer";
export type PaymentRequestStatus = "pending" | "approved" | "rejected";

export interface PaymentEntry {
  id: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  status?: PaymentRequestStatus;
  month?: string;
  requestedAt?: string;
  confirmedAt?: string;
  transactionId?: string;
  proofNote?: string;
  reviewedByUserId?: string;
  note?: string;
}

export interface GradeEntry {
  id: string;
  subject: string;
  score: number;
  maxScore: number;
  examDate: string;
  note?: string;
}

export interface AttendanceEntry {
  id: string;
  date: string;
  status: AttendanceState;
  lesson: string;
  topic?: string;
  homework?: number;
  comment?: string;
  reason?: "sick" | "permission" | "no_reason";
  earlyLeave?: boolean;
}

export interface StudentTelegramMeta {
  chatId?: string;
  username?: string;
  connectedAt?: string;
  inviteToken?: string;
  inviteExpiresAt?: string;
  inviteSentAt?: string;
  credentialsSentAt?: string;
}

export interface Student {
  id: string;
  fullName: string;
  group: string;
  phone: string;
  parentPhone: string;
  joinedAt: string;
  status: StudentStatus;
  balance: number;
  notes: string;
  grades: GradeEntry[];
  attendance: AttendanceEntry[];
  payments: PaymentEntry[];
  telegram?: StudentTelegramMeta;
}

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  linkedStudentId?: string;
}

export interface Bootcamp {
  id: string;
  name: string;
  price: number;
}

export interface Enrollment {
  id: string;
  studentId: string;
  bootcampId: string;
  paymentAmount: number;
  paymentStatus: EnrollmentPaymentStatus;
  startDate: string;
  bootcampName?: string;
  bootcampPrice?: number;
  remainingBalance?: number;
}

export interface GroupItem {
  id: string;
  name: string;
  teacher: string;
  schedule: string;
  room: string;
  monthlyFee: number;
}

export interface StudentBillingSummary {
  studentId: string;
  group: string;
  monthlyFee: number;
  activeMonths: number;
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  currentCycleDue: number;
  dueDate: string | null;
  status: "paid" | "partial" | "unpaid" | "overdue";
}

export interface DashboardMetrics {
  totalStudents: number;
  activeStudents: number;
  warnings: number;
  removedStudents: number;
  averageScore: number;
  attendanceRate: number;
}

export interface StudentInsight {
  id: string;
  fullName: string;
  group: string;
  status: StudentStatus;
  averageScore: number;
  attendanceRate: number;
  latestLesson: string;
  riskLabel: string;
}

export interface DashboardResponse {
  students: Student[];
  insights: StudentInsight[];
  metrics: DashboardMetrics;
  alerts: string[];
  groups: GroupItem[];
  users: AppUser[];
  bootcamps: Bootcamp[];
  enrollments: Enrollment[];
  billing: StudentBillingSummary[];
}
