"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GroupItem, Student } from "@/lib/types";

type TeacherPanelClientProps = {
  teacherName: string;
  teacherEmail: string;
  groups: GroupItem[];
  students: Student[];
};

type AttendanceDraft = {
  status: "present" | "late" | "absent";
  reason: "sick" | "permission" | "no_reason";
  lateMinutes: number;
  earlyLeave: boolean;
  participation: number;
  dailyGrade: number;
  homeworkDone: boolean;
  comment: string;
};

function defaultDraft(): AttendanceDraft {
  return {
    status: "present",
    reason: "no_reason",
    lateMinutes: 0,
    earlyLeave: false,
    participation: 5,
    dailyGrade: 100,
    homeworkDone: true,
    comment: "",
  };
}

export function TeacherPanelClient({ teacherName, teacherEmail, groups, students }: TeacherPanelClientProps) {
  const router = useRouter();
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.name ?? "");
  const [lessonTitle, setLessonTitle] = useState("Lesson-1");
  const [lessonTopic, setLessonTopic] = useState("");
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().slice(0, 10));
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, true>>({});
  const [toast, setToast] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordToast, setPasswordToast] = useState("");

  const groupStudents = useMemo(
    () => students.filter((student) => student.group === selectedGroup),
    [selectedGroup, students],
  );
  const recentLessons = useMemo(() => {
    const lessonMap = new Map<string, { date: string; lesson: string; topic: string; group: string }>();

    students
      .filter((student) => student.group === selectedGroup)
      .forEach((student) => {
        student.attendance.forEach((entry) => {
          const key = `${student.group}-${entry.date}-${entry.lesson}`;
          if (!lessonMap.has(key)) {
            lessonMap.set(key, {
              date: entry.date,
              lesson: entry.lesson,
              topic: entry.topic ?? "",
              group: student.group,
            });
          }
        });
      });

    return [...lessonMap.values()]
      .sort((a, b) => `${b.date}-${b.lesson}`.localeCompare(`${a.date}-${a.lesson}`))
      .slice(0, 6);
  }, [selectedGroup, students]);

  useEffect(() => {
    const nextSaved: Record<string, true> = {};

    students.forEach((student) => {
      student.attendance.forEach((entry) => {
        nextSaved[`${student.id}-${entry.date}`] = true;
      });
    });

    setSavedKeys(nextSaved);
  }, [students]);

  function updateDraft(studentId: string, patch: Partial<AttendanceDraft>) {
    const current = drafts[studentId] ?? defaultDraft();
    const next = {
      ...current,
      ...patch,
    };

    if (patch.status === "absent") {
      next.reason = current.reason === "no_reason" ? "no_reason" : current.reason;
      next.lateMinutes = 0;
      next.earlyLeave = false;
      next.participation = 1;
      next.dailyGrade = 0;
      next.homeworkDone = false;
    } else if (patch.status === "late") {
      next.reason = "no_reason";
      next.lateMinutes = current.lateMinutes > 0 ? current.lateMinutes : 10;
    } else if (patch.status === "present") {
      next.reason = "no_reason";
      next.lateMinutes = 0;
    }

    setDrafts((current) => ({
      ...current,
      [studentId]: next,
    }));
  }

  async function saveStudentRow(student: Student) {
    const rowKey = `${student.id}-${lessonDate}`;
    if (savedKeys[rowKey]) {
      setToast(`${student.fullName} uchun ${lessonDate} davomat allaqachon saqlangan.`);
      return;
    }

    const draft = drafts[student.id] ?? defaultDraft();
    setBusyKey(student.id);
    setToast("");

    try {
      const response = await fetch("/api/teacher/lesson-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          date: lessonDate,
          lessonTitle,
          topic: lessonTopic || lessonTitle,
          status: draft.status,
          reason: draft.status === "absent" ? draft.reason : "no_reason",
          lateMinutes: draft.status === "late" ? draft.lateMinutes : 0,
          earlyLeave: draft.status === "late" ? draft.earlyLeave : false,
          participationScore: draft.participation,
          homeworkStatus: draft.homeworkDone ? "done" : "not_done",
          dailyGrade: draft.dailyGrade,
          comment: draft.comment,
          maxScore: 100,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setToast(payload.error || `${student.fullName} uchun attendance saqlanmadi.`);
        setBusyKey("");
        return;
      }

      setSavedKeys((current) => ({ ...current, [rowKey]: true }));
      setToast(
        draft.status === "absent"
          ? `${student.fullName} uchun davomat saqlandi.`
          : `${student.fullName} uchun davomat va baho saqlandi.`,
      );
      setBusyKey("");
      router.refresh();
    } catch {
      setToast(`${student.fullName} uchun saqlash vaqtida tarmoq xatosi yuz berdi.`);
      setBusyKey("");
    }
  }

  async function handlePasswordChange() {
    if (!currentPassword.trim() || !newPassword.trim()) {
      setPasswordToast("Joriy va yangi parolni kiriting.");
      return;
    }

    setPasswordBusy(true);
    setPasswordToast("");

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setPasswordToast(payload.error || "Parol yangilanmadi.");
        setPasswordBusy(false);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setPasswordToast("Parol muvaffaqiyatli yangilandi.");
      setPasswordBusy(false);
    } catch {
      setPasswordToast("Parolni yangilashda tarmoq xatosi yuz berdi.");
      setPasswordBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
          <p className="text-white/45">Teacher login</p>
          <h2 className="mt-4 text-2xl font-bold">{teacherEmail}</h2>
        </section>
        <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
          <p className="text-white/45">Biriktirilgan guruhlar</p>
          <h2 className="mt-4 text-2xl font-bold">{groups.length}</h2>
        </section>
        <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
          <p className="text-white/45">Tanlangan guruh</p>
          <h2 className="mt-4 text-2xl font-bold">{selectedGroup || "Tanlanmagan"}</h2>
        </section>
        <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
          <p className="text-white/45">Studentlar</p>
          <h2 className="mt-4 text-2xl font-bold">{groupStudents.length}</h2>
        </section>
      </div>

      <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <label className="flex-1">
            <span className="mb-2 block text-sm text-white/45">Guruh</span>
            <select
              value={selectedGroup}
              onChange={(event) => setSelectedGroup(event.target.value)}
              className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.name}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="mb-2 block text-sm text-white/45">Lesson nomi</span>
            <input value={lessonTitle} onChange={(event) => setLessonTitle(event.target.value)} className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none" />
          </label>
          <label className="flex-1">
            <span className="mb-2 block text-sm text-white/45">Mavzu</span>
            <input value={lessonTopic} onChange={(event) => setLessonTopic(event.target.value)} className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none" />
          </label>
          <label className="w-full xl:w-52">
            <span className="mb-2 block text-sm text-white/45">Sana</span>
            <input value={lessonDate} onChange={(event) => setLessonDate(event.target.value)} className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none" />
          </label>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-white/35">Sozlamalar</p>
            <h2 className="mt-2 text-2xl font-bold">Parolni yangilash</h2>
          </div>
          {passwordToast ? <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/80">{passwordToast}</div> : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
          <label>
            <span className="mb-2 block text-sm text-white/45">Joriy parol</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm text-white/45">Yangi parol</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void handlePasswordChange()}
            disabled={passwordBusy}
            className="self-end rounded-2xl bg-gradient-to-r from-blue-500 to-sky-400 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {passwordBusy ? "Yangilanmoqda..." : "Parolni saqlash"}
          </button>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-white/35">Lesson history</p>
            <h2 className="mt-2 text-2xl font-bold">So'nggi saqlangan darslar</h2>
          </div>
          <p className="text-sm text-white/45">{selectedGroup || "Guruh tanlang"}</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recentLessons.length ? (
            recentLessons.map((lesson) => (
              <article key={`${lesson.group}-${lesson.date}-${lesson.lesson}`} className="rounded-[20px] border border-white/8 bg-[#0b1120] p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-white/35">{lesson.lesson}</p>
                <h3 className="mt-3 text-lg font-semibold">{lesson.topic || "Mavzu kiritilmagan"}</h3>
                <p className="mt-2 text-sm text-white/45">{lesson.date}</p>
              </article>
            ))
          ) : (
            <p className="text-white/55">Bu guruh uchun hali dars tarixi yo'q.</p>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-white/35">Teacher workspace</p>
            <h2 className="mt-2 text-2xl font-bold">{teacherName}</h2>
          </div>
          {toast ? <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/80">{toast}</div> : null}
        </div>

        <div className="mt-5 space-y-4">
          {groupStudents.length ? (
            groupStudents.map((student) => {
              const draft = drafts[student.id] ?? defaultDraft();
              const isLocked = Boolean(savedKeys[`${student.id}-${lessonDate}`]);
              return (
                <div key={student.id} className="rounded-[22px] border border-white/8 bg-[#0b1120] p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">{student.fullName}</h3>
                      <p className="mt-1 text-sm text-white/45">{student.group} · {student.phone}</p>
                      {isLocked ? <p className="mt-2 text-sm text-emerald-300">{lessonDate} uchun davomat allaqachon saqlangan.</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void saveStudentRow(student)}
                      disabled={busyKey === student.id || isLocked}
                      className="rounded-2xl bg-gradient-to-r from-blue-500 to-sky-400 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busyKey === student.id ? "Saqlanmoqda..." : isLocked ? "Bugun yopilgan" : "Davomat + baho saqlash"}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <label>
                      <span className="mb-2 block text-sm text-white/45">Holat</span>
                      <select
                        value={draft.status}
                        onChange={(event) => updateDraft(student.id, { status: event.target.value as AttendanceDraft["status"] })}
                        disabled={isLocked}
                        className="w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-white outline-none"
                      >
                        <option value="present">Keldi</option>
                        <option value="late">Kechikdi</option>
                        <option value="absent">Kelmadi</option>
                      </select>
                    </label>
                    <label>
                      <span className="mb-2 block text-sm text-white/45">Sabab</span>
                      <select
                        value={draft.reason}
                        onChange={(event) =>
                          updateDraft(student.id, {
                            reason: event.target.value as AttendanceDraft["reason"],
                          })
                        }
                        disabled={isLocked || draft.status !== "absent"}
                        className="w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-white outline-none disabled:opacity-50"
                      >
                        <option value="no_reason">Sababsiz</option>
                        <option value="sick">Kasal</option>
                        <option value="permission">Ruxsat bilan</option>
                      </select>
                    </label>
                    <label>
                      <span className="mb-2 block text-sm text-white/45">Participation</span>
                      <select
                        value={draft.participation}
                        onChange={(event) => updateDraft(student.id, { participation: Number(event.target.value) })}
                        disabled={isLocked || draft.status === "absent"}
                        className="w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-white outline-none"
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="mb-2 block text-sm text-white/45">Daily grade</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={draft.dailyGrade}
                        onChange={(event) => updateDraft(student.id, { dailyGrade: Number(event.target.value) })}
                        disabled={isLocked || draft.status === "absent"}
                        className="w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-white outline-none"
                      />
                    </label>
                    <label className="flex items-end">
                      <span className="mr-3 text-sm text-white/45">Homework done</span>
                      <input
                        type="checkbox"
                        checked={draft.homeworkDone}
                        onChange={(event) => updateDraft(student.id, { homeworkDone: event.target.checked })}
                        disabled={isLocked || draft.status === "absent"}
                        className="h-5 w-5"
                      />
                    </label>
                    <label className="md:col-span-2 xl:col-span-1">
                      <span className="mb-2 block text-sm text-white/45">Comment</span>
                      <input
                        value={draft.comment}
                        onChange={(event) => updateDraft(student.id, { comment: event.target.value })}
                        disabled={isLocked}
                        placeholder="Izoh"
                        className="w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-sm text-white/45">Kechikish minuti</span>
                      <input
                        type="number"
                        min={0}
                        value={draft.lateMinutes}
                        onChange={(event) => updateDraft(student.id, { lateMinutes: Number(event.target.value) })}
                        disabled={isLocked || draft.status !== "late"}
                        className="w-full rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-white outline-none disabled:opacity-50"
                      />
                    </label>
                    <label className="flex items-end">
                      <span className="mr-3 text-sm text-white/45">Erta chiqib ketdi</span>
                      <input
                        type="checkbox"
                        checked={draft.earlyLeave}
                        onChange={(event) => updateDraft(student.id, { earlyLeave: event.target.checked })}
                        disabled={isLocked || draft.status !== "late"}
                        className="h-5 w-5"
                      />
                    </label>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-white/55">Bu teacherga hali guruh yoki student biriktirilmagan.</p>
          )}
        </div>
      </section>
    </div>
  );
}
