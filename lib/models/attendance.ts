export type AttendanceStatusModel = "present" | "late" | "absent";
export type AttendanceReasonModel = "sick" | "permission" | "no_reason";
export type HomeworkStatusModel = "done" | "not_done";
export type CalendarViewModel = "day" | "week" | "month";

export interface AttendanceRecordModel {
  id: string;
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
  comment: string;
  recordedAt: string;
  recordedByUserId: string;
}

export interface AttendanceFilterModel {
  studentId?: string;
  group?: string;
  status?: AttendanceStatusModel;
  lowAttendanceOnly?: boolean;
  absentOnly?: boolean;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  view?: CalendarViewModel;
  anchorDate?: string;
}
