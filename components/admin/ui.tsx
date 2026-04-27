"use client";

import type { ReactNode } from "react";

export type AdminThemeMode = "day" | "night";

export function InputField({
  value,
  onChange,
  placeholder,
  theme = "night",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  theme?: AdminThemeMode;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`rounded-2xl border px-4 py-3 outline-none ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400" : "border-white/8 bg-white/5 text-white placeholder:text-white/35"}`}
    />
  );
}

export function ActionButton({
  label,
  onClick,
  primary = false,
  theme = "night",
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  theme?: AdminThemeMode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[18px] px-5 py-3 text-sm font-semibold transition ${
        primary
          ? "bg-gradient-to-r from-blue-500 to-sky-400 text-white shadow-[0_12px_30px_rgba(59,130,246,0.3)]"
          : theme === "day"
            ? "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            : "border border-white/8 bg-white/5 text-white/85 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

export function InfoCard({ label, value, theme = "night" }: { label: string; value: string; theme?: AdminThemeMode }) {
  return (
    <div className={`rounded-[20px] border p-4 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
      <p className={`text-sm uppercase tracking-[0.24em] ${theme === "day" ? "text-slate-500" : "text-white/35"}`}>{label}</p>
      <p className="mt-3 text-lg font-semibold">{value}</p>
    </div>
  );
}

export function InfoPanel({ title, value, hint, theme = "night" }: { title: string; value: string; hint: string; theme?: AdminThemeMode }) {
  return (
    <section className={`rounded-[28px] border p-5 ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
      <p className={`text-base ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{title}</p>
      <h2 className="mt-6 text-3xl font-bold">{value}</h2>
      <p className={`mt-3 text-base ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>{hint}</p>
    </section>
  );
}

export function PanelHero({
  badge,
  title,
  description,
  stats = [],
  actions,
  tone = "blue",
  theme = "night",
}: {
  badge: string;
  title: string;
  description: string;
  stats?: Array<{ label: string; value: string }>;
  actions?: ReactNode;
  tone?: "blue" | "emerald" | "amber" | "violet" | "teal";
  theme?: AdminThemeMode;
}) {
  const toneMap = {
    blue:
      theme === "day"
        ? "border-blue-200 bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_48%,#dbeafe_100%)]"
        : "border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,.24),transparent_24%),linear-gradient(135deg,#16213d_0%,#15203b_42%,#2458ff_100%)]",
    emerald:
      theme === "day"
        ? "border-emerald-200 bg-[linear-gradient(135deg,#f5fff9_0%,#e8fff5_48%,#d1fae5_100%)]"
        : "border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.22),transparent_24%),linear-gradient(135deg,#12352f_0%,#0f5f55_45%,#10b981_100%)]",
    amber:
      theme === "day"
        ? "border-amber-200 bg-[linear-gradient(135deg,#fffaf2_0%,#fff1d9_50%,#fde68a_100%)]"
        : "border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,.22),transparent_24%),linear-gradient(135deg,#3a2209_0%,#8b3f00_48%,#f59e0b_100%)]",
    violet:
      theme === "day"
        ? "border-violet-200 bg-[linear-gradient(135deg,#faf7ff_0%,#f4eeff_50%,#e9d5ff_100%)]"
        : "border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.22),transparent_24%),linear-gradient(135deg,#24153d_0%,#33215c_45%,#7c3aed_100%)]",
    teal:
      theme === "day"
        ? "border-cyan-200 bg-[linear-gradient(135deg,#f4fdff_0%,#e6fbff_48%,#cffafe_100%)]"
        : "border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,.22),transparent_24%),linear-gradient(135deg,#12303a_0%,#0b5a68_45%,#0891b2_100%)]",
  } as const;

  return (
    <section
      className={`relative overflow-hidden rounded-[30px] border px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] md:px-8 md:py-8 ${toneMap[tone]}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute left-6 top-6 h-24 w-24 rounded-[28px] border border-white/10 bg-white/5" />
        <div className="absolute bottom-0 left-20 h-28 w-28 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute right-8 top-10 h-36 w-36 rounded-full border border-white/10 bg-white/5" />
      </div>

      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <span
            className={`inline-flex rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] ${
              theme === "day" ? "bg-white/80 text-slate-700" : "bg-white/10 text-white/80"
            }`}
          >
            {badge}
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
          <p className={`mt-4 max-w-2xl text-base leading-7 ${theme === "day" ? "text-slate-600" : "text-white/70"}`}>{description}</p>
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        {stats.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px] xl:grid-cols-3">
            {stats.map((item) => (
              <div
                key={`${item.label}-${item.value}`}
                className={`rounded-[24px] border px-4 py-4 ${
                  theme === "day" ? "border-white/70 bg-white/75" : "border-white/15 bg-white/5"
                }`}
              >
                <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${theme === "day" ? "text-slate-500" : "text-white/55"}`}>
                  {item.label}
                </p>
                <p className="mt-4 text-3xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function QuickActionCard({
  icon,
  title,
  description,
  action,
  tone = "blue",
  theme = "night",
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "blue" | "emerald" | "amber" | "violet" | "teal";
  theme?: AdminThemeMode;
}) {
  const accent = {
    blue: "from-blue-500 to-sky-400",
    emerald: "from-emerald-500 to-teal-400",
    amber: "from-amber-500 to-orange-400",
    violet: "from-violet-500 to-fuchsia-400",
    teal: "from-cyan-500 to-teal-400",
  } as const;

  return (
    <section className={`rounded-[28px] border p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] ${theme === "day" ? "border-slate-200 bg-white" : "border-white/8 bg-[#10172c]"}`}>
      <div className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-xl text-white shadow-[0_10px_24px_rgba(0,0,0,0.14)] ${accent[tone]}`}>
        {icon}
      </div>
      <h3 className="mt-6 text-2xl font-bold">{title}</h3>
      <p className={`mt-3 text-sm leading-7 ${theme === "day" ? "text-slate-500" : "text-white/50"}`}>{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  );
}
