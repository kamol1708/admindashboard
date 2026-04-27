"use client";

import type { DashboardResponse } from "@/lib/types";
import type { AdminTab, ThemeMode } from "@/components/admin/constants";
import { ActionButton, PanelHero } from "@/components/admin/ui";

export function DashboardPanel({
  data,
  absentToday,
  income,
  sixDayAttendance,
  unpaidStudents,
  totalTeachers,
  onAddStudent,
  onExport,
  onPrint,
  onOpenTab,
  theme = "night",
}: {
  data: DashboardResponse | null;
  absentToday: number;
  income: number;
  sixDayAttendance: { date: string; percent: number }[];
  unpaidStudents: number;
  totalTeachers: number;
  onAddStudent: () => void;
  onExport: () => void;
  onPrint: () => void;
  onOpenTab: (tab: AdminTab) => void;
  theme?: ThemeMode;
}) {
  const cards = [
    { title: "Jami o'quvchilar", value: data?.metrics.totalStudents ?? 0, hint: `+${data?.metrics.activeStudents ?? 0} ta faol`, tone: "from-[#1c2446] to-[#16203d]" },
    { title: "Jami o'qituvchilar", value: totalTeachers, hint: "Admin yaratgan teacherlar", tone: "from-[#0d3140] to-[#0f2234]" },
    { title: "Oylik tushum", value: `${Math.round(income / 1000000)} mln so'm`, hint: "+9.4%", tone: "from-[#0b3644] to-[#10283d]" },
    { title: "Bugun kelmaganlar", value: absentToday, hint: "Nazorat kerak", tone: "from-[#2b1734] to-[#24182f]" },
  ];

  return (
    <>
      <PanelHero
        badge="Admin dashboard"
        title="Markaz boshqaruv markazi"
        description="Bugungi faoliyat, to'lov oqimi va davomatni bir markazdan kuzatib, kerakli bo'limga tez o'ting."
        tone="blue"
        theme={theme}
        actions={
          <>
            <ActionButton label="+ O'quvchi qo'shish" primary onClick={onAddStudent} theme={theme} />
            <ActionButton label="Chop etish" onClick={onPrint} theme={theme} />
            <ActionButton label="Eksport" onClick={onExport} theme={theme} />
          </>
        }
        stats={[
          { label: "Studentlar", value: String(data?.metrics.totalStudents ?? 0) },
          { label: "Teacherlar", value: String(totalTeachers) },
          { label: "Kelmaganlar", value: String(absentToday) },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.title} className={`rounded-[24px] border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] ${theme === "day" ? "border-slate-200 bg-white" : `border-white/8 bg-gradient-to-br ${card.tone}`}`}>
            <p className={`text-sm ${theme === "day" ? "text-slate-500" : "text-white/55"}`}>{card.title}</p>
            <h3 className="mt-6 text-3xl font-bold">{card.value}</h3>
            <p className={`mt-3 text-base ${theme === "day" ? "text-slate-500" : "text-white/55"}`}>{card.hint}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <section className={`rounded-[28px] border p-5 ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
          <h2 className="text-2xl font-bold">Davomat dinamikasi</h2>
          <p className={`mt-2 text-base ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>So'nggi 6 ta dars kunidagi umumiy ko'rsatkich.</p>
          <div className="mt-8 grid grid-cols-3 gap-4 md:grid-cols-6">
            {sixDayAttendance.map((item) => (
              <div key={item.date} className="flex flex-col items-center">
                <div className={`relative flex h-44 w-full items-end rounded-[30px] p-3 ${theme === "day" ? "bg-slate-100" : "bg-white/8"}`}>
                  <div
                    className="w-full rounded-[22px] bg-gradient-to-b from-sky-400 to-blue-500 shadow-[0_8px_24px_rgba(59,130,246,0.35)]"
                    style={{ height: `${Math.max(item.percent, 14)}%` }}
                  />
                </div>
                <p className={`mt-3 text-sm ${theme === "day" ? "text-slate-500" : "text-white/40"}`}>{item.date.slice(5)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`rounded-[28px] border p-5 ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
          <h2 className="text-2xl font-bold">Tezkor nazorat</h2>
          <div className="mt-6 space-y-4">
            <button
              type="button"
              onClick={() => onOpenTab("groups")}
              className={`block w-full rounded-[24px] border p-5 text-left transition ${theme === "day" ? "border-slate-200 bg-slate-50 hover:bg-slate-100" : "border-white/8 bg-white/5 hover:bg-white/10"}`}
            >
              <p className="text-xl font-semibold">Bugun kelmaganlar</p>
              <p className={`mt-2 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{absentToday} nafar o'quvchi nazorat talab qiladi. Guruh jurnaliga o'ting.</p>
            </button>
            <button
              type="button"
              onClick={() => onOpenTab("payments")}
              className={`block w-full rounded-[24px] border p-5 text-left transition ${theme === "day" ? "border-slate-200 bg-slate-50 hover:bg-slate-100" : "border-white/8 bg-white/5 hover:bg-white/10"}`}
            >
              <p className="text-xl font-semibold">To'lov qilmaganlar</p>
              <p className={`mt-2 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>Shu oyda {unpaidStudents} ta muddati o'tgan to'lov bor</p>
            </button>
            <button
              type="button"
              onClick={() => onOpenTab("students")}
              className={`block w-full rounded-[24px] border p-5 text-left transition ${theme === "day" ? "border-slate-200 bg-slate-50 hover:bg-slate-100" : "border-white/8 bg-white/5 hover:bg-white/10"}`}
            >
              <p className="text-xl font-semibold">O'quvchilar ro'yxati</p>
              <p className={`mt-2 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>Holatlarni filtrlash, statusni yangilash va profil ko'rish.</p>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
