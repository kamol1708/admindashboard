"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AttendanceState, DashboardResponse, Student, StudentInsight, StudentStatus } from "@/lib/types";
import { ActionButton, InfoCard, PanelHero, QuickActionCard } from "@/components/admin/ui";
import { billingStatusLabel, billingStatusTone, formatCurrency } from "@/lib/ui/billing-formatters";

type ThemeMode = "day" | "night";
type StudentFilter = "all" | "active" | "risk" | "debt";
type StudentSort = "name" | "attendance" | "balance";
type StudentPaymentFilter = "all" | "paid" | "partial" | "unpaid" | "overdue";
type StudentDetailTab = "overview" | "attendance" | "grades" | "payments";

const statusTone: Record<StudentStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  probation: "bg-sky-500/15 text-sky-300",
  removed: "bg-rose-500/15 text-rose-300",
};

const attendanceTone: Record<AttendanceState, string> = {
  present: "bg-emerald-500/15 text-emerald-300",
  late: "bg-amber-500/15 text-amber-300",
  absent: "bg-rose-500/15 text-rose-300",
};

function formatStatus(status: StudentStatus) {
  if (status === "active") return "Aktiv";
  if (status === "warning") return "Ogohlantirish";
  if (status === "probation") return "Nazorat";
  return "Chetlatilgan";
}

function formatAttendance(status: AttendanceState) {
  if (status === "present") return "Keldi";
  if (status === "late") return "Kechikdi";
  return "Tayyor Emas";
}

function deriveTelegramStatus(student: Student) {
  return student.telegram?.connectedAt ? "Ulangan" : "Ulanmagan";
}

export function StudentsPanel({
  students,
  billing,
  insights,
  selectedStudent,
  onAddStudent,
  onAddPayment,
  onExport,
  onSelectStudent,
  onStatusChange,
  onEditStudent,
  onDeleteStudent,
  onTelegram,
  filter,
  sort,
  page,
  totalPages,
  totalCount,
  onFilterChange,
  onSortChange,
  onPageChange,
  searchQuery,
  groupFilter,
  teacherFilter,
  paymentFilter,
  availableGroups,
  availableTeachers,
  onGroupFilterChange,
  onTeacherFilterChange,
  onPaymentFilterChange,
  theme,
}: {
  students: Student[];
  billing: DashboardResponse["billing"];
  insights: StudentInsight[];
  selectedStudent: Student | null;
  onAddStudent: () => void;
  onAddPayment: () => void;
  onExport: () => void;
  onSelectStudent: (id: string) => void;
  onStatusChange: (studentId: string, status: StudentStatus) => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onTelegram: (student: Student) => void;
  filter: StudentFilter;
  sort: StudentSort;
  page: number;
  totalPages: number;
  totalCount: number;
  onFilterChange: (value: StudentFilter) => void;
  onSortChange: (value: StudentSort) => void;
  onPageChange: (value: number) => void;
  searchQuery: string;
  groupFilter: string;
  teacherFilter: string;
  paymentFilter: StudentPaymentFilter;
  availableGroups: string[];
  availableTeachers: string[];
  onGroupFilterChange: (value: string) => void;
  onTeacherFilterChange: (value: string) => void;
  onPaymentFilterChange: (value: StudentPaymentFilter) => void;
  theme: ThemeMode;
}) {
  const [detailTab, setDetailTab] = useState<StudentDetailTab>("overview");
  const uniqueAvailableGroups = useMemo(() => [...new Set(availableGroups)], [availableGroups]);
  const uniqueAvailableTeachers = useMemo(() => [...new Set(availableTeachers)], [availableTeachers]);
  const billingByStudentId = new Map(billing.map((item) => [item.studentId, item]));
  const insightByStudentId = new Map(insights.map((item) => [item.id, item]));
  const selectedStudentBilling = selectedStudent ? billingByStudentId.get(selectedStudent.id) : undefined;
  const selectedStudentInsight = selectedStudent ? insightByStudentId.get(selectedStudent.id) : undefined;
  const selectedStudentGrades = useMemo(
    () => (selectedStudent ? [...selectedStudent.grades].sort((a, b) => b.examDate.localeCompare(a.examDate)) : []),
    [selectedStudent],
  );
  const selectedStudentAttendance = useMemo(
    () => (selectedStudent ? [...selectedStudent.attendance].sort((a, b) => b.date.localeCompare(a.date)) : []),
    [selectedStudent],
  );
  const selectedStudentPayments = useMemo(
    () => (selectedStudent ? [...selectedStudent.payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt)) : []),
    [selectedStudent],
  );
  const attendanceRate = selectedStudent
    ? Math.round(
        (selectedStudent.attendance.filter((item) => item.status === "present").length /
          Math.max(selectedStudent.attendance.length, 1)) *
          100,
      )
    : 0;
  const averageScore = selectedStudent
    ? Math.round(
        selectedStudent.grades.reduce((sum, grade) => sum + (grade.score / grade.maxScore) * 100, 0) /
          Math.max(selectedStudent.grades.length, 1),
      )
    : 0;
  const latestGrade = selectedStudent?.grades[0];
  const latestAttendanceItem = selectedStudent?.attendance[0];
  const lastPayment = selectedStudent?.payments[0];

  return (
    <>
      <PanelHero
        badge="Student markazi"
        title="Student boshqaruvi"
        description="Student yaratish, filtrlash, to'lov va risk holatini bitta ishchi panelda boshqaring."
        tone="blue"
        theme={theme}
        stats={[
          { label: "Jami student", value: String(totalCount) },
          { label: "Faol", value: String(students.filter((item) => item.status === "active").length) },
          { label: "Qarzdor", value: String(students.filter((item) => (billingByStudentId.get(item.id)?.outstanding ?? 0) > 0).length) },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <QuickActionCard
          icon="👤"
          title="Yangi student qo'shish"
          description="Login, guruh, teacher va boshlang'ich to'lov holati bilan studentni tez ro'yxatdan o'tkazing."
          tone="blue"
          theme={theme}
          action={<ActionButton label="+ Student yaratish" primary onClick={onAddStudent} theme={theme} />}
        />
        <QuickActionCard
          icon="💳"
          title="To'lov biriktirish"
          description="Tanlangan studentga yangi to'lov qo'shing va billing holatini darhol yangilang."
          tone="emerald"
          theme={theme}
          action={<ActionButton label="+ To'lov" onClick={onAddPayment} theme={theme} />}
        />
        <QuickActionCard
          icon="⤓"
          title="Ro'yxat eksporti"
          description="Joriy filtrlangan natijalarni chiqarib, hisobot yoki tashqi tekshiruv uchun saqlab oling."
          tone="violet"
          theme={theme}
          action={<ActionButton label="Eksport" onClick={onExport} theme={theme} />}
        />
      </div>

      <div className={`flex flex-col gap-4 rounded-[26px] border p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] xl:flex-row xl:items-center xl:justify-between ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all" as const, label: "Barchasi" },
            { key: "active" as const, label: "Faol" },
            { key: "risk" as const, label: "Risk" },
            { key: "debt" as const, label: "Qarzdor" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onFilterChange(item.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                filter === item.key
                  ? theme === "day"
                    ? "bg-slate-950 text-white"
                    : "bg-sky-500/15 text-sky-300"
                  : theme === "day"
                    ? "bg-slate-100 text-slate-700"
                    : "bg-white/5 text-white/55"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-2 text-xs font-semibold ${theme === "day" ? "bg-slate-100 text-slate-600" : "bg-white/8 text-white/55"}`}>{totalCount} ta natija</span>
          <select
            value={groupFilter}
            onChange={(event) => onGroupFilterChange(event.target.value)}
            className={`rounded-2xl border px-4 py-2 text-sm outline-none ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/8 bg-white/5 text-white"}`}
          >
            <option value="all">Barcha guruhlar</option>
            {uniqueAvailableGroups.map((group, index) => (
              <option key={`${group}-${index}`} value={group}>
                {group}
              </option>
            ))}
          </select>
          <select
            value={teacherFilter}
            onChange={(event) => onTeacherFilterChange(event.target.value)}
            className={`rounded-2xl border px-4 py-2 text-sm outline-none ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/8 bg-white/5 text-white"}`}
          >
            <option value="all">Barcha teacherlar</option>
            {uniqueAvailableTeachers.map((teacher, index) => (
              <option key={`${teacher}-${index}`} value={teacher}>
                {teacher}
              </option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(event) => onPaymentFilterChange(event.target.value as StudentPaymentFilter)}
            className={`rounded-2xl border px-4 py-2 text-sm outline-none ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/8 bg-white/5 text-white"}`}
          >
            <option value="all">Barcha to'lovlar</option>
            <option value="paid">To'langan</option>
            <option value="partial">Qisman to'lagan</option>
            <option value="unpaid">To'lanmagan</option>
            <option value="overdue">Muddati o'tgan</option>
          </select>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as StudentSort)}
            className={`rounded-2xl border px-4 py-2 text-sm outline-none ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-900" : "border-white/8 bg-white/5 text-white"}`}
          >
            <option value="name">Ism bo'yicha</option>
            <option value="attendance">Davomat bo'yicha</option>
            <option value="balance">Balans bo'yicha</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 xl:items-start xl:grid-cols-[minmax(0,1.7fr)_380px]">
        <section className={`self-start rounded-[30px] border p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
          {!students.length ? (
            <div className={`rounded-[22px] border px-5 py-10 text-center ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-500" : "border-white/8 bg-white/5 text-white/50"}`}>
              <p className="text-lg font-semibold">Natija topilmadi</p>
              <p className="mt-2 text-sm">
                {searchQuery ? `"${searchQuery}" bo'yicha mos student topilmadi.` : "Bu filtr bo'yicha student topilmadi."}
              </p>
            </div>
          ) : (
          <div className={`overflow-x-auto rounded-[24px] border ${theme === "day" ? "border-slate-200" : "border-white/8"}`}>
            <div className={`grid min-w-[980px] grid-cols-[1.3fr_1.2fr_1.1fr_0.8fr_0.7fr_0.95fr] gap-4 border-b px-5 py-4 text-[11px] uppercase tracking-[0.18em] ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-500" : "border-white/8 bg-white/[0.03] text-white/35"}`}>
              <span>O'quvchi</span>
              <span>Guruh / kurs</span>
              <span>Ota-ona</span>
              <span>Telegram</span>
              <span>Davomat</span>
              <span>To'lov</span>
            </div>
            {students.map((student) => {
              const total = student.attendance.length;
              const present = student.attendance.filter((item) => item.status === "present").length;
              const attendance = Math.round((present / Math.max(total, 1)) * 100);
              const telegramStatus = deriveTelegramStatus(student);
              const paymentMeta = billingByStudentId.get(student.id);
              const insightMeta = insightByStudentId.get(student.id);
              return (
                <div
                  key={student.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectStudent(student.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectStudent(student.id);
                    }
                  }}
                  className={`grid min-w-[980px] w-full grid-cols-[1.3fr_1.2fr_1.1fr_0.8fr_0.7fr_0.95fr] gap-4 border-b px-5 py-5 text-left transition last:border-b-0 ${theme === "day" ? "border-slate-200 hover:bg-slate-50" : "border-white/8 hover:bg-white/5"}`}
                >
                  <div>
                    <p className="text-[19px] font-semibold leading-7">{student.fullName}</p>
                    <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-500" : "text-white/40"}`}>ID: {student.id.slice(0, 8)} · {student.phone}</p>
                  </div>
                  <div>
                    <p className="text-[15px] font-medium">{student.group}</p>
                    <p className={`mt-1 truncate text-sm ${theme === "day" ? "text-slate-500" : "text-white/40"}`}>{insightMeta?.riskLabel || student.notes.slice(0, 36) || "Izoh yo'q"}</p>
                  </div>
                  <div>
                    <p className="text-base">{student.parentPhone}</p>
                    <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-500" : "text-white/40"}`}>Ota-ona aloqasi</p>
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold ${telegramStatus === "Ulangan" ? "bg-emerald-500/15 text-emerald-300" : theme === "day" ? "bg-slate-100 text-slate-600" : "bg-white/10 text-white/60"}`}>
                      {telegramStatus}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onTelegram(student);
                      }}
                      className={`mt-2 block rounded-xl px-3 py-2 text-xs font-semibold ${theme === "day" ? "bg-sky-50 text-sky-700" : "bg-sky-500/15 text-sky-300"}`}
                    >
                      Telegram
                    </button>
                  </div>
                  <div className="text-[18px] font-semibold">{attendance}%</div>
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold ${billingStatusTone(paymentMeta?.status ?? "unpaid")}`}>
                      {billingStatusLabel(paymentMeta?.status ?? "unpaid")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className={`text-sm ${theme === "day" ? "text-slate-500" : "text-white/40"}`}>
              Sahifa {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(page - 1, 1))}
                disabled={page === 1}
                className={`rounded-xl border px-4 py-2 text-sm disabled:opacity-40 ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-white/8 bg-white/5 text-white/80"}`}
              >
                Oldingi
              </button>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(page + 1, totalPages))}
                disabled={page === totalPages}
                className={`rounded-xl border px-4 py-2 text-sm disabled:opacity-40 ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-white/8 bg-white/5 text-white/80"}`}
              >
                Keyingi
              </button>
            </div>
          </div>
        </section>

        <section className={`rounded-[30px] border p-6 xl:sticky xl:top-5 xl:self-start ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
          {selectedStudent ? (
            <>
              <p className={`text-sm uppercase tracking-[0.28em] ${theme === "day" ? "text-slate-500" : "text-white/35"}`}>Tanlangan o'quvchi</p>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-4xl font-bold leading-tight">{selectedStudent.fullName}</h2>
                  <p className={`mt-3 inline-flex rounded-full px-4 py-2 text-sm font-semibold ${statusTone[selectedStudent.status]}`}>
                    {formatStatus(selectedStudent.status)}
                  </p>
                </div>
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 text-xl font-bold">
                  {selectedStudent.fullName
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")}
                </div>
              </div>

              <div className={`mt-6 rounded-[26px] border p-5 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm uppercase tracking-[0.22em] ${theme === "day" ? "text-slate-500" : "text-white/35"}`}>Progress</span>
                  <span className={`text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>Umumiy holat</span>
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className={theme === "day" ? "text-slate-500" : "text-white/55"}>Davomat</span>
                      <span className="font-semibold">{attendanceRate}%</span>
                    </div>
                    <div className={`h-3 rounded-full ${theme === "day" ? "bg-slate-200" : "bg-white/8"}`}>
                      <div className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${attendanceRate}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className={theme === "day" ? "text-slate-500" : "text-white/55"}>Baholar</span>
                      <span className="font-semibold">{averageScore}%</span>
                    </div>
                    <div className={`h-3 rounded-full ${theme === "day" ? "bg-slate-200" : "bg-white/8"}`}>
                      <div className="h-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${averageScore}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <InfoCard label="Guruh" value={selectedStudent.group} theme={theme} />
                <InfoCard label="Telefon" value={selectedStudent.phone} theme={theme} />
                <InfoCard label="Ota-ona" value={selectedStudent.parentPhone} theme={theme} />
                <InfoCard label="Qolgan qarz" value={formatCurrency(selectedStudentBilling?.outstanding ?? 0)} theme={theme} />
              </div>

              <div className="mt-4">
                <ActionButton label="Telegram ulash" onClick={() => onTelegram(selectedStudent)} theme={theme} />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <InfoCard label="So'nggi baho" value={latestGrade ? `${latestGrade.subject}: ${latestGrade.score}/${latestGrade.maxScore}` : "Mavjud emas"} theme={theme} />
                <InfoCard label="So'nggi davomat" value={latestAttendanceItem ? formatAttendance(latestAttendanceItem.status) : "Mavjud emas"} theme={theme} />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <InfoCard label="To'lov holati" value={billingStatusLabel(selectedStudentBilling?.status ?? "unpaid")} theme={theme} />
                <InfoCard label="Risk holati" value={selectedStudentInsight?.riskLabel ?? "Barqaror"} theme={theme} />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <InfoCard label="Jami to'lagan" value={formatCurrency(selectedStudentBilling?.totalPaid ?? 0)} theme={theme} />
                <InfoCard label="Deadline" value={selectedStudentBilling?.dueDate ?? "Belgilanmagan"} theme={theme} />
              </div>

              <div className={`mt-6 rounded-[24px] border p-2 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { key: "overview" as const, label: "Umumiy" },
                    { key: "attendance" as const, label: "Davomat" },
                    { key: "grades" as const, label: "Baholar" },
                    { key: "payments" as const, label: "To'lovlar" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setDetailTab(tab.key)}
                      className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
                        detailTab === tab.key
                          ? theme === "day"
                            ? "bg-slate-950 text-white"
                            : "bg-sky-500/15 text-sky-300"
                          : theme === "day"
                            ? "bg-white text-slate-700"
                            : "bg-transparent text-white/60"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {detailTab === "overview" ? (
                <>
              <div className={`mt-6 rounded-[26px] border p-5 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
                <p className={`text-sm uppercase tracking-[0.24em] ${theme === "day" ? "text-slate-500" : "text-white/35"}`}>Mentor izohi</p>
                <p className={`mt-3 text-base ${theme === "day" ? "text-slate-700" : "text-white/70"}`}>{selectedStudent.notes}</p>
              </div>
                </>
              ) : null}

              {detailTab === "attendance" ? (
              <div className={`mt-6 rounded-[26px] border p-5 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
                <p className={`text-sm uppercase tracking-[0.24em] ${theme === "day" ? "text-slate-500" : "text-white/35"}`}>Davomat tarixi</p>
                <div className="mt-3 space-y-3">
                  {selectedStudentAttendance.slice(0, 8).map((entry) => (
                    <div key={entry.id} className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-3 ${theme === "day" ? "bg-white" : "bg-black/5"}`}>
                      <div>
                        <p className="font-medium">{entry.lesson}</p>
                        <p className={`text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{entry.date}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold ${attendanceTone[entry.status]}`}>
                        {formatAttendance(entry.status)}
                      </span>
                    </div>
                  ))}
                  {!selectedStudentAttendance.length ? (
                    <div className={`rounded-2xl px-3 py-3 text-sm ${theme === "day" ? "bg-white text-slate-500" : "bg-black/5 text-white/45"}`}>
                      Davomat tarixi hali yo'q.
                    </div>
                  ) : null}
                </div>
              </div>
              ) : null}

              {detailTab === "grades" ? (
              <div className={`mt-6 rounded-[26px] border p-5 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
                <p className={`text-sm uppercase tracking-[0.24em] ${theme === "day" ? "text-slate-500" : "text-white/35"}`}>Baholar tarixi</p>
                <div className="mt-3 space-y-3">
                  {selectedStudentGrades.slice(0, 8).map((grade) => {
                    const percent = Math.round((grade.score / Math.max(grade.maxScore, 1)) * 100);
                    return (
                      <div key={grade.id} className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-3 ${theme === "day" ? "bg-white" : "bg-black/5"}`}>
                        <div>
                          <p className="font-medium">{grade.subject}</p>
                          <p className={`text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{grade.examDate}</p>
                        </div>
                        <span className={`rounded-full px-3 py-2 text-xs font-semibold ${percent >= 80 ? "bg-emerald-500/15 text-emerald-300" : percent >= 60 ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300"}`}>
                          {grade.score}/{grade.maxScore} · {percent}%
                        </span>
                      </div>
                    );
                  })}
                  {!selectedStudentGrades.length ? (
                    <div className={`rounded-2xl px-3 py-3 text-sm ${theme === "day" ? "bg-white text-slate-500" : "bg-black/5 text-white/45"}`}>
                      Baholar tarixi hali yo'q.
                    </div>
                  ) : null}
                </div>
              </div>
              ) : null}

              {detailTab === "payments" ? (
              <div className={`mt-6 rounded-[24px] border p-4 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-sm uppercase tracking-[0.24em] ${theme === "day" ? "text-slate-500" : "text-white/35"}`}>To'lov tarixi</p>
                  <button type="button" onClick={onAddPayment} className="rounded-full bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300">
                    + To'lov
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {selectedStudentPayments.slice(0, 8).map((payment) => (
                    <div key={payment.id} className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-3 ${theme === "day" ? "bg-white" : "bg-black/5"}`}>
                      <div>
                        <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        <p className={`text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
                          {payment.paidAt} · {payment.method}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300">To'langan</span>
                    </div>
                  ))}
                  {!selectedStudent.payments.length ? (
                    <div className={`rounded-2xl px-3 py-3 text-sm ${theme === "day" ? "bg-white text-slate-500" : "bg-black/5 text-white/45"}`}>
                      To'lov tarixi hali yo'q. {lastPayment ? "" : "Birinchi to'lovni admin yozishi mumkin."}
                    </div>
                  ) : null}
                </div>
              </div>
              ) : null}

              <div className="mt-6 grid gap-3">
                <button type="button" onClick={() => onEditStudent(selectedStudent)} className="rounded-2xl bg-slate-500/15 px-4 py-3 text-sm font-semibold text-slate-300">
                  Tahrirlash
                </button>
                <button type="button" onClick={() => onStatusChange(selectedStudent.id, "active")} className="rounded-2xl bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-300">
                  Tiklash
                </button>
                <button type="button" onClick={() => onStatusChange(selectedStudent.id, "warning")} className="rounded-2xl bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-300">
                  Ogohlantirish
                </button>
                <button type="button" onClick={() => onStatusChange(selectedStudent.id, "probation")} className="rounded-2xl bg-sky-500/15 px-4 py-3 text-sm font-semibold text-sky-300">
                  Nazorat
                </button>
                <button type="button" onClick={() => onStatusChange(selectedStudent.id, "removed")} className="rounded-2xl bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-300">
                  Chetlatish
                </button>
                <button type="button" onClick={() => onDeleteStudent(selectedStudent.id)} className="rounded-2xl bg-rose-600/20 px-4 py-3 text-sm font-semibold text-rose-400">
                  Studentni o'chirish
                </button>
              </div>
            </>
          ) : (
            <p className={theme === "day" ? "text-slate-500" : "text-white/55"}>O'quvchini tanlang.</p>
          )}
        </section>
      </div>
    </>
  );
}

export function GroupsPanel({
  groups,
  students,
  billing,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  theme,
}: {
  groups: { id: string; name: string; students: number; attendanceAverage: number; teacher: string; schedule: string; room: string; monthlyFee: number }[];
  students: Student[];
  billing: DashboardResponse["billing"];
  onAddGroup: () => void;
  onEditGroup: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  theme: ThemeMode;
}) {
  if (!groups.length) {
    return (
      <>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold md:text-5xl">Guruhlar</h1>
            <p className={`mt-3 text-base ${theme === "day" ? "text-slate-500" : "text-white/50"}`}>Har bir guruhning mentor, attendance va o'quvchi sig'imi ko'rinadi.</p>
          </div>
          <ActionButton label="+ Guruh yaratish" primary onClick={onAddGroup} theme={theme} />
        </div>
        <section className={`rounded-[28px] border p-6 ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
          <h2 className="text-2xl font-bold">Hali guruh yo'q</h2>
          <p className={`mt-3 text-base ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
            Yangi guruh yaratganingizdan keyin u shu panelda darhol ko'rinadi.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <PanelHero
        badge="Guruhlar markazi"
        title="Guruhlarni boshqarish"
        description="Guruhlar ro'yxatini ko'ring va kerakli guruh jurnaliga alohida sahifa orqali kiring."
        tone="teal"
        theme={theme}
        actions={<ActionButton label="+ Guruh yaratish" primary onClick={onAddGroup} theme={theme} />}
        stats={[
          { label: "Jami guruh", value: String(groups.length) },
          { label: "Faol guruh", value: String(groups.length) },
          { label: "Studentlar", value: String(students.length) },
        ]}
      />

      <div className="grid gap-6">
        {groups.map((group) => {
          const groupStudents = students.filter((student) => student.group === group.name);
          const groupBilling = billing.filter((item) => groupStudents.some((student) => student.id === item.studentId));
          const totalDue = groupBilling.reduce((sum, item) => sum + item.monthlyFee, 0);

          return (
            <section key={group.id} className={`rounded-[30px] border p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-4">
                  <div className="grid h-16 w-16 place-items-center rounded-[18px] bg-gradient-to-br from-emerald-500 to-teal-400 text-3xl font-bold text-white">
                    {group.name[0]}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-[36px] font-bold leading-tight">{group.name}</h2>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">Faol</span>
                    </div>
                    <p className={`mt-2 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
                      🎓 {group.teacher} · 📍 {group.room} · 🗓 {group.schedule}
                    </p>
                    <p className="mt-5 text-base font-semibold text-emerald-600">Ko'proq ma'lumot</p>
                  </div>
                </div>

                <div className="grid gap-3 md:min-w-[420px]">
                  <div className={`rounded-[20px] p-4 ${theme === "day" ? "bg-slate-50" : "bg-white/5"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${theme === "day" ? "text-slate-500" : "text-white/50"}`}>👥 Studentlar</span>
                      <span className="text-3xl font-bold">{group.students}</span>
                    </div>
                  </div>
                  <div className={`rounded-[20px] p-4 ${theme === "day" ? "bg-slate-50" : "bg-white/5"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${theme === "day" ? "text-slate-500" : "text-white/50"}`}>💰 Kurs oylik to'lovi</span>
                      <span className="text-3xl font-bold">{formatCurrency(totalDue || group.monthlyFee)}</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href={`/admin/groups/${group.id}`}
                      className={`flex-1 rounded-[18px] px-5 py-4 text-center text-lg font-semibold ${theme === "day" ? "bg-[#1e2a44] text-white" : "bg-white text-slate-900"}`}
                    >
                      → Jurnal
                    </Link>
                    <button type="button" onClick={() => onEditGroup(group.id)} className={`grid h-[60px] w-[60px] place-items-center rounded-[18px] ${theme === "day" ? "bg-slate-100 text-slate-600" : "bg-white/10 text-white/70"}`}>
                      …
                    </button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export function PaymentsPanel({
  rows,
  requests,
  onClosePayment,
  onReviewPayment,
  theme,
}: {
  rows: {
    id: string;
    name: string;
    group: string;
    balance: number;
    status: string;
    rawStatus: "paid" | "partial" | "unpaid" | "overdue";
    paidAmount: number;
    dueAmount: number;
    monthlyFee: number;
    totalDue: number;
    dueDate: string | null;
    activeMonths: number;
  }[];
  requests: {
    studentId: string;
    paymentId: string;
    studentName: string;
    group: string;
    amount: number;
    month?: string;
    paidAt: string;
    method: "cash" | "card" | "transfer";
    transactionId?: string;
    proofNote?: string;
    requestedAt?: string;
  }[];
  onClosePayment: (id: string) => void;
  onReviewPayment: (studentId: string, paymentId: string, status: "approved" | "rejected") => void;
  theme: ThemeMode;
}) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const paidTotal = useMemo(() => rows.reduce((sum, row) => sum + row.paidAmount, 0), [rows]);
  const dueTotal = useMemo(() => rows.reduce((sum, row) => sum + row.dueAmount, 0), [rows]);
  const pendingCount = useMemo(() => rows.filter((row) => row.rawStatus === "partial").length, [rows]);
  const unpaidCount = useMemo(() => rows.filter((row) => row.rawStatus === "unpaid" || row.rawStatus === "overdue").length, [rows]);
  const availableGroups = useMemo(() => [...new Set(rows.map((row) => row.group).filter(Boolean))].sort(), [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (groupFilter !== "all" && row.group !== groupFilter) return false;
      if (statusFilter !== "all" && row.rawStatus !== statusFilter) return false;
      if (!query) return true;

      const haystack = `${row.name} ${row.group} ${row.status} ${row.dueDate ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [groupFilter, rows, search, statusFilter]);

  const statCards = [
    {
      title: "To'langan summa",
      value: formatCurrency(paidTotal),
      hint: "so'm",
      border: "border-t-emerald-400",
      iconWrap: "bg-emerald-100 text-emerald-600",
      icon: "▣",
      valueTone: "text-emerald-500",
    },
    {
      title: "Kutilayotgan summa",
      value: formatCurrency(dueTotal),
      hint: "so'm",
      border: "border-t-amber-400",
      iconWrap: "bg-amber-100 text-amber-600",
      icon: "◔",
      valueTone: "",
    },
    {
      title: "To'lanmaganlar",
      value: String(unpaidCount),
      hint: "pending statusdagi yozuvlar",
      border: "border-t-rose-400",
      iconWrap: "bg-rose-100 text-rose-600",
      icon: "◕",
      valueTone: "",
    },
    {
      title: "Jami tranzaksiyalar",
      value: String(filteredRows.length),
      hint: "filtrlangan natija",
      border: "border-t-sky-400",
      iconWrap: "bg-sky-100 text-sky-600",
      icon: "◫",
      valueTone: "",
    },
  ] as const;

  return (
    <>
      <section
        className={`relative overflow-hidden rounded-[34px] border px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] md:px-8 md:py-8 ${
          theme === "day"
            ? "border-emerald-200 bg-[radial-gradient(circle_at_top_left,rgba(15,118,110,0.18),transparent_18%),linear-gradient(135deg,#0f172a_0%,#0b5d4b_45%,#0b8f71_100%)] text-white"
            : "border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.18),transparent_18%),linear-gradient(135deg,#0f172a_0%,#0b5d4b_45%,#0b8f71_100%)]"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-4 top-5 h-10 w-40 rounded-full bg-white/14" />
          <div className="absolute bottom-5 left-6 h-12 w-44 rounded-[18px] border border-white/8 bg-white/6" />
          <div className="absolute right-0 top-14 h-44 w-[22rem] rounded-l-[34px] bg-white/10" />
          <div className="absolute right-12 top-32 h-24 w-72 rounded-[28px] bg-white/10" />
        </div>

        <div className="relative flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-white/18 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90">
              To'lov markazi
            </span>
            <div className="mt-6 max-w-xl rounded-[28px] bg-white/6 p-5 backdrop-blur-sm">
              <h1 className="text-3xl font-bold tracking-tight md:text-5xl">To'lovlar</h1>
              <p className="mt-4 text-base leading-8 text-white/78">
                Barcha to'lovlarni bir joydan kuzating, yangi yozuvlarni ajrating va mavjud holatlarni tez yangilang.
              </p>
            </div>
          </div>

          <div className="relative min-h-[170px] min-w-[280px] rounded-[34px] bg-white/10 p-6 backdrop-blur-sm xl:min-w-[360px]">
            <div className="absolute left-10 top-7 h-10 w-40 rounded-full bg-emerald-950/20" />
            <div className="absolute left-12 top-20 h-8 w-36 rounded-full bg-emerald-950/20" />
            <div className="absolute bottom-9 left-12 h-8 w-28 rounded-full bg-emerald-950/20" />
            <div className="absolute bottom-8 right-8">
              <ActionButton label="+ To'lov qo'shish" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} primary theme={theme} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-4">
        {statCards.map((card) => (
          <section
            key={card.title}
            className={`rounded-[28px] border border-t-4 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] ${card.border} ${
              theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-sm font-semibold uppercase tracking-[0.14em] ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{card.title}</p>
                <h2 className={`mt-6 text-3xl font-bold ${card.valueTone}`}>{card.value}</h2>
                <p className={`mt-4 text-sm ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>{card.hint}</p>
              </div>
              <div className={`grid h-14 w-14 place-items-center rounded-2xl text-lg font-bold ${card.iconWrap}`}>{card.icon}</div>
            </div>
          </section>
        ))}
      </div>

      {requests.length ? (
        <section className={`rounded-[30px] border p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className={`text-sm uppercase tracking-[0.24em] ${theme === "day" ? "text-amber-600" : "text-amber-300"}`}>Pending requests</p>
              <h2 className="mt-2 text-2xl font-bold">Tasdiqlash kutilayotgan to'lovlar</h2>
            </div>
            <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-600">{requests.length} ta so'rov</span>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {requests.map((request) => (
              <article key={request.paymentId} className={`rounded-[24px] border p-5 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold">{request.studentName}</p>
                    <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{request.group} · {request.month || request.paidAt.slice(0, 7)}</p>
                  </div>
                  <span className="rounded-full bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-400">Kutilmoqda</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className={`text-xs uppercase tracking-[0.2em] ${theme === "day" ? "text-slate-400" : "text-white/30"}`}>Summa</p>
                    <p className="mt-2 text-lg font-semibold">{formatCurrency(request.amount)}</p>
                  </div>
                  <div>
                    <p className={`text-xs uppercase tracking-[0.2em] ${theme === "day" ? "text-slate-400" : "text-white/30"}`}>Usul</p>
                    <p className="mt-2 text-lg font-semibold">{request.method === "cash" ? "Naqd" : request.method === "card" ? "Karta" : "O'tkazma"}</p>
                  </div>
                  <div>
                    <p className={`text-xs uppercase tracking-[0.2em] ${theme === "day" ? "text-slate-400" : "text-white/30"}`}>Sana</p>
                    <p className="mt-2 font-semibold">{request.paidAt}</p>
                  </div>
                  <div>
                    <p className={`text-xs uppercase tracking-[0.2em] ${theme === "day" ? "text-slate-400" : "text-white/30"}`}>Tranzaksiya</p>
                    <p className="mt-2 font-semibold">{request.transactionId || "Kiritilmagan"}</p>
                  </div>
                </div>
                <p className={`mt-4 text-sm leading-6 ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{request.proofNote || "Chek yoki izoh qoldirilmagan."}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onReviewPayment(request.studentId, request.paymentId, "approved")}
                    className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Tasdiqlash
                  </button>
                  <button
                    type="button"
                    onClick={() => onReviewPayment(request.studentId, request.paymentId, "rejected")}
                    className={`rounded-2xl px-4 py-3 text-sm font-semibold ${theme === "day" ? "bg-rose-100 text-rose-600" : "bg-rose-500/15 text-rose-300"}`}
                  >
                    Rad etish
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={`rounded-[34px] border shadow-[0_20px_70px_rgba(15,23,42,0.08)] ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
        <div className={`border-b px-6 py-6 ${theme === "day" ? "border-slate-200/80" : "border-white/8"}`}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className={`text-sm font-semibold uppercase tracking-[0.3em] ${theme === "day" ? "text-sky-600" : "text-cyan-300"}`}>To'lovlar reestri</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-bold tracking-tight">To'lovlar jadvali</h2>
                <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600">{filteredRows.length} ta yozuv</span>
                <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-600">{pendingCount} ta pending</span>
              </div>
              <p className={`mt-4 text-base ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
                Student, guruh, status va summa bo'yicha barcha to'lovlarni bir joydan boshqaring.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Student, guruh yoki holat qidirish"
                className={`min-w-[250px] rounded-[20px] border px-4 py-3 outline-none ${
                  theme === "day" ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400" : "border-white/8 bg-white/5 text-white placeholder:text-white/35"
                }`}
              />
              <select
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                className={`rounded-[20px] border px-4 py-3 outline-none ${
                  theme === "day" ? "border-slate-200 bg-white text-slate-900" : "border-white/8 bg-white/5 text-white"
                }`}
              >
                <option value="all">Barcha guruhlar</option>
                {availableGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={`rounded-[20px] border px-4 py-3 outline-none ${
                  theme === "day" ? "border-slate-200 bg-white text-slate-900" : "border-white/8 bg-white/5 text-white"
                }`}
              >
                <option value="all">Barcha statuslar</option>
                <option value="paid">To'langan</option>
                <option value="partial">Qisman</option>
                <option value="unpaid">To'lanmagan</option>
                <option value="overdue">Muddati o'tgan</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className={theme === "day" ? "text-slate-500" : "text-white/40"}>
                {["Student", "Guruh", "Tarif", "To'langan", "Qarz", "Status", "Muddat", "Amal"].map((label) => (
                  <th key={label} className={`px-6 py-5 text-left text-sm font-semibold uppercase tracking-[0.28em] ${theme === "day" ? "border-b border-slate-200/80" : "border-b border-white/8"}`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td className={`px-6 py-5 align-top ${theme === "day" ? "border-b border-slate-100" : "border-b border-white/6"}`}>
                    <div className="flex items-start gap-4">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-base font-bold text-white">
                        {row.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xl font-semibold">{row.name}</p>
                        <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>{row.activeMonths} oy faol billing</p>
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 py-5 align-top ${theme === "day" ? "border-b border-slate-100" : "border-b border-white/6"}`}>
                    <p className="text-lg font-semibold">{row.group}</p>
                    <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>Oylik nazorat guruhi</p>
                  </td>
                  <td className={`px-6 py-5 align-top ${theme === "day" ? "border-b border-slate-100" : "border-b border-white/6"}`}>
                    <p className="text-lg font-semibold">{formatCurrency(row.monthlyFee)}</p>
                    <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>oylik tarif</p>
                  </td>
                  <td className={`px-6 py-5 align-top text-lg font-semibold text-emerald-500 ${theme === "day" ? "border-b border-slate-100" : "border-b border-white/6"}`}>
                    {formatCurrency(row.paidAmount)}
                  </td>
                  <td className={`px-6 py-5 align-top ${theme === "day" ? "border-b border-slate-100" : "border-b border-white/6"}`}>
                    <p className={`text-lg font-semibold ${row.dueAmount > 0 ? "text-rose-500" : ""}`}>{formatCurrency(row.dueAmount)}</p>
                    <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>Jami: {formatCurrency(row.totalDue)}</p>
                  </td>
                  <td className={`px-6 py-5 align-top ${theme === "day" ? "border-b border-slate-100" : "border-b border-white/6"}`}>
                    <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${billingStatusTone(row.rawStatus)}`}>{row.status}</span>
                  </td>
                  <td className={`px-6 py-5 align-top ${theme === "day" ? "border-b border-slate-100" : "border-b border-white/6"}`}>
                    <p className="font-semibold">{row.dueDate ?? "Belgilanmagan"}</p>
                    <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>to'lov muddati</p>
                  </td>
                  <td className={`px-6 py-5 align-top ${theme === "day" ? "border-b border-slate-100" : "border-b border-white/6"}`}>
                    <button
                      type="button"
                      onClick={() => onClosePayment(row.id)}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        theme === "day" ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-white text-slate-900 hover:bg-white/90"
                      }`}
                    >
                      To'lovni yopish
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filteredRows.length ? (
          <div className={`px-6 py-10 text-center text-base ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
            Tanlangan filtrlar bo'yicha to'lov yozuvlari topilmadi.
          </div>
        ) : null}
      </section>
    </>
  );
}
