import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, decodeSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/store";
import { teacherOwnsGroup } from "@/lib/services/auth-service";
import { TeacherPanelClient } from "@/components/teacher/panel-client";
import { StudentPanelClient } from "@/components/student/panel-client";

export default async function PanelPage() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(AUTH_COOKIE)?.value);

  if (!session) {
    redirect("/login");
  }

  if (session.role === "admin") {
    redirect("/admin");
  }

  const dashboard = await getDashboardData();
  const student = session.linkedStudentId
    ? dashboard.students.find((item) => item.id === session.linkedStudentId)
    : null;
  const studentEnrollments = session.linkedStudentId
    ? dashboard.enrollments.filter((item) => item.studentId === session.linkedStudentId)
    : [];
  const studentBilling = session.linkedStudentId
    ? dashboard.billing.find((item) => item.studentId === session.linkedStudentId) ?? null
    : null;
  const studentGroup = student ? dashboard.groups.find((group) => group.name === student.group) ?? null : null;
  const teacherGroups = dashboard.groups.filter((group) =>
    teacherOwnsGroup(group.teacher, {
      name: session.name,
      email: session.email,
    }),
  );
  const teacherStudents = dashboard.students.filter((studentItem) =>
    teacherGroups.some((group) => group.name === studentItem.group),
  );

  return (
    <main className="min-h-screen bg-[#08101f] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl rounded-[32px] border border-white/8 bg-[#0d1728] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.28)] md:p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-white/35">{session.role} panel</p>
        <h1 className="mt-4 text-4xl font-bold">{session.name}</h1>
        <p className="mt-3 text-white/55">Bu account admin tomonidan yaratilgan. Login va parol admin orqali beriladi.</p>

        {session.role === "student" && student ? (
          <StudentPanelClient
            student={student}
            enrollments={studentEnrollments}
            group={studentGroup}
            billing={studentBilling}
          />
        ) : null}

        {session.role === "teacher" ? (
          <TeacherPanelClient
            teacherName={session.name}
            teacherEmail={session.email}
            groups={teacherGroups}
            students={teacherStudents}
          />
        ) : null}
      </div>
    </main>
  );
}
