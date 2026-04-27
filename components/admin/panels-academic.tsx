"use client";

import { useMemo, useState } from "react";
import type { AttendanceState, Student, StudentStatus } from "@/lib/types";
import { ActionButton, InfoPanel, PanelHero, QuickActionCard } from "@/components/admin/ui";

type ThemeMode = "day" | "night";

type GroupCard = {
  id: string;
  name: string;
  students: number;
  attendanceAverage: number;
  teacher: string;
  schedule: string;
  room: string;
  monthlyFee: number;
};

type TeacherCard = {
  name: string;
  subject: string;
  groups: string[];
  load: string;
  email: string;
};

type AttendanceLessonDraft = {
  id: string;
  title: string;
  date: string;
  topic: string;
};

const statusTone: Record<StudentStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  probation: "bg-sky-500/15 text-sky-300",
  removed: "bg-rose-500/15 text-rose-300",
};

function formatStatus(status: StudentStatus) {
  if (status === "active") return "Aktiv";
  if (status === "warning") return "Ogohlantirish";
  if (status === "probation") return "Nazorat";
  return "Chetlatilgan";
}

export function TeachersPanel({
  groups,
  teachers,
  theme,
  onAddTeacher,
}: {
  groups: Pick<GroupCard, "name" | "students" | "attendanceAverage" | "teacher">[];
  teachers: TeacherCard[];
  theme: ThemeMode;
  onAddTeacher: () => void;
}) {
  return (
    <>
      <PanelHero
        badge="Teacher markazi"
        title="O'qituvchi boshqaruvi"
        description="Teacher account yaratish, yuklamasini ko'rish va qaysi guruhlarga biriktirilganini boshqarish markazi."
        tone="teal"
        theme={theme}
        actions={<ActionButton label="+ Teacher yaratish" primary onClick={onAddTeacher} theme={theme} />}
        stats={[
          { label: "Jami teacher", value: String(teachers.length) },
          { label: "Biriktirilgan", value: String(teachers.filter((teacher) => teacher.groups.length > 0).length) },
          { label: "Bo'sh", value: String(teachers.filter((teacher) => teacher.groups.length === 0).length) },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <QuickActionCard
          icon="＋"
          title="Yangi o'qituvchi qo'shish"
          description="Email, parol va shaxsiy ma'lumotlar bilan yangi teacher profilini tez yarating."
          tone="blue"
          theme={theme}
          action={<ActionButton label="O'qituvchi yaratish" primary onClick={onAddTeacher} theme={theme} />}
        />
        <QuickActionCard
          icon="🔗"
          title="Guruhlarga biriktirish"
          description="Teacher yuklamasini kuzatib, yangi guruhlarni to'g'ri o'qituvchiga ulashni osonlashtiring."
          tone="emerald"
          theme={theme}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {teachers.map((teacher) => (
          <section key={teacher.email} className={`rounded-[30px] border p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-[11px] uppercase tracking-[0.18em] ${theme === "day" ? "text-slate-400" : "text-white/30"}`}>Teacher profile</p>
                <h2 className="mt-2 text-[30px] font-bold leading-tight">{teacher.name}</h2>
                <p className={`mt-2 text-base ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{teacher.subject}</p>
                <p className={`mt-2 text-sm ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>{teacher.email}</p>
              </div>
              <span className="rounded-full bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-300">{teacher.load}</span>
            </div>
            <div className="mt-6 space-y-3">
              {teacher.groups.map((groupName, index) => {
                const group = groups.find((item) => item.name === groupName);
                return (
                  <div key={`${teacher.email}-${groupName}-${index}`} className={`rounded-[22px] border p-4 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
                    <p className="text-xl font-semibold">{groupName}</p>
                    <p className={`mt-2 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
                      {group?.students ?? 0} ta o'quvchi · Davomat {group?.attendanceAverage ?? 0}%
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export function AttendancePanel({
  students,
  groups,
  lessons,
  onSetAttendance,
  absentCount,
  lateCount,
  presentCount,
  onAddStudent,
  onAddLesson,
  theme,
}: {
  students: Student[];
  groups: GroupCard[];
  lessons: AttendanceLessonDraft[];
  onSetAttendance: (
    studentId: string,
    payload: { date: string; title: string; topic: string; status: AttendanceState; homework: number; note?: string },
  ) => void;
  absentCount: number;
  lateCount: number;
  presentCount: number;
  onAddStudent: () => void;
  onAddLesson: (lesson: AttendanceLessonDraft) => void;
  theme: ThemeMode;
}) {
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().slice(0, 10));
  const [lessonTopic, setLessonTopic] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { status: AttendanceState; homework: number; note: string }>>({});

  const visibleStudents = useMemo(() => {
    if (selectedGroup === "all") return students;
    return students.filter((student) => student.group === selectedGroup);
  }, [selectedGroup, students]);

  const visibleLessons = lessons.length
    ? lessons
    : [
        {
          id: "default-lesson-1",
          title: "Lesson-1",
          date: new Date().toISOString().slice(0, 10),
          topic: "",
        },
      ];

  const attendanceRows = useMemo(() => {
    const query = attendanceSearch.trim().toLowerCase();

    return visibleStudents
      .flatMap((student) =>
        visibleLessons.map((lesson, lessonIndex) => ({
          rowId: `${student.id}-${lesson.id}`,
          student,
          lesson,
          lessonIndex,
          entry: student.attendance.find((item) => item.date === lesson.date && item.lesson === lesson.title),
        })),
      )
      .filter((row) => {
        if (!query) return true;
        const haystack = `${row.student.fullName} ${row.student.group} ${row.lesson.date} ${row.lesson.topic} Lesson-${row.lessonIndex + 1}`.toLowerCase();
        return haystack.includes(query);
      });
  }, [attendanceSearch, visibleLessons, visibleStudents]);

  const nextLessonNumber = useMemo(() => {
    const sourceLessons = lessons.length
      ? lessons
      : [
          {
            title: "Lesson-1",
          },
        ];

    const maxExisting = sourceLessons.reduce((max, lesson) => {
      const matched = lesson.title.match(/lesson-(\d+)/i);
      const current = matched ? Number(matched[1]) : 0;
      return Math.max(max, current);
    }, 0);

    return Math.max(maxExisting + 1, 2);
  }, [lessons]);

  const nextLessonTitle = `Lesson-${nextLessonNumber}`;

  function handleLessonCreate() {
    if (!lessonDate.trim() || !lessonTopic.trim()) return;

    onAddLesson({
      id: `${lessonDate}-${nextLessonTitle}`,
      title: nextLessonTitle,
      date: lessonDate,
      topic: lessonTopic.trim(),
    });
    setShowLessonModal(false);
    setLessonTopic("");
    setLessonDate(new Date().toISOString().slice(0, 10));
  }

  return (
    <>
      <PanelHero
        badge="Davomat markazi"
        title="Lesson va davomad jurnali"
        description="Har dars uchun lesson, mavzu, homework va attendance holatini bir joyda yuriting."
        tone="violet"
        theme={theme}
        actions={
          <>
            <ActionButton label="+ Add Student" primary onClick={onAddStudent} theme={theme} />
            <ActionButton label="Bugungi xulosa" onClick={() => window.print()} theme={theme} />
          </>
        }
        stats={[
          { label: "Keldi", value: String(presentCount) },
          { label: "Kechikdi", value: String(lateCount) },
          { label: "Kelmadi", value: String(absentCount) },
        ]}
      />

      <div className="grid gap-5 md:grid-cols-3">
        <InfoPanel title="Keldi" value={String(presentCount)} hint="Bugungi tayyor qatnashuvchilar" theme={theme} />
        <InfoPanel title="Kechikdi" value={String(lateCount)} hint="Darsga kech qo'shilganlar" theme={theme} />
        <InfoPanel title="Kelmadi" value={String(absentCount)} hint="Nazorat talab qiladiganlar" theme={theme} />
      </div>

      <section className={`rounded-[30px] border p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Lesson jadvali</h2>
            <p className={`mt-2 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
              Tepada lesson, ichida kelgan-kelmagan va homework nazorati.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-white/8 bg-white/5 text-white/80"}`}>
              Keyingi lesson: {nextLessonTitle}
            </div>
            <ActionButton label="+ Add Lesson" primary onClick={() => setShowLessonModal(true)} theme={theme} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <select
            value={selectedGroup}
            onChange={(event) => setSelectedGroup(event.target.value)}
            className={`rounded-2xl border px-4 py-3 text-sm outline-none ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/8 bg-white/5 text-white"}`}
          >
            <option value="all">Barcha guruhlar</option>
            {groups.map((group) => (
              <option key={group.id} value={group.name}>
                {group.name}
              </option>
            ))}
          </select>
          <span className={`text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{visibleStudents.length} ta o'quvchi</span>
          <span className={`rounded-full px-3 py-2 text-xs font-semibold ${theme === "day" ? "bg-slate-100 text-slate-700" : "bg-white/8 text-white/70"}`}>
            Sana: {lessonDate}
          </span>
          <span className={`rounded-full px-3 py-2 text-xs font-semibold ${theme === "day" ? "bg-slate-100 text-slate-700" : "bg-white/8 text-white/70"}`}>
            Guruh: {selectedGroup === "all" ? "Barcha guruhlar" : selectedGroup}
          </span>
        </div>

        <div className={`mt-6 rounded-[24px] border p-4 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/[0.03]"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Student list</h3>
              <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>Jadval boshida ko'rinadigan o'quvchilar ro'yxati.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${theme === "day" ? "bg-white text-slate-700" : "bg-white/8 text-white/70"}`}>
              {visibleStudents.length} ta student
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleStudents.map((student, index) => (
              <div key={student.id} className={`rounded-[20px] border px-4 py-3 ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#111a2d]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {index + 1}. {student.fullName}
                    </p>
                    <p className={`mt-1 text-xs ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{student.group}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusTone[student.status]}`}>{formatStatus(student.status)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`mt-6 overflow-hidden rounded-[28px] border shadow-[0_20px_70px_rgba(15,23,42,0.08)] ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#0f172b]"}`}>
          <div className={`border-b px-5 py-5 ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#111c35]"}`}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className={`grid h-11 w-11 place-items-center rounded-2xl ${theme === "day" ? "bg-[#eef35e] text-[#0f172a]" : "bg-emerald-500/15 text-emerald-300"}`}>▦</div>
                <div>
                  <h3 className="text-2xl font-bold">Student Attendance</h3>
                  <p className={`${theme === "day" ? "text-slate-500" : "text-white/45"}`}>Lesson attendance va participation jurnal ko‘rinishi.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className={`rounded-full px-5 py-3 text-sm font-semibold ${theme === "day" ? "bg-[#eef2ff] text-slate-700" : "bg-white/8 text-white/75"}`}>
                  Share
                </button>
                <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-orange-400 bg-slate-300 text-white">☺</div>
              </div>
            </div>
          </div>

          <div className={`${theme === "day" ? "bg-[#08a62f]" : "bg-[#0d9f33]"} px-5 py-4`}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-[16px] bg-white px-5 py-4 text-[#0d2250] shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">▦</span>
                  <div>
                    <p className="text-xl font-bold">Student Attendance</p>
                    <p className="text-sm text-slate-400">{selectedGroup === "all" ? "Barcha guruhlar" : selectedGroup}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-[16px] bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-4 text-white shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/20">▥</span>
                  <div>
                    <p className="text-xl font-bold">Lesson jurnal</p>
                    <p className="text-sm text-white/75">{visibleLessons.length} ta lesson</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`border-b px-5 py-5 ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10192d]"}`}>
            <div className="flex flex-col gap-3 md:flex-row">
              <label className={`flex flex-1 items-center gap-3 rounded-2xl border px-4 py-4 ${theme === "day" ? "border-slate-200 bg-white text-slate-500" : "border-white/8 bg-white/5 text-white/55"}`}>
                <span className="text-lg">⌕</span>
                <input
                  value={attendanceSearch}
                  onChange={(event) => setAttendanceSearch(event.target.value)}
                  placeholder="Search"
                  className={`w-full bg-transparent outline-none ${theme === "day" ? "placeholder:text-slate-400" : "placeholder:text-white/30"}`}
                />
              </label>
              <div className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${theme === "day" ? "border-slate-200 bg-white text-slate-600" : "border-white/8 bg-white/5 text-white/70"}`}>
                <span>Filter</span>
                <span>⚑</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1280px]">
              <div className={`grid border-b text-[13px] font-semibold ${theme === "day" ? "border-slate-200 bg-[#f5f3ff] text-[#142453]" : "border-white/8 bg-[#151f38] text-white/85"}`} style={{ gridTemplateColumns: "70px 180px 260px 180px 180px 1fr 160px" }}>
                <div className={`flex items-center gap-3 px-4 py-4 ${theme === "day" ? "border-r border-slate-200" : "border-r border-white/8"}`}>
                  <span className="grid h-7 w-7 place-items-center rounded-md border border-current/20">□</span>
                  <span>⌄</span>
                </div>
                <div className={`px-4 py-4 ${theme === "day" ? "border-r border-slate-200" : "border-r border-white/8"}`}>Date</div>
                <div className={`px-4 py-4 ${theme === "day" ? "border-r border-slate-200" : "border-r border-white/8"}`}>Student Name</div>
                <div className={`px-4 py-4 ${theme === "day" ? "border-r border-slate-200" : "border-r border-white/8"}`}>Status</div>
                <div className={`px-4 py-4 ${theme === "day" ? "border-r border-slate-200" : "border-r border-white/8"}`}>Participation</div>
                <div className={`px-4 py-4 ${theme === "day" ? "border-r border-slate-200" : "border-r border-white/8"}`}>Teacher&apos;s Notes</div>
                <div className="px-4 py-4">Month</div>
              </div>

              {attendanceRows.map((row, index) => {
                const { student, lesson, lessonIndex, entry, rowId } = row;
                const draft = drafts[rowId] ?? { status: "present" as AttendanceState, homework: 0, note: "" };
                const effectiveStatus = entry?.status ?? draft.status;
                const effectiveHomework = entry?.homework ?? draft.homework;
                const effectiveNote = entry?.topic || draft.note || "";
                const gradeDisabled = effectiveStatus === "absent";
                const displayHomework = gradeDisabled ? 0 : effectiveHomework;
                const monthLabel = new Date(`${lesson.date}T00:00:00`).toLocaleString("en-US", { month: "long" });
                const prettyDate = new Date(`${lesson.date}T00:00:00`).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div
                    key={rowId}
                    className={`grid text-[15px] ${theme === "day" ? "border-b border-slate-200 text-slate-800 even:bg-[#fcfcff]" : "border-b border-white/8 text-white/85 even:bg-white/[0.02]"}`}
                    style={{ gridTemplateColumns: "70px 180px 260px 180px 180px 1fr 160px" }}
                  >
                    <div className={`flex items-center gap-4 px-4 py-4 ${theme === "day" ? "border-r border-slate-200 text-slate-400" : "border-r border-white/8 text-white/25"}`}>
                      <span>{index + 1}</span>
                    </div>
                    <div className={`px-4 py-4 ${theme === "day" ? "border-r border-slate-200" : "border-r border-white/8"}`}>
                      <p className="font-medium">{prettyDate}</p>
                      <p className={`mt-1 text-xs ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>Lesson-{lessonIndex + 1}</p>
                    </div>
                    <div className={`px-4 py-4 ${theme === "day" ? "border-r border-slate-200" : "border-r border-white/8"}`}>
                      <p className="font-semibold">{student.fullName}</p>
                      <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-500" : "text-white/40"}`}>{student.group}</p>
                    </div>
                    <div className={`px-4 py-4 ${theme === "day" ? "border-r border-slate-200" : "border-r border-white/8"}`}>
                      {entry ? (
                        <span className={`inline-flex rounded-xl px-4 py-2 text-sm font-semibold ${effectiveStatus === "present" ? "bg-orange-100 text-orange-700" : "bg-rose-100 text-rose-700"}`}>
                          {effectiveStatus === "present" ? "Attended" : "Skipped"}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDrafts((prev) => ({ ...prev, [rowId]: { ...draft, status: "present" } }))}
                            className={`rounded-lg px-3 py-2 text-sm font-semibold ${effectiveStatus === "present" ? "bg-emerald-100 text-emerald-700" : theme === "day" ? "bg-slate-100 text-slate-500" : "bg-white/5 text-white/40"}`}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setDrafts((prev) => ({ ...prev, [rowId]: { ...draft, status: "absent" } }))}
                            className={`rounded-lg px-3 py-2 text-sm font-semibold ${effectiveStatus === "absent" ? "bg-rose-100 text-rose-700" : theme === "day" ? "bg-slate-100 text-slate-500" : "bg-white/5 text-white/40"}`}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                    <div className={`px-4 py-4 ${theme === "day" ? "border-r border-slate-200" : "border-r border-white/8"}`}>
                      <select
                        value={displayHomework}
                        disabled={Boolean(entry) || gradeDisabled}
                        onChange={(event) => setDrafts((prev) => ({ ...prev, [rowId]: { ...draft, homework: Number(event.target.value) } }))}
                        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none disabled:opacity-70 ${theme === "day" ? "border-slate-200 bg-white text-slate-900" : "border-white/8 bg-white/5 text-white"}`}
                      >
                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
                          <option key={value} value={value}>
                            {value}%
                          </option>
                        ))}
                      </select>
                      <div className="mt-3">
                        <span className={`inline-flex rounded-xl px-3 py-2 text-sm font-semibold ${theme === "day" ? "bg-sky-50 text-sky-700" : "bg-sky-500/15 text-sky-300"}`}>
                          Teacher bahosi: {gradeDisabled ? "qo'yilmaydi" : `${displayHomework}%`}
                        </span>
                      </div>
                    </div>
                    <div className={`px-4 py-4 ${theme === "day" ? "border-r border-slate-200" : "border-r border-white/8"}`}>
                      <textarea
                        value={effectiveNote}
                        disabled={Boolean(entry)}
                        onChange={(event) => setDrafts((prev) => ({ ...prev, [rowId]: { ...draft, note: event.target.value } }))}
                        rows={3}
                        placeholder="Fikr bildiring..."
                        className={`w-full resize-none rounded-xl border px-3 py-3 text-sm outline-none disabled:opacity-70 ${theme === "day" ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400" : "border-white/8 bg-white/5 text-white placeholder:text-white/30"}`}
                      />
                      <p className={`mt-3 text-sm font-medium ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
                        Teacher bergan baho: <span className={theme === "day" ? "text-slate-900" : "text-white"}>{gradeDisabled ? "qo'yilmaydi" : `${displayHomework}%`}</span>
                      </p>
                      {!entry ? (
                        <button
                          type="button"
                          onClick={() =>
                            onSetAttendance(student.id, {
                              date: lesson.date,
                              title: lesson.title,
                              topic: draft.note.trim() || lesson.topic,
                              status: draft.status,
                              homework: draft.homework,
                              note: draft.note,
                            })
                          }
                          className={`mt-3 rounded-lg px-4 py-2 text-sm font-semibold ${theme === "day" ? "bg-slate-950 text-white" : "bg-blue-500/15 text-blue-300"}`}
                        >
                          Saqlash
                        </button>
                      ) : (
                        <p className={`mt-3 text-xs ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>Davomat olingan, o&apos;zgartirib bo&apos;lmaydi.</p>
                      )}
                    </div>
                    <div className="px-4 py-4">
                      <span className={`inline-flex rounded-xl px-4 py-2 text-sm font-semibold ${monthLabel === "August" ? "bg-[#efe8b4] text-[#5d4b0b]" : "bg-[#ffd8b4] text-[#73430d]"}`}>
                        {monthLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {showLessonModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <div className={`w-full max-w-lg rounded-[30px] border p-6 shadow-[0_22px_90px_rgba(0,0,0,0.35)] ${theme === "day" ? "border-slate-200 bg-white text-slate-950" : "border-white/10 bg-[#0f152a] text-white"}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-sm uppercase tracking-[0.28em] ${theme === "day" ? "text-slate-400" : "text-white/40"}`}>Yangi lesson</p>
                <h3 className="mt-2 text-3xl font-bold">{nextLessonTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLessonModal(false)}
                className={`rounded-2xl px-4 py-2 ${theme === "day" ? "bg-slate-100 text-slate-600" : "bg-white/5 text-white/60"}`}
              >
                Yopish
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <div className={`rounded-[22px] border p-4 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
                <p className={`text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>Lesson nomi</p>
                <p className="mt-2 text-xl font-semibold">{nextLessonTitle}</p>
              </div>
              <input
                value={lessonDate}
                onChange={(event) => setLessonDate(event.target.value)}
                placeholder="2026-04-14"
                className={`rounded-2xl border px-4 py-3 text-sm outline-none ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/8 bg-white/5 text-white"}`}
              />
              <textarea
                value={lessonTopic}
                onChange={(event) => setLessonTopic(event.target.value)}
                placeholder="Lesson mavzusini kiriting"
                className={`min-h-28 rounded-2xl border px-4 py-3 text-sm outline-none ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400" : "border-white/8 bg-white/5 text-white placeholder:text-white/35"}`}
              />
              <button
                type="button"
                onClick={handleLessonCreate}
                className="rounded-2xl bg-gradient-to-r from-blue-500 to-sky-400 px-5 py-3 text-base font-semibold text-white"
              >
                Lessonni yaratish
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
