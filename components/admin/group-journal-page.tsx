"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AttendanceState, DashboardResponse, Student } from "@/lib/types";
import { dayShell, sidebarItems, type AttendanceLessonDraft, type ThemeMode } from "@/components/admin/constants";
import { apiVoid, ClientApiError } from "@/lib/client/http";
import { PanelHero } from "@/components/admin/ui";

type ParaDraft = {
  recordId?: string;
  label: string;
  status: AttendanceState;
  reason: "sick" | "permission" | "no_reason";
  earlyLeave: boolean;
  score: number;
  note: string;
  saved: boolean;
  touched?: boolean;
};

type RowDraft = {
  activePara: string;
  paras: ParaDraft[];
  saveState?: "idle" | "saving" | "saved" | "error";
  error?: string;
};

type GroupJournalPageProps = {
  adminName: string;
  group: DashboardResponse["groups"][number];
  students: Student[];
  billing: DashboardResponse["billing"];
  initialLessons: AttendanceLessonDraft[];
  theme?: ThemeMode;
};

function formatStatus(status: Student["status"]) {
  if (status === "active") return "Faol";
  if (status === "warning") return "Ogohlantirish";
  if (status === "probation") return "Nazorat";
  if (status === "removed") return "Chetlatilgan";
  return "Faol";
}

function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return `${year} M${month}`;
}

function formatMoney(value: number) {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function paraNumber(label: string) {
  const matched = label.match(/(\d+)/);
  return matched ? Number(matched[1]) : 1;
}

function lessonParaLabel(lessonTitle: string) {
  const matched = lessonTitle.match(/(\d+)-para/i);
  return matched ? `${matched[1]}-para` : "1-para";
}

function nextParaLabel(labels: string[]) {
  const max = labels.reduce((currentMax, label) => Math.max(currentMax, paraNumber(label)), 0);
  return `${max + 1}-para`;
}

function lessonMatchesBase(lessonTitle: string, baseLessonTitle: string) {
  return (
    lessonTitle === baseLessonTitle ||
    lessonTitle.startsWith(`${baseLessonTitle} ·`) ||
    lessonTitle.startsWith(`${baseLessonTitle} -`) ||
    lessonTitle.startsWith(`${baseLessonTitle} /`)
  );
}

function normalizeParas(paras: ParaDraft[]) {
  const byLabel = new Map<string, ParaDraft>();
  paras.forEach((para) => {
    const current = byLabel.get(para.label);
    if (!current) {
      byLabel.set(para.label, para);
      return;
    }

    const currentRank = Number(Boolean(current.touched || current.saved || current.recordId));
    const nextRank = Number(Boolean(para.touched || para.saved || para.recordId));
    if (nextRank >= currentRank) {
      byLabel.set(para.label, { ...current, ...para });
    }
  });

  return [...byLabel.values()].sort((a, b) => paraNumber(a.label) - paraNumber(b.label));
}

function buildRowDraft(student: Student, selectedLesson: AttendanceLessonDraft | null): RowDraft {
  if (!selectedLesson) {
    return {
      activePara: "1-para",
      paras: [createParaDraft("1-para", "")],
    };
  }

  const entries = student.attendance
    .filter((item) => item.date === selectedLesson.date && lessonMatchesBase(item.lesson, selectedLesson.title))
    .sort((a, b) => paraNumber(lessonParaLabel(a.lesson)) - paraNumber(lessonParaLabel(b.lesson)));

  if (!entries.length) {
    return {
      activePara: "1-para",
      paras: [createParaDraft("1-para", "")],
    };
  }

  const paras = normalizeParas(entries.map((entry) => ({
    recordId: entry.id,
    label: lessonParaLabel(entry.lesson),
    status: entry.status,
    reason: entry.reason ?? "no_reason",
    earlyLeave: entry.earlyLeave ?? false,
    score: entry.homework ?? 0,
    note: entry.comment ?? "",
    saved: true,
    touched: false,
  })));

  return {
    activePara: paras[0]?.label ?? "1-para",
    paras,
  };
}

function withUpdatedPara(row: RowDraft, paraLabel: string, updater: (para: ParaDraft) => ParaDraft): RowDraft {
  return {
    ...row,
    paras: normalizeParas(row.paras.map((para) => (para.label === paraLabel ? updater(para) : para))),
  };
}

function syncRowWithParaLabels(row: RowDraft, paraLabels: string[], fallbackNote: string) {
  const existing = new Map(normalizeParas(row.paras).map((para) => [para.label, para]));
  const normalizedLabels = [...new Set(paraLabels)].sort((a, b) => paraNumber(a) - paraNumber(b));
  const paras = normalizedLabels.map(
    (label) =>
      existing.get(label) ?? createParaDraft(label, fallbackNote),
  );

  return {
    ...row,
    activePara: normalizedLabels.includes(row.activePara) ? row.activePara : normalizedLabels[0] ?? "1-para",
    paras: normalizeParas(paras),
  };
}

function saveBadgeTone(state: RowDraft["saveState"]) {
  if (state === "saving") return "bg-sky-50 text-sky-700";
  if (state === "saved") return "bg-emerald-50 text-emerald-700";
  if (state === "error") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

function saveBadgeLabel(row: RowDraft) {
  if (row.saveState === "saving") return "Saqlanmoqda";
  if (row.saveState === "saved") return "Saqlandi";
  if (row.saveState === "error") return "Xato";
  return row.paras.some((para) => !para.saved) ? "O'zgargan" : "Tayyor";
}

function paraStatusLabel(para: ParaDraft) {
  if (para.earlyLeave) return "Erta ketdi";
  if (para.status === "late") return "Kechikdi";
  if (para.status === "absent" && para.reason === "permission") return "Sababli";
  if (para.status === "absent" && para.reason === "sick") return "Kasal";
  if (para.status === "absent") return "Kelmadi";
  return "Keldi";
}

function paraStatusTone(para: ParaDraft) {
  if (para.earlyLeave) return "bg-violet-50 text-violet-700";
  if (para.status === "late") return "bg-amber-50 text-amber-700";
  if (para.status === "absent" && para.reason === "permission") return "bg-sky-50 text-sky-700";
  if (para.status === "absent" && para.reason === "sick") return "bg-cyan-50 text-cyan-700";
  if (para.status === "absent") return "bg-rose-50 text-rose-700";
  return "bg-emerald-50 text-emerald-700";
}

function isCheckedPresent(para: ParaDraft) {
  return Boolean(para.touched) && para.status === "present" && para.reason === "no_reason" && !para.earlyLeave;
}

function isCheckedAbsent(para: ParaDraft) {
  return Boolean(para.touched) && para.status === "absent" && para.reason === "no_reason" && !para.earlyLeave;
}

function canSetParaScore(para: ParaDraft) {
  return isCheckedPresent(para);
}

const SCORE_OPTIONS = Array.from({ length: 10 }, (_, index) => (index + 1) * 10);

function createParaDraft(label: string, note: string): ParaDraft {
  return {
    label,
    status: "present",
    reason: "no_reason",
    earlyLeave: false,
    score: 10,
    note,
    saved: false,
    touched: false,
  };
}

export function GroupJournalPage({
  adminName,
  group,
  students,
  billing,
  initialLessons,
  theme = "day",
}: GroupJournalPageProps) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [extraMonths, setExtraMonths] = useState<string[]>([]);
  const [extraLessons, setExtraLessons] = useState<AttendanceLessonDraft[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(initialLessons[0]?.id ?? null);
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().slice(0, 10));
  const [lessonTopic, setLessonTopic] = useState("");
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [lessonParaMap, setLessonParaMap] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [tableFilter, setTableFilter] = useState<"all" | "absent" | "unsaved">("all");
  const [activeTopTab, setActiveTopTab] = useState<"Overview" | "Attendance" | "History" | "Lessons" | "Students">("Attendance");

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const storedMonths = window.localStorage.getItem(`group-months-${group.id}`);
    const storedParas = window.localStorage.getItem(`group-lesson-paras-${group.id}`);

    if (storedMonths) {
      try {
        setExtraMonths(JSON.parse(storedMonths) as string[]);
      } catch {
        setExtraMonths([]);
      }
    }

    if (storedParas) {
      try {
        setLessonParaMap(JSON.parse(storedParas) as Record<string, string[]>);
      } catch {
        setLessonParaMap({});
      }
    }
  }, [group.id]);

  useEffect(() => {
    window.localStorage.setItem(`group-months-${group.id}`, JSON.stringify(extraMonths));
  }, [extraMonths, group.id]);

  useEffect(() => {
    window.localStorage.setItem(`group-lesson-paras-${group.id}`, JSON.stringify(lessonParaMap));
  }, [group.id, lessonParaMap]);

  const lessons = useMemo(() => {
    const map = new Map<string, AttendanceLessonDraft>();
    [...initialLessons, ...extraLessons].forEach((lesson) => map.set(lesson.id, lesson));
    return [...map.values()].sort((a, b) => {
      if (a.date === b.date) return a.title.localeCompare(b.title, undefined, { numeric: true });
      return a.date.localeCompare(b.date);
    });
  }, [extraLessons, initialLessons]);

  const monthCards = useMemo(() => {
    const counts = new Map<string, number>();
    lessons.forEach((lesson) => {
      const monthKey = monthKeyFromDate(lesson.date);
      counts.set(monthKey, (counts.get(monthKey) ?? 0) + 1);
    });

    const merged = [...new Set([...extraMonths, ...counts.keys()])].sort((a, b) => b.localeCompare(a));
    return merged.map((monthKey) => ({
      key: monthKey,
      label: monthLabel(monthKey),
      count: counts.get(monthKey) ?? 0,
    }));
  }, [extraMonths, lessons]);

  useEffect(() => {
    if (!monthCards.length) {
      setSelectedMonthKey(null);
      return;
    }

    setSelectedMonthKey((current) => (current && monthCards.some((item) => item.key === current) ? current : monthCards[0].key));
  }, [monthCards]);

  useEffect(() => {
    if (!selectedMonthKey) return;
    const defaultDate = `${selectedMonthKey}-01`;
    setLessonDate((current) => (monthKeyFromDate(current) === selectedMonthKey ? current : defaultDate));
  }, [selectedMonthKey]);

  const visibleLessons = useMemo(
    () => lessons.filter((lesson) => !selectedMonthKey || monthKeyFromDate(lesson.date) === selectedMonthKey),
    [lessons, selectedMonthKey],
  );

  useEffect(() => {
    if (!visibleLessons.length) {
      setSelectedLessonId(null);
      return;
    }

    setSelectedLessonId((current) => (current && visibleLessons.some((lesson) => lesson.id === current) ? current : visibleLessons[0].id));
  }, [visibleLessons]);

  const selectedLesson = visibleLessons.find((lesson) => lesson.id === selectedLessonId) ?? visibleLessons[0] ?? null;
  const displayedLessons = visibleLessons;
  const selectedMonthLabel = monthCards.find((item) => item.key === selectedMonthKey)?.label ?? "Joriy oy";
  const studentCount = students.length;
  const paidAmount = billing.reduce((total, item) => total + (item.totalPaid ?? 0), 0);

  useEffect(() => {
    if (!visibleLessons.length) return;

    setLessonParaMap((prev) => {
      let changed = false;
      const next = { ...prev };

      visibleLessons.forEach((lesson) => {
        const inferred = new Set(prev[lesson.id] ?? []);
        inferred.add("1-para");
        students.forEach((student) => {
          student.attendance
            .filter((item) => item.date === lesson.date && lessonMatchesBase(item.lesson, lesson.title))
            .forEach((item) => inferred.add(lessonParaLabel(item.lesson)));
        });

        const nextLabels = [...inferred].sort((a, b) => paraNumber(a) - paraNumber(b));
        if (JSON.stringify(prev[lesson.id] ?? []) !== JSON.stringify(nextLabels)) {
          next[lesson.id] = nextLabels;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [visibleLessons, students]);

  useEffect(() => {
    if (!visibleLessons.length) return;

    setDrafts((prev) => {
      const next = { ...prev };
      let changed = false;

      visibleLessons.forEach((lesson) => {
        const paraLabels = lessonParaMap[lesson.id] ?? ["1-para"];
        students.forEach((student) => {
          const rowId = getRowId(student.id, lesson);
          const base = prev[rowId] ?? buildRowDraft(student, lesson);
          const synced = syncRowWithParaLabels(base, paraLabels, "");
          if (JSON.stringify(prev[rowId]) !== JSON.stringify(synced)) {
            next[rowId] = synced;
            changed = true;
          }
        });
      });

      return changed ? next : prev;
    });
  }, [visibleLessons, students, lessonParaMap]);

  function nextLessonTitle() {
    const max = lessons.reduce((currentMax, lesson) => {
      const matched = lesson.title.match(/(\d+)/);
      return Math.max(currentMax, matched ? Number(matched[1]) : 0);
    }, 0);
    return `${max + 1}-dars`;
  }

  function getRowId(studentId: string, lesson: AttendanceLessonDraft | null = selectedLesson) {
    return `${studentId}-${lesson?.id ?? "default"}`;
  }

  function ensureRowDraft(student: Student, lesson: AttendanceLessonDraft | null = selectedLesson) {
    const rowId = getRowId(student.id, lesson);
    return drafts[rowId] ?? buildRowDraft(student, lesson);
  }

  function updateRowDraft(student: Student, updater: (draft: RowDraft) => RowDraft, lesson: AttendanceLessonDraft | null = selectedLesson) {
    const rowId = getRowId(student.id, lesson);
    setDrafts((prev) => {
      const current = prev[rowId] ?? buildRowDraft(student, lesson);
      return {
        ...prev,
        [rowId]: updater(current),
      };
    });
  }

  function handleCreateMonth() {
    const latestMonth = monthCards[0]?.key ?? new Date().toISOString().slice(0, 7);
    const nextMonthDate = new Date(`${latestMonth}-01T00:00:00`);
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;

    setExtraMonths((prev) => (prev.includes(nextMonthKey) ? prev : [nextMonthKey, ...prev]));
    setSelectedMonthKey(nextMonthKey);
    setToast(`${monthLabel(nextMonthKey)} oyi qo'shildi.`);
  }

  async function handleCreateLesson() {
    if (!selectedMonthKey) {
      setToast("Avval oy qo'shing yoki tanlang.");
      return;
    }

    if (!lessonTopic.trim()) {
      setToast("Dars mavzusini kiriting.");
      return;
    }

    const normalizedDate = monthKeyFromDate(lessonDate) === selectedMonthKey ? lessonDate : `${selectedMonthKey}-01`;
    const lesson: AttendanceLessonDraft = {
      id: `${group.id}-${normalizedDate}-${nextLessonTitle()}`,
      title: nextLessonTitle(),
      date: normalizedDate,
      topic: lessonTopic.trim(),
    };

    try {
      const response = await fetch(`/api/groups/${group.id}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lesson),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; id?: string; title?: string; date?: string; topic?: string };
      if (!response.ok) {
        setToast(payload.error || "Dars yaratilmadi.");
        return;
      }

      const createdLesson: AttendanceLessonDraft = {
        id: String(payload.id ?? lesson.id),
        title: String(payload.title ?? lesson.title),
        date: String(payload.date ?? lesson.date),
        topic: String(payload.topic ?? lesson.topic),
      };

      setExtraLessons((prev) => [createdLesson, ...prev.filter((item) => item.id !== createdLesson.id)]);
      setLessonParaMap((prev) => ({ ...prev, [createdLesson.id]: ["1-para"] }));
      setSelectedLessonId(createdLesson.id);
      setLessonTopic("");
      setToast("Yangi dars qo'shildi.");
    } catch {
      setToast("Dars yaratishda xatolik yuz berdi.");
    }
  }

  function scrollToSection(tab: "Overview" | "Attendance" | "History" | "Lessons" | "Students") {
    setActiveTopTab(tab);
    const targetId =
      tab === "Overview"
        ? "overview-section"
        : tab === "Attendance"
          ? "attendance-section"
          : tab === "History"
            ? "history-section"
            : tab === "Lessons"
              ? "lessons-section"
              : "students-section";

    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleAddParaToLesson(lesson: AttendanceLessonDraft) {
    const currentLabels = lessonParaMap[lesson.id] ?? ["1-para"];
    const nextLabel = nextParaLabel(currentLabels);

    setLessonParaMap((prev) => {
      const current = prev[lesson.id] ?? ["1-para"];
      return current.includes(nextLabel) ? prev : { ...prev, [lesson.id]: [...current, nextLabel] };
    });

    students.forEach((student) => {
      updateRowDraft(
        student,
        (draft) => ({
          ...draft,
          activePara: nextLabel,
          paras: normalizeParas(draft.paras.some((para) => para.label === nextLabel)
            ? draft.paras
            : [...draft.paras, createParaDraft(nextLabel, "")]),
          saveState: "idle",
          error: undefined,
        }),
        lesson,
      );
    });
  }

  async function handleSave(student: Student, lesson: AttendanceLessonDraft | null = selectedLesson) {
    if (!lesson) {
      setToast("Avval dars tanlang.");
      return;
    }

    const rowId = getRowId(student.id, lesson);
    const row = ensureRowDraft(student, lesson);
    const parasToSave = row.paras.filter((para) => para.touched && !para.saved);
    if (!parasToSave.length) {
      setToast(`${student.fullName} uchun saqlanadigan o'zgarish yo'q.`);
      return;
    }

    if (!row.paras.length) {
      setToast("Para topilmadi.");
      return;
    }

    try {
      setDrafts((prev) => ({
        ...prev,
        [rowId]: { ...row, saveState: "saving", error: undefined },
      }));

      for (const para of parasToSave) {
        const payloadBody = {
          studentId: student.id,
          date: lesson.date,
          lessonTitle: `${lesson.title} · ${para.label}`,
          topic: lesson.topic,
          status: para.status,
          reason: para.reason,
          lateMinutes: para.status === "late" ? 10 : 0,
          earlyLeave: para.earlyLeave,
          participationScore: para.status === "absent" ? 1 : 3,
          homeworkStatus: para.status === "absent" ? "not_done" : para.score > 0 ? "done" : "not_done",
          dailyGrade: para.status === "absent" ? 0 : Number(para.score),
          comment: para.note.trim(),
          maxScore: 100,
        };

        const response = para.recordId
          ? await fetch(`/api/attendance/${para.recordId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payloadBody),
            })
          : await fetch("/api/teacher/lesson-entry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payloadBody),
            });

        const payload = (await response.json().catch(() => ({}))) as { error?: string; record?: { id?: string } };
        if (!response.ok) {
          setDrafts((prev) => ({
            ...prev,
            [rowId]: { ...(prev[rowId] ?? row), saveState: "error", error: payload.error || `${para.label} saqlanmadi.` },
          }));
          setToast(payload.error || `${student.fullName} uchun ${para.label} saqlanmadi.`);
          return;
        }

        updateRowDraft(student, (draft) => ({
          ...withUpdatedPara(draft, para.label, (current) => ({
            ...current,
            recordId: para.recordId ?? payload.record?.id ?? current.recordId,
            saved: true,
            touched: true,
          })),
          saveState: "saving",
          error: undefined,
        }), lesson);
      }

      updateRowDraft(student, (draft) => ({
        ...draft,
        saveState: "saved",
        error: undefined,
      }), lesson);
      setToast(`${student.fullName} uchun ${lesson.title} saqlandi.`);
      router.refresh();
    } catch (error) {
      setDrafts((prev) => ({
        ...prev,
        [rowId]: { ...row, saveState: "error", error: error instanceof ClientApiError ? error.message : "Saqlashda xatolik yuz berdi." },
      }));
      setToast(error instanceof ClientApiError ? error.message : "Saqlashda xatolik yuz berdi.");
    }
  }

  async function handleSaveAll() {
    for (const student of filteredStudents) {
      for (const lesson of displayedLessons) {
        const row = ensureRowDraft(student, lesson);
        if (row.paras.some((para) => para.touched && !para.saved)) {
          await handleSave(student, lesson);
        }
      }
    }
  }

  function setBulkStatus(status: AttendanceState) {
    filteredStudents.forEach((student) => {
      updateRowDraft(student, (draft) => ({
        ...withUpdatedPara(draft, draft.activePara, (para) => ({
          ...para,
          status,
          reason: status === "absent" ? "no_reason" : "no_reason",
          earlyLeave: false,
          score: status === "absent" ? 0 : para.score,
          saved: false,
          touched: true,
        })),
        saveState: "idle",
        error: undefined,
      }));
    });
  }

  async function handleLogout() {
    await apiVoid("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  const filteredStudents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return students.filter((student) => {
      if (normalizedQuery) {
        const haystack = `${student.fullName} ${student.phone}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }

      if (
        tableFilter === "absent" &&
        !displayedLessons.some((lesson) => {
          const row = ensureRowDraft(student, lesson);
          return row.paras.some((para) => (para.touched || para.saved || para.recordId) && para.status === "absent");
        })
      ) {
        return false;
      }

      if (
        tableFilter === "unsaved" &&
        !displayedLessons.some((lesson) => {
          const row = ensureRowDraft(student, lesson);
          return row.paras.some((para) => para.touched && !para.saved);
        })
      ) {
        return false;
      }

      return true;
    });
  }, [students, searchQuery, tableFilter, drafts, displayedLessons]);

  const summary = useMemo(() => {
    return filteredStudents.reduce(
      (acc, student) => {
        displayedLessons.forEach((lesson) => {
          const row = ensureRowDraft(student, lesson);
          row.paras.forEach((para) => {
            const hasStatus = para.touched || para.saved || para.recordId;
            const isDirty = para.touched && !para.saved;
            if (hasStatus && para.status === "present") acc.present += 1;
            if (hasStatus && para.status === "absent") acc.absent += 1;
            if (hasStatus && para.status === "late") acc.late += 1;
            if (para.reason === "permission") acc.excused += 1;
            if (para.earlyLeave) acc.earlyLeave += 1;
            if (hasStatus) {
              acc.totalScore += para.score;
              acc.totalParas += 1;
            }
            if (isDirty) acc.unsaved += 1;
          });
        });
        return acc;
      },
      { present: 0, absent: 0, late: 0, excused: 0, earlyLeave: 0, unsaved: 0, totalScore: 0, totalParas: 0 },
    );
  }, [filteredStudents, drafts, displayedLessons]);

  const averageScore = Math.round(summary.totalScore / Math.max(summary.totalParas, 1));

  return (
    <main className={dayShell.shell}>
      <div className="flex h-screen w-full gap-4 overflow-hidden p-2 md:gap-5 md:p-4">
        <aside className={`relative z-20 hidden h-[calc(100vh-1rem)] w-[250px] shrink-0 flex-col rounded-[28px] border p-4 lg:sticky lg:top-2 lg:flex ${dayShell.sidebar}`}>
          <div className={`flex items-center gap-4 rounded-[22px] border p-4 ${dayShell.panelSoft}`}>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-xl text-white">
              🎓
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.26em] text-slate-400">Course center</p>
              <h1 className="text-xl font-bold">Kurs Boshqaruv</h1>
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            {sidebarItems.map((item) => {
              const isActive = item.id === "groups";
              return (
                <Link
                  key={item.id}
                  href="/admin"
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                    isActive ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-xl text-sm ${isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-950"}`}>{item.icon}</span>
                  <span className="text-base">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="mt-auto flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
          >
            ⎋ Chiqish
          </button>
        </aside>

        <section className={`min-h-0 flex h-[calc(100vh-1rem)] min-w-0 flex-1 flex-col overflow-hidden rounded-[30px] border px-3 py-3 md:px-5 md:py-4 ${dayShell.panel}`}>
          <header className={`relative z-10 shrink-0 rounded-[26px] border p-4 md:p-5 ${dayShell.panelSoft}`}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-base text-slate-500">Xush kelibsiz</p>
                <h2 className="text-2xl font-bold md:text-4xl">{adminName}</h2>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/admin" className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800">
                  ← Guruhlarga qaytish
                </Link>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
                  {group.teacher}
                </div>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900"
                >
                  Chiqish
                </button>
              </div>
            </div>
          </header>

          <div className="mt-4 shrink-0 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {sidebarItems.map((item) => (
              <Link
                key={item.id}
                href="/admin"
                className={`shrink-0 rounded-2xl border px-4 py-3 text-sm font-medium ${
                  item.id === "groups" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </div>

          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-6 pb-4">
              <div id="overview-section">
                <PanelHero
                  badge="Lesson Jurnali"
                  title="Dars jurnali"
                  description="Avval oy qo'shing yoki tanlang, keyin shu oy ichida darslarni va student natijalarini boshqaring."
                  tone="teal"
                  theme={theme}
                  stats={[
                    { label: "Guruh", value: group.name },
                    { label: "Darslar", value: String(lessons.length) },
                    { label: "Studentlar", value: String(studentCount) },
                  ]}
                  actions={
                    <>
                      <span className="rounded-[18px] bg-white/70 px-5 py-3 text-sm font-semibold text-slate-700">{group.schedule}</span>
                      <span className="rounded-[18px] bg-white/70 px-5 py-3 text-sm font-semibold text-slate-700">{group.room}</span>
                      <span className="rounded-[18px] bg-white/70 px-5 py-3 text-sm font-semibold text-slate-700">
                        {formatMoney(paidAmount)} so'm
                      </span>
                    </>
                  }
                />
              </div>

              <section id="history-section" className="rounded-[28px] border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                  <div className="rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">🗂 Oy bo'yicha filter</div>
                  <button type="button" onClick={handleCreateMonth} className="rounded-full border border-sky-300 bg-white px-5 py-3 text-sm font-semibold text-sky-700">
                    ＋ Yangi oy qo'shish
                  </button>
                </div>

                <div className="px-6 py-6">
                  <div className="flex flex-wrap gap-4">
                    {monthCards.length ? (
                      monthCards.map((month) => {
                        const active = month.key === selectedMonthKey;
                        return (
                          <button
                            key={month.key}
                            type="button"
                            onClick={() => setSelectedMonthKey(month.key)}
                            className={`min-w-[190px] rounded-[20px] border px-6 py-5 text-left transition ${
                              active ? "border-sky-300 bg-gradient-to-br from-sky-500 to-cyan-400 text-white" : "border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-semibold">{month.label}</span>
                              <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                                {month.count}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500">Hozircha oy yo'q. Yangi oy qo'shib boshlang.</p>
                    )}
                  </div>
                </div>
              </section>

              <section id="attendance-section" className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(148,163,184,0.14)]">
                <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] px-6 py-5">
                  <div className="flex items-start gap-8 overflow-x-auto pb-1">
                    <div className="shrink-0 rounded-[28px] border border-slate-100 bg-[#f7faff] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                      <div className="flex items-center gap-2">
                        {["Overview", "Attendance", "History", "Lessons", "Students"].map((tab) => {
                          const active = tab === activeTopTab;
                          return (
                            <button
                              type="button"
                              key={tab}
                              onClick={() => scrollToSection(tab as "Overview" | "Attendance" | "History" | "Lessons" | "Students")}
                              className={`inline-flex min-w-[150px] items-center justify-center rounded-[22px] px-5 py-4 text-sm font-semibold ${
                                active ? "bg-white text-emerald-600 shadow-[0_8px_20px_rgba(148,163,184,0.18)]" : "text-slate-500"
                              }`}
                            >
                              {tab}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex min-w-max items-start gap-12 pt-2">
                      {displayedLessons.map((lesson) => {
                        const active = selectedLessonId === lesson.id;
                        return (
                        <button
                          type="button"
                          key={`top-${lesson.id}`}
                          onClick={() => setSelectedLessonId(lesson.id)}
                          className={`w-[196px] rounded-[20px] px-3 py-2 text-left transition ${
                            active ? "bg-[#f7fbff] shadow-[0_8px_20px_rgba(148,163,184,0.14)]" : "hover:bg-[#f8fbff]"
                          }`}
                        >
                          <p className="text-[15px] font-semibold text-slate-700">
                            {new Date(lesson.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-slate-500">
                            {lesson.topic || "Mavzu belgilanmagan"}
                          </p>
                        </button>
                      )})}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <h2 className="text-3xl font-bold tracking-tight text-slate-900">{selectedMonthLabel} attendance board</h2>
                      <p className="mt-1 text-sm text-slate-500">{displayedLessons.length} ta dars va {filteredStudents.length} ta student ko‘rinmoqda</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">Keldi: {summary.present}</span>
                      <span className="rounded-full bg-rose-50 px-3 py-1.5 font-semibold text-rose-700">Kelmadi: {summary.absent}</span>
                      <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">Saqlanmagan: {summary.unsaved}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">O'rtacha: {averageScore}%</span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6">
                  <div id="lessons-section" className="grid gap-3 lg:grid-cols-[180px_1fr_1fr_180px_auto]">
                    <input
                      type="date"
                      value={lessonDate}
                      onChange={(event) => setLessonDate(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    />
                    <input
                      value={lessonTopic}
                      onChange={(event) => setLessonTopic(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      placeholder="Dars mavzusi"
                    />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                      placeholder="Student qidirish"
                    />
                    <select
                      value={tableFilter}
                      onChange={(event) => setTableFilter(event.target.value as "all" | "absent" | "unsaved")}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none"
                    >
                      <option value="all">Barchasi</option>
                      <option value="absent">Faqat kelmaganlar</option>
                      <option value="unsaved">Faqat saqlanmaganlar</option>
                    </select>
                    <div className="flex gap-3">
                      <button type="button" onClick={handleCreateLesson} className="rounded-[18px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
                        + Yangi dars
                      </button>
                      <button type="button" onClick={() => void handleSaveAll()} className="rounded-[18px] border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
                        Hammasini saqlash
                      </button>
                    </div>
                  </div>

                  <div id="students-section" className="mt-4 overflow-x-auto">
                    <div
                      className="grid min-w-max gap-x-3 gap-y-3"
                      style={{ gridTemplateColumns: `240px repeat(${Math.max(displayedLessons.length, 1)}, 196px)` }}
                    >
                      <div className="rounded-[28px] border border-slate-100 bg-[#f8fbff] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                        <p className="text-sm font-semibold text-slate-400">Attendance</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{group.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{group.teacher}</p>
                      </div>

                      {displayedLessons.map((lesson) => (
                        <div
                          key={lesson.id}
                          className={`flex min-h-[92px] flex-col justify-center rounded-[22px] px-3 py-2 transition ${
                            selectedLessonId === lesson.id ? "bg-[#f7fbff] shadow-[0_8px_20px_rgba(148,163,184,0.12)]" : ""
                          }`}
                        >
                          <p className="text-[15px] font-semibold text-slate-700">{new Date(lesson.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                          <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-slate-500">{lesson.topic || "Mavzu kiritilmagan"}</p>
                        </div>
                      ))}

                      {filteredStudents.map((student) => {
                        const displayStatus =
                          student.status === "warning" || student.status === "probation" || student.status === "removed" ? student.status : "active";

                        return (
                          <Fragment key={student.id}>
                            <div className="flex min-h-[118px] items-center rounded-[26px] border border-slate-100 bg-white px-5 py-5 shadow-[0_12px_30px_rgba(148,163,184,0.08)]">
                              <div>
                                <p className="text-[18px] font-semibold text-slate-900">{student.fullName}</p>
                                <p className="mt-1 text-sm text-slate-400">{student.phone || "Telefon yo'q"}</p>
                                <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  displayStatus === "active"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : displayStatus === "warning"
                                      ? "bg-amber-50 text-amber-700"
                                      : displayStatus === "probation"
                                        ? "bg-sky-50 text-sky-700"
                                        : "bg-rose-50 text-rose-700"
                                }`}>
                                  {formatStatus(displayStatus)}
                                </span>
                              </div>
                            </div>

                            {displayedLessons.map((lesson) => {
                              const row = ensureRowDraft(student, lesson);
                              const unsaved = row.paras.some((item) => item.touched && !item.saved);

                              return (
                                <div
                                  key={`${student.id}-${lesson.id}`}
                                  className={`min-h-[118px] rounded-[28px] border p-4 shadow-[0_12px_30px_rgba(148,163,184,0.08)] ${
                                    selectedLessonId === lesson.id ? "border-sky-200 bg-[#f8fbff]" : "border-slate-100 bg-[#fbfdff]"
                                  }`}
                                >
                                  <div className="space-y-3">
                                    {row.paras.map((para) => {
                                      const isPresent = isCheckedPresent(para);
                                      const isAbsent = isCheckedAbsent(para);
                                      const canSetScore = isPresent;

                                      return (
                                        <div key={`${student.id}-${lesson.id}-${para.label}-${para.recordId ?? "draft"}`} className="rounded-[22px] border border-slate-100 bg-white/80 p-3">
                                          <div className="mb-2 flex items-center justify-between gap-2">
                                            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{para.label}</span>
                                            {isPresent ? (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  updateRowDraft(student, (draft) => ({
                                                    ...withUpdatedPara(draft, para.label, (current) => ({
                                                      ...current,
                                                      status: "present",
                                                      reason: "no_reason",
                                                      earlyLeave: false,
                                                      saved: false,
                                                      touched: true,
                                                    })),
                                                    activePara: para.label,
                                                    saveState: "idle",
                                                    error: undefined,
                                                  }), lesson)
                                                }
                                                className="inline-flex rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                                              >
                                                Keldi
                                              </button>
                                            ) : isAbsent ? (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  updateRowDraft(student, (draft) => ({
                                                    ...withUpdatedPara(draft, para.label, (current) => ({
                                                      ...current,
                                                      status: "absent",
                                                      reason: "no_reason",
                                                      earlyLeave: false,
                                                      score: 0,
                                                      saved: false,
                                                      touched: true,
                                                    })),
                                                    activePara: para.label,
                                                    saveState: "idle",
                                                    error: undefined,
                                                  }), lesson)
                                                }
                                                className="inline-flex rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700"
                                              >
                                                Kelmadi
                                              </button>
                                            ) : (
                                              <div className="flex gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    updateRowDraft(student, (draft) => ({
                                                      ...withUpdatedPara(draft, para.label, (current) => ({
                                                        ...current,
                                                        status: "present",
                                                        reason: "no_reason",
                                                        earlyLeave: false,
                                                        saved: false,
                                                        touched: true,
                                                      })),
                                                      activePara: para.label,
                                                      saveState: "idle",
                                                      error: undefined,
                                                    }), lesson)
                                                  }
                                                  className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500"
                                                >
                                                  ✓
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    updateRowDraft(student, (draft) => ({
                                                      ...withUpdatedPara(draft, para.label, (current) => ({
                                                        ...current,
                                                        status: "absent",
                                                        reason: "no_reason",
                                                        earlyLeave: false,
                                                        score: 0,
                                                        saved: false,
                                                        touched: true,
                                                      })),
                                                      activePara: para.label,
                                                      saveState: "idle",
                                                      error: undefined,
                                                    }), lesson)
                                                  }
                                                  className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            )}
                                          </div>

                                          <label className={`relative flex h-10 items-center overflow-hidden rounded-full border ${canSetScore ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}>
                                            <select
                                              value={canSetScore ? String(para.score || "") : ""}
                                              disabled={!canSetScore}
                                              onChange={(event) =>
                                                updateRowDraft(student, (draft) => ({
                                                  ...withUpdatedPara(draft, para.label, (current) => ({
                                                    ...current,
                                                    score: event.target.value ? Number(event.target.value) : current.score,
                                                    saved: false,
                                                    touched: true,
                                                  })),
                                                  activePara: para.label,
                                                  saveState: "idle",
                                                  error: undefined,
                                                }), lesson)
                                              }
                                              className={`w-full appearance-none bg-transparent px-4 text-sm font-semibold outline-none ${canSetScore ? "text-slate-700" : "text-slate-300"}`}
                                            >
                                              <option value="">{canSetScore ? "Baho" : "Baho"}</option>
                                              {SCORE_OPTIONS.map((score) => (
                                                <option key={score} value={score}>
                                                  {score}%
                                                </option>
                                              ))}
                                            </select>
                                          </label>

                                          <input
                                            value={para.note}
                                            onChange={(event) =>
                                              updateRowDraft(student, (draft) => ({
                                                ...withUpdatedPara(draft, para.label, (current) => ({
                                                  ...current,
                                                  note: event.target.value,
                                                  saved: false,
                                                  touched: true,
                                                })),
                                                activePara: para.label,
                                                saveState: "idle",
                                                error: undefined,
                                              }), lesson)
                                            }
                                            placeholder="Sabab: topshiriq chala"
                                            className="mt-2 h-10 w-full rounded-full border border-slate-200 bg-white px-4 text-sm outline-none placeholder:text-slate-400"
                                          />
                                        </div>
                                      );
                                    })}

                                    <div className="flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleAddParaToLesson(lesson)}
                                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                                      >
                                        + Para
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleSave(student, lesson)}
                                        className={`rounded-full px-3 py-2 text-xs font-semibold ${unsaved ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}
                                      >
                                        {unsaved ? "Saqlash" : "Saqlandi"}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>

        {toast ? (
          <div className="fixed bottom-5 right-5 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
            {toast}
          </div>
        ) : null}
      </div>
    </main>
  );
}
