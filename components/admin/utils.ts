import type { Student } from "@/lib/types";
import type { AttendanceLessonDraft } from "@/components/admin/constants";

export function latestAttendance(student: Student) {
  return [...student.attendance].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function buildLessonLibrary(students: Student[], persistedLessons: AttendanceLessonDraft[] = []) {
  const lessons = new Map<string, AttendanceLessonDraft>();

  persistedLessons.forEach((lesson) => {
    const key = `${lesson.date}-${lesson.title}`;
    lessons.set(key, lesson);
  });

  students.forEach((student) => {
    student.attendance.forEach((entry, index) => {
      const key = `${entry.date}-${entry.lesson}`;
      if (!lessons.has(key)) {
        lessons.set(key, {
          id: key,
          title: entry.lesson || `Lesson-${index + 1}`,
          date: entry.date,
          topic: entry.topic || "Mavzu kiritilmagan",
        });
      }
    });
  });

  return [...lessons.values()].sort((a, b) => a.date.localeCompare(b.date));
}
