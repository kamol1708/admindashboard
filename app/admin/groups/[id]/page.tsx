import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AUTH_COOKIE, decodeSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/store";
import { buildLessonLibrary } from "@/components/admin/utils";
import { GroupJournalPage } from "@/components/admin/group-journal-page";
import { listLessonsForGroup } from "@/lib/services/lesson-service";

export default async function AdminGroupDetailPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(AUTH_COOKIE)?.value);
  const { id } = await params;
  const dashboard = await getDashboardData();
  const group = dashboard.groups.find((item) => item.id === id);

  if (!group) {
    notFound();
  }

  const students = dashboard.students.filter((student) => student.group === group.name);
  const billing = dashboard.billing.filter((item) => students.some((student) => student.id === item.studentId));
  const persistedLessons = await listLessonsForGroup(group.name);
  const lessons = buildLessonLibrary(students, persistedLessons);

  return (
    <GroupJournalPage
      adminName={session?.name || "Azizbek Rahimov"}
      group={group}
      students={students}
      billing={billing}
      initialLessons={lessons}
    />
  );
}
