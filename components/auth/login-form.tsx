"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");
  const [email, setEmail] = useState("admin@hems.uz");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const raw = await response.text();
      const payload = raw.trim()
        ? (JSON.parse(raw) as {
            error?: string;
            ok?: boolean;
            user?: { role?: "admin" | "teacher" | "student" };
          })
        : {};

      if (!response.ok) {
        setError(payload.error || "Kirishda xatolik.");
        setLoading(false);
        return;
      }

      const target = nextUrl || (payload.user?.role === "admin" ? "/admin" : "/panel");
      window.location.assign(target);
    } catch {
      setError("Tizimga kirishda xatolik yuz berdi.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070d1d] px-4 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-[36px] border border-white/8 bg-[#0b1120] shadow-[0_30px_100px_rgba(0,0,0,0.35)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_26%),linear-gradient(180deg,#111b35,#08101f)] p-10 lg:block">
          <div className="absolute -left-14 top-16 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-10 right-0 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 text-2xl">
                🎓
              </div>
              <div>
                <h1 className="text-3xl font-bold">Kurs Boshqaruv</h1>
              </div>
            </div>

            <div className="mt-20 max-w-xl">
              <p className="text-sm uppercase tracking-[0.28em] text-sky-300/80">Secure Access</p>
              <h2 className="mt-4 text-6xl font-bold leading-tight">
                Admin yaratgan login bilan <span className="text-sky-400">tizimga kiring</span>
              </h2>
              <p className="mt-6 text-xl leading-9 text-white/55">
                Teacher va student accountlarini faqat admin yaratadi. Har bir foydalanuvchi admin bergan login va parol bilan kiradi.
              </p>
            </div>

            <div className="mt-16 grid gap-4">
              {[
                "Real ishlaydigan admin dashboard",
                "Admin yaratadigan student va teacher accountlar",
                "Role-based kirish va yopiq panel",
              ].map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-2xl border border-white/8 bg-white/5 px-5 py-4 text-lg text-white/75">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 md:p-10">
          <div className="w-full max-w-md">
            <p className="text-sm uppercase tracking-[0.28em] text-white/40">Login</p>
            <h2 className="mt-4 text-5xl font-bold">Tizimga kirish</h2>
            <p className="mt-4 text-lg text-white/50">
              Login va parolni admin beradi. Admin panelga faqat admin account kiradi.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-4">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="w-full rounded-2xl border border-white/8 bg-white/5 px-5 py-4 text-white outline-none placeholder:text-white/30"
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Parol"
                className="w-full rounded-2xl border border-white/8 bg-white/5 px-5 py-4 text-white outline-none placeholder:text-white/30"
              />

              {error ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-500 to-sky-400 px-5 py-4 text-lg font-semibold text-white shadow-[0_14px_30px_rgba(59,130,246,0.3)]"
              >
                {loading ? "Kirilmoqda..." : "Kirish"}
              </button>
            </form>

            <div className="mt-8 rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-white/55">
              Admin demo: <span className="font-semibold text-white">admin@hems.uz</span> / <span className="font-semibold text-white">Admin123!</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
