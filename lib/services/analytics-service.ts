import type { AttendanceRecordModel } from "@/lib/models/attendance";
import type { StudentModel } from "@/lib/models/student";
import { loadStore } from "@/lib/repositories/system-repository";

function studentRecords(records: AttendanceRecordModel[], studentId: string) {
  return records.filter((record) => record.studentId === studentId);
}

export function computeStudentAttendanceStats(student: StudentModel, records: AttendanceRecordModel[]) {
  const target = studentRecords(records, student.id);
  const totalPresentDays = target.filter((record) => record.status === "present").length;
  const totalAbsentDays = target.filter((record) => record.status === "absent").length;
  const total = target.length;
  const attendancePercentage = total ? Math.round((totalPresentDays / total) * 100) : 100;
  const averageParticipationScore = target.length
    ? Number((target.reduce((sum, record) => sum + record.participationScore, 0) / target.length).toFixed(2))
    : 0;
  const averageGrade = target.length
    ? Number((target.reduce((sum, record) => sum + record.dailyGrade, 0) / target.length).toFixed(2))
    : 0;

  return {
    totalPresentDays,
    totalAbsentDays,
    attendancePercentage,
    averageParticipationScore,
    averageGrade,
  };
}

function bucketBy(records: AttendanceRecordModel[], type: "week" | "month") {
  const buckets = new Map<string, { present: number; absent: number; averageGradeSum: number; count: number }>();

  records.forEach((record) => {
    const date = new Date(`${record.date}T00:00:00`);
    const key =
      type === "month"
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        : `${date.getFullYear()}-W${Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7)}`;
    const bucket = buckets.get(key) ?? { present: 0, absent: 0, averageGradeSum: 0, count: 0 };
    if (record.status === "present") bucket.present += 1;
    else bucket.absent += 1;
    bucket.averageGradeSum += record.dailyGrade;
    bucket.count += 1;
    buckets.set(key, bucket);
  });

  return [...buckets.entries()].map(([period, value]) => ({
    period,
    present: value.present,
    absent: value.absent,
    averageGrade: value.count ? Number((value.averageGradeSum / value.count).toFixed(2)) : 0,
  }));
}

export async function getAnalyticsSnapshot() {
  const store = await loadStore();
  const studentStats = store.students.map((student) => ({
    studentId: student.id,
    fullName: student.fullName,
    group: student.group,
    ...computeStudentAttendanceStats(student, store.attendanceRecords),
  }));

  const overallAttendanceStatistics = {
    totalStudents: store.students.length,
    totalRecords: store.attendanceRecords.length,
    presentCount: store.attendanceRecords.filter((record) => record.status === "present").length,
    absentCount: store.attendanceRecords.filter((record) => record.status === "absent").length,
  };

  const topAbsentStudents = [...studentStats]
    .sort((a, b) => b.totalAbsentDays - a.totalAbsentDays)
    .slice(0, 5);
  const topActiveStudents = [...studentStats]
    .sort((a, b) => b.averageParticipationScore - a.averageParticipationScore || b.averageGrade - a.averageGrade)
    .slice(0, 5);
  const weeklyTrends = bucketBy(store.attendanceRecords, "week");
  const monthlyTrends = bucketBy(store.attendanceRecords, "month");
  const riskStudents = studentStats.filter(
    (student) => student.attendancePercentage < store.settings.attendanceThresholdPercent || student.averageGrade < 60,
  );

  return {
    overallAttendanceStatistics,
    topAbsentStudents,
    topActiveStudents,
    weeklyTrends,
    monthlyTrends,
    riskStudents,
    studentStats,
  };
}
