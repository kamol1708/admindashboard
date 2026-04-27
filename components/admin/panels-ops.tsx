"use client";

import type { Bootcamp, Enrollment, Student } from "@/lib/types";
import { ActionButton, InfoCard, InfoPanel, PanelHero, QuickActionCard } from "@/components/admin/ui";
import { formatCurrency } from "@/lib/ui/billing-formatters";

type ThemeMode = "day" | "night";

export function CoursesPanel({
  bootcamps,
  enrollments,
  students,
  onAddBootcamp,
  onAddEnrollment,
  onEditBootcamp,
  onDeleteBootcamp,
  onEditEnrollment,
  onDeleteEnrollment,
  theme,
}: {
  bootcamps: Bootcamp[];
  enrollments: Enrollment[];
  students: Student[];
  onAddBootcamp: () => void;
  onAddEnrollment: () => void;
  onEditBootcamp: (bootcamp: Bootcamp) => void;
  onDeleteBootcamp: (bootcampId: string) => void;
  onEditEnrollment: (enrollment: Enrollment) => void;
  onDeleteEnrollment: (enrollmentId: string) => void;
  theme: ThemeMode;
}) {
  const bootcampCards = bootcamps.map((bootcamp) => {
    const relatedEnrollments = enrollments.filter((item) => item.bootcampId === bootcamp.id);
    const totalPaid = relatedEnrollments.reduce((sum, item) => sum + item.paymentAmount, 0);
    const totalRemaining = relatedEnrollments.reduce(
      (sum, item) => sum + Math.max((item.bootcampPrice ?? bootcamp.price) - item.paymentAmount, 0),
      0,
    );
    const paymentHealth =
      relatedEnrollments.length === 0
        ? "Yangi"
        : totalRemaining === 0
          ? "To'lov yopilgan"
          : totalPaid === 0
            ? "To'lanmagan"
            : "Qisman yopilgan";

    return {
      ...bootcamp,
      enrollmentCount: relatedEnrollments.length,
      totalPaid,
      totalRemaining,
      paymentHealth,
    };
  });

  return (
    <>
      <PanelHero
        badge="Kurs markazi"
        title="Bootcamp va enrollment"
        description="Kurs narxlarini, student enrollment holatini va qoldiq to'lovlarni bitta joydan boshqaring."
        tone="amber"
        theme={theme}
        actions={
          <>
            <ActionButton label="+ Bootcamp yaratish" primary onClick={onAddBootcamp} theme={theme} />
            <ActionButton label="+ Student enroll qilish" onClick={onAddEnrollment} theme={theme} />
          </>
        }
        stats={[
          { label: "Bootcamplar", value: String(bootcamps.length) },
          { label: "Enrollmentlar", value: String(enrollments.length) },
          { label: "Studentlar", value: String(students.length) },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <QuickActionCard
          icon="▣"
          title="Kurs qo'shish"
          description="Bootcamp nomi va narxini kiriting, keyin uni enrollment orqali studentlarga biriktiring."
          tone="amber"
          theme={theme}
          action={<ActionButton label="Yangi bootcamp" primary onClick={onAddBootcamp} theme={theme} />}
        />
        <QuickActionCard
          icon="⇄"
          title="Enrollment yaratish"
          description="Mavjud studentni bootcampga yozing va boshlang'ich to'lov holatini darhol biriktiring."
          tone="emerald"
          theme={theme}
          action={<ActionButton label="Student enroll qilish" onClick={onAddEnrollment} theme={theme} />}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <InfoPanel title="Bootcamplar" value={String(bootcamps.length)} hint="Faol kurs katalogi" theme={theme} />
        <InfoPanel title="Enrollmentlar" value={String(enrollments.length)} hint="Student va bootcamp bog'lanishi" theme={theme} />
        <InfoPanel title="Jami to'langan" value={formatCurrency(enrollments.reduce((sum, item) => sum + item.paymentAmount, 0))} hint="Barcha enrollmentlar bo'yicha" theme={theme} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {bootcampCards.length ? (
          bootcampCards.map((bootcamp) => (
            <section key={bootcamp.id} className={`rounded-[30px] border p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-[11px] uppercase tracking-[0.18em] ${theme === "day" ? "text-slate-400" : "text-white/30"}`}>Bootcamp</p>
                  <h2 className="mt-2 text-[30px] font-bold leading-tight">{bootcamp.name}</h2>
                  <p className={`mt-2 text-base ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{bootcamp.enrollmentCount} ta enrollment</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    bootcamp.paymentHealth === "To'lov yopilgan"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : bootcamp.paymentHealth === "Qisman yopilgan"
                        ? "bg-sky-500/15 text-sky-300"
                        : bootcamp.paymentHealth === "To'lanmagan"
                          ? "bg-rose-500/15 text-rose-300"
                          : theme === "day"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-white/8 text-white/70"
                  }`}>
                    {bootcamp.paymentHealth}
                  </span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => onEditBootcamp(bootcamp)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${theme === "day" ? "bg-slate-100 text-slate-700" : "bg-white/10 text-white/75"}`}>
                      Edit
                    </button>
                    <button type="button" onClick={() => onDeleteBootcamp(bootcamp.id)} className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-300">
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <InfoCard label="Narx" value={formatCurrency(bootcamp.price)} theme={theme} />
                <InfoCard label="To'langan" value={formatCurrency(bootcamp.totalPaid)} theme={theme} />
                <InfoCard label="Qoldiq" value={formatCurrency(bootcamp.totalRemaining)} theme={theme} />
              </div>
            </section>
          ))
        ) : (
          <section className={`rounded-[30px] border p-6 xl:col-span-2 ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
            <h2 className="text-2xl font-bold">Bootcamp hali yaratilmagan</h2>
            <p className={`mt-3 text-base ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
              Avval kurs nomi va narxini kiriting, keyin studentlarni enrollment orqali biriktirasiz.
            </p>
          </section>
        )}
      </div>

      <section className={`rounded-[30px] border p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Enrollment ro'yxati</h2>
            <p className={`mt-2 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
              Student qaysi bootcampda, qancha to'lagan va qancha qoldig'i borligi shu yerda ko'rinadi.
            </p>
          </div>
          <span className={`rounded-full px-4 py-2 text-sm font-semibold ${theme === "day" ? "bg-slate-100 text-slate-700" : "bg-white/8 text-white/70"}`}>
            {enrollments.length} ta yozuv
          </span>
        </div>

        <div className={`mt-5 overflow-x-auto rounded-[24px] border ${theme === "day" ? "border-slate-200" : "border-white/8"}`}>
          <div className={`grid min-w-[980px] grid-cols-[1.3fr_1.1fr_0.8fr_0.8fr_0.85fr_0.85fr] gap-4 border-b px-5 py-4 text-[11px] uppercase tracking-[0.18em] ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-500" : "border-white/8 bg-white/[0.03] text-white/35"}`}>
            <span>Student</span>
            <span>Bootcamp</span>
            <span>Narx</span>
            <span>To'langan</span>
            <span>Holat</span>
            <span>Boshlanish</span>
          </div>
          {enrollments.length ? (
            enrollments.map((enrollment) => {
              const student = students.find((item) => item.id === enrollment.studentId);
              const remainingBalance = Math.max((enrollment.bootcampPrice ?? 0) - enrollment.paymentAmount, 0);
              return (
                <div key={enrollment.id} className={`grid min-w-[980px] grid-cols-[1.3fr_1.1fr_0.8fr_0.8fr_0.85fr_0.85fr] gap-4 border-b px-5 py-5 last:border-b-0 ${theme === "day" ? "border-slate-200" : "border-white/8"}`}>
                  <div>
                    <p className="font-semibold">{student?.fullName ?? "Student topilmadi"}</p>
                    <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{student?.group ?? "-"}</p>
                  </div>
                  <div>
                    <p className="font-semibold">{enrollment.bootcampName ?? "Bootcamp"}</p>
                    <p className={`mt-1 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>Qoldiq: {formatCurrency(remainingBalance)}</p>
                  </div>
                  <div className="font-semibold">{formatCurrency(enrollment.bootcampPrice ?? 0)}</div>
                  <div className="font-semibold">{formatCurrency(enrollment.paymentAmount)}</div>
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold ${
                      enrollment.paymentStatus === "paid"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : enrollment.paymentStatus === "partial"
                          ? "bg-sky-500/15 text-sky-300"
                          : "bg-rose-500/15 text-rose-300"
                    }`}>
                      {enrollment.paymentStatus === "paid" ? "To'liq to'langan" : enrollment.paymentStatus === "partial" ? "Qisman to'langan" : "To'lanmagan"}
                    </span>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => onEditEnrollment(enrollment)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${theme === "day" ? "bg-slate-100 text-slate-700" : "bg-white/10 text-white/75"}`}>
                        Edit
                      </button>
                      <button type="button" onClick={() => onDeleteEnrollment(enrollment.id)} className="rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-300">
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="font-medium">{enrollment.startDate}</div>
                </div>
              );
            })
          ) : (
            <div className={`px-4 py-8 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
              Enrollment hali yo'q. Bootcamp yaratib, studentni kursga biriktiring.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export function ReportsPanel({
  students,
  sixDayAttendance,
  onExport,
  onPrint,
  theme,
}: {
  students: Student[];
  sixDayAttendance: { date: string; percent: number }[];
  onExport: () => void;
  onPrint: () => void;
  theme: ThemeMode;
}) {
  const bestStudent = [...students].sort((a, b) => b.grades.length - a.grades.length)[0];

  return (
    <>
      <PanelHero
        badge="Hisobot markazi"
        title="Hisobot va tahlillar"
        description="Davomat, faol student va eksport tayyorligini tez ko'rish uchun yig'ilgan boshqaruv hisobotlari."
        tone="blue"
        theme={theme}
        actions={
          <>
            <ActionButton label="CSV eksport" onClick={onExport} theme={theme} />
            <ActionButton label="Chop etish" onClick={onPrint} theme={theme} />
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <InfoPanel title="Eng faol o'quvchi" value={bestStudent?.fullName ?? "-"} hint={bestStudent?.group ?? "Ma'lumot yo'q"} theme={theme} />
        <InfoPanel title="Davomat cho'qqisi" value={`${Math.max(...sixDayAttendance.map((item) => item.percent), 0)}%`} hint="Oxirgi 6 kun bo'yicha" theme={theme} />
        <InfoPanel title="Hisobot holati" value="Tayyor" hint="PDF / CSV olinadi" theme={theme} />
      </div>
    </>
  );
}

export function NotificationsPanel({ alerts, onSend, theme }: { alerts: string[]; onSend: () => void; theme: ThemeMode }) {
  const items = alerts.length ? alerts : ["Bugun uchun xavfli ogohlantirish yo'q.", "To'lovlar barqaror.", "Attendance odatdagidek davom etmoqda."];

  return (
    <>
      <PanelHero
        badge="Xabarlar markazi"
        title="Xabarnomalar"
        description="Riskdagi studentlar va ota-onalarga yuboriladigan ichki va tashqi ogohlantirishlarni boshqaring."
        tone="violet"
        theme={theme}
        actions={<ActionButton label="Ota-onaga yuborish" primary onClick={onSend} theme={theme} />}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        {items.map((item, index) => (
          <section key={`${item}-${index}`} className={`rounded-[32px] border p-6 ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
            <p className="text-xl font-semibold">{item}</p>
            <p className={`mt-3 text-base ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>Telegram / SMS kanaliga tayyor holatda.</p>
          </section>
        ))}
      </div>
    </>
  );
}

export function SettingsPanel({
  settingsState,
  onToggle,
  theme,
}: {
  settingsState: { autoMessages: boolean; smsReminder: boolean; parentDigest: boolean };
  onToggle: (key: "autoMessages" | "smsReminder" | "parentDigest") => void;
  theme: ThemeMode;
}) {
  const items = [
    {
      key: "autoMessages" as const,
      title: "Auto xabarlar",
      description: "Attendance va to'lov bo'yicha avtomatik xabar yuborish.",
      icon: "◉",
      accent: "from-sky-500 to-blue-500",
      glow: "shadow-[0_16px_34px_rgba(59,130,246,0.24)]",
    },
    {
      key: "smsReminder" as const,
      title: "SMS eslatma",
      description: "Qarzdor yoki absent bo'lsa SMS bilan ogohlantirish.",
      icon: "◌",
      accent: "from-emerald-500 to-teal-400",
      glow: "shadow-[0_16px_34px_rgba(16,185,129,0.22)]",
    },
    {
      key: "parentDigest" as const,
      title: "Haftalik digest",
      description: "Ota-onalarga haftalik umumiy holat yuborish.",
      icon: "◎",
      accent: "from-violet-500 to-fuchsia-400",
      glow: "shadow-[0_16px_34px_rgba(168,85,247,0.22)]",
    },
  ];

  return (
    <>
      <PanelHero
        badge="Sozlamalar"
        title="Hisob sozlamalari"
        description="Tizim xabarlari, SMS eslatmalar va ota-ona digest oqimini shu bo'limdan boshqaring."
        tone="blue"
        theme={theme}
      />
      <div className="grid gap-5 xl:grid-cols-3">
        {items.map((item) => (
          <section
            key={item.key}
            className={`rounded-[30px] border p-5 transition ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"} ${
              settingsState[item.key] ? "shadow-[0_22px_60px_rgba(15,23,42,0.08)]" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-lg text-white ${item.accent} ${item.glow}`}>
                  {item.icon}
                </div>
                <h2 className="text-2xl font-bold">{item.title}</h2>
                <p className={`mt-3 text-base ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{item.description}</p>
                <div className="mt-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${
                      settingsState[item.key]
                        ? theme === "day"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-emerald-500/15 text-emerald-300"
                        : theme === "day"
                          ? "bg-slate-100 text-slate-500"
                          : "bg-white/8 text-white/45"
                    }`}
                  >
                    {settingsState[item.key] ? "Faol" : "Ochiq emas"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggle(item.key)}
                aria-pressed={settingsState[item.key]}
                className={`relative mt-1 h-11 w-20 shrink-0 rounded-full p-1 transition ${
                  settingsState[item.key]
                    ? theme === "day"
                      ? "bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_10px_26px_rgba(59,130,246,0.3)]"
                      : "bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_10px_26px_rgba(59,130,246,0.28)]"
                    : theme === "day"
                      ? "bg-slate-200"
                      : "bg-white/10"
                }`}
              >
                <span
                  className={`absolute left-1 top-1 grid h-9 w-9 place-items-center rounded-full bg-white text-[10px] font-bold text-slate-700 transition ${
                    settingsState[item.key] ? "translate-x-9" : ""
                  }`}
                >
                  {settingsState[item.key] ? "ON" : "OFF"}
                </span>
              </button>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
