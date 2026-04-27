import { randomUUID } from "crypto";
import type { AttendanceRecordModel } from "@/lib/models/attendance";
import type { NotificationModel } from "@/lib/models/system";
import type { StudentModel } from "@/lib/models/student";
import type { PersistedStoreModel } from "@/lib/models/system";

function notificationExists(
  notifications: NotificationModel[],
  studentId: string,
  type: NotificationModel["type"],
  date: string,
) {
  return notifications.some(
    (item) => item.studentId === studentId && item.type === type && item.createdAt.slice(0, 10) === date,
  );
}

function latestRecords(records: AttendanceRecordModel[], studentId: string) {
  return records
    .filter((record) => record.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function evaluateNotifications(store: PersistedStoreModel, student: StudentModel, record: AttendanceRecordModel) {
  const existing = store.notifications;
  const lastRecords = latestRecords(store.attendanceRecords, student.id);
  const threshold = store.settings.attendanceThresholdPercent;

  const notificationsToCreate: NotificationModel[] = [];
  const consecutiveAbsent = lastRecords.slice(0, store.settings.consecutiveAbsenceThreshold).every((item) => item.status === "absent");
  if (
    consecutiveAbsent &&
    !notificationExists(existing, student.id, "consecutive_absence", record.date)
  ) {
    notificationsToCreate.push({
      id: randomUUID(),
      studentId: student.id,
      type: "consecutive_absence",
      title: "Ketma-ket kelmaganlik",
      message: `${student.fullName} ketma-ket ${store.settings.consecutiveAbsenceThreshold} marta darsga kelmadi.`,
      createdAt: new Date().toISOString(),
      read: false,
    });
  }

  const total = lastRecords.length;
  const present = lastRecords.filter((item) => item.status === "present").length;
  const percent = total ? Math.round((present / total) * 100) : 100;
  if (percent < threshold && !notificationExists(existing, student.id, "low_attendance", record.date)) {
    notificationsToCreate.push({
      id: randomUUID(),
      studentId: student.id,
      type: "low_attendance",
      title: "Davomat pasaydi",
      message: `${student.fullName} davomat ko'rsatkichi ${percent}% ga tushdi.`,
      createdAt: new Date().toISOString(),
      read: false,
    });
  }

  if (record.homeworkStatus === "not_done" && !notificationExists(existing, student.id, "missing_homework", record.date)) {
    notificationsToCreate.push({
      id: randomUUID(),
      studentId: student.id,
      type: "missing_homework",
      title: "Homework bajarilmagan",
      message: `${student.fullName} uchun ${record.date} kuni homework bajarilmagan.`,
      createdAt: new Date().toISOString(),
      read: false,
    });
  }

  const recentGrades = lastRecords.slice(0, 4).map((item) => item.dailyGrade);
  if (recentGrades.length >= 3) {
    const declining = recentGrades.every((grade, index, arr) => index === 0 || grade <= arr[index - 1]);
    if (declining && !notificationExists(existing, student.id, "declining_performance", record.date)) {
      notificationsToCreate.push({
        id: randomUUID(),
        studentId: student.id,
        type: "declining_performance",
        title: "Performance pasaymoqda",
        message: `${student.fullName}ning oxirgi darslardagi baholari pasayish trendida.`,
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
  }

  store.notifications.unshift(...notificationsToCreate);
  return notificationsToCreate;
}
