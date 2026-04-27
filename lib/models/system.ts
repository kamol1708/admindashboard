import type { AttendanceRecordModel } from "./attendance";
import type { BootcampModel, EnrollmentModel } from "./bootcamp";
import type { StudentModel } from "./student";
import type { UserModel } from "./user";
import type { GroupItem } from "../types";

export interface NotificationModel {
  id: string;
  studentId: string;
  type:
    | "consecutive_absence"
    | "low_attendance"
    | "missing_homework"
    | "declining_performance"
    | "attendance_posted"
    | "grade_posted";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface AuditLogModel {
  id: string;
  entityType: "student" | "attendance" | "user" | "group" | "bootcamp" | "enrollment";
  entityId: string;
  action: "create" | "update" | "delete" | "import" | "export" | "login";
  actorUserId?: string;
  createdAt: string;
  summary: string;
}

export interface SystemSettingsModel {
  attendanceThresholdPercent: number;
  consecutiveAbsenceThreshold: number;
  restrictPastAttendanceEdits: boolean;
}

export interface PersistedStoreModel {
  students: StudentModel[];
  groups: GroupItem[];
  bootcamps: BootcampModel[];
  enrollments: EnrollmentModel[];
  users: UserModel[];
  attendanceRecords: AttendanceRecordModel[];
  notifications: NotificationModel[];
  auditLogs: AuditLogModel[];
  settings: SystemSettingsModel;
}
