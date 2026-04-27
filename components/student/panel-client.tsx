"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Enrollment, GroupItem, PaymentMethod, Student, StudentBillingSummary } from "@/lib/types";

type StudentPanelClientProps = {
  student: Student;
  enrollments: Enrollment[];
  group: GroupItem | null;
  billing: StudentBillingSummary | null;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("uz-UZ").format(value)} so'm`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function paymentStatusLabel(status: StudentBillingSummary["status"]) {
  if (status === "paid") return "To'langan";
  if (status === "partial") return "Qisman to'langan";
  if (status === "overdue") return "Muddati o'tgan";
  return "To'lanmagan";
}

function paymentStatusTone(status: StudentBillingSummary["status"]) {
  if (status === "paid") return "bg-emerald-500/15 text-emerald-300";
  if (status === "partial") return "bg-sky-500/15 text-sky-300";
  if (status === "overdue") return "bg-amber-500/15 text-amber-300";
  return "bg-rose-500/15 text-rose-300";
}

function requestStatusLabel(status?: Student["payments"][number]["status"]) {
  if (status === "pending") return "Tasdiqlanmoqda";
  if (status === "rejected") return "Rad etilgan";
  return "Qabul qilingan";
}

function requestStatusTone(status?: Student["payments"][number]["status"]) {
  if (status === "pending") return "bg-amber-500/15 text-amber-300";
  if (status === "rejected") return "bg-rose-500/15 text-rose-300";
  return "bg-emerald-500/15 text-emerald-300";
}

function paymentMethodLabel(method: PaymentMethod) {
  if (method === "cash") return "Naqd";
  if (method === "card") return "Karta";
  return "O'tkazma";
}

function attendanceLabel(status: Student["attendance"][number]["status"]) {
  if (status === "present") return "Keldi";
  if (status === "late") return "Kechikdi";
  return "Kelmadi";
}

function attendanceTone(status: Student["attendance"][number]["status"]) {
  if (status === "present") return "bg-emerald-500/15 text-emerald-300";
  if (status === "late") return "bg-amber-500/15 text-amber-300";
  return "bg-rose-500/15 text-rose-300";
}

export function StudentPanelClient({ student, enrollments, group, billing }: StudentPanelClientProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationError, setNotificationError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordToast, setPasswordToast] = useState("");
  const [paymentRequest, setPaymentRequest] = useState({
    amount: String(billing?.currentCycleDue || billing?.outstanding || ""),
    month: new Date().toISOString().slice(0, 7),
    paidAt: new Date().toISOString().slice(0, 10),
    method: "card" as PaymentMethod,
    transactionId: "",
    proofNote: "",
  });
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentToast, setPaymentToast] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        const payload = (await response.json().catch(() => [])) as NotificationItem[];
        if (!cancelled) {
          if (response.ok) {
            setNotifications(payload);
          } else {
            setNotificationError("Xabarnomalarni yuklab bo'lmadi.");
          }
        }
      } catch {
        if (!cancelled) setNotificationError("Xabarnomalarni yuklab bo'lmadi.");
      }
    }

    void loadNotifications();
    return () => {
      cancelled = true;
    };
  }, []);

  const attendanceRate = useMemo(() => {
    const total = student.attendance.length;
    const present = student.attendance.filter((item) => item.status === "present").length;
    return Math.round((present / Math.max(total, 1)) * 100);
  }, [student.attendance]);

  const averageGrade = useMemo(() => {
    if (!student.grades.length) return 0;
    return Math.round(
      student.grades.reduce((sum, grade) => sum + (grade.score / grade.maxScore) * 100, 0) /
        Math.max(student.grades.length, 1),
    );
  }, [student.grades]);

  const recentAttendance = [...student.attendance]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
  const recentGrades = [...student.grades]
    .sort((a, b) => b.examDate.localeCompare(a.examDate))
    .slice(0, 8);
  const recentPayments = [...student.payments]
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .slice(0, 6);

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

  async function handlePaymentRequest() {
    if (!paymentRequest.amount.trim() || !paymentRequest.month.trim() || !paymentRequest.paidAt.trim()) {
      setPaymentToast("Summa, oy va sana majburiy.");
      return;
    }

    setPaymentBusy(true);
    setPaymentToast("");

    try {
      const response = await fetch(`/api/students/${student.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(paymentRequest.amount),
          month: paymentRequest.month,
          paidAt: paymentRequest.paidAt,
          method: paymentRequest.method,
          transactionId: paymentRequest.transactionId,
          proofNote: paymentRequest.proofNote,
          note: "Student panel orqali yuborildi.",
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setPaymentToast(payload.error || "To'lov so'rovi yuborilmadi.");
        setPaymentBusy(false);
        return;
      }

      setPaymentToast("To'lov so'rovi yuborildi. Admin tasdiqlashini kuting.");
      setPaymentBusy(false);
      router.refresh();
    } catch {
      setPaymentToast("To'lov so'rovini yuborishda tarmoq xatosi yuz berdi.");
      setPaymentBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
          <p className="text-white/45">Guruh</p>
          <h2 className="mt-4 text-2xl font-bold">{student.group}</h2>
        </section>
        <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
          <p className="text-white/45">Davomat</p>
          <h2 className="mt-4 text-2xl font-bold">{attendanceRate}%</h2>
        </section>
        <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
          <p className="text-white/45">O'rtacha baho</p>
          <h2 className="mt-4 text-2xl font-bold">{averageGrade}%</h2>
        </section>
        <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
          <p className="text-white/45">Qolgan to'lov</p>
          <h2 className="mt-4 text-2xl font-bold">{formatCurrency(billing?.outstanding ?? 0)}</h2>
        </section>
      </div>

      <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-white/35">Profil</p>
            <h2 className="mt-2 text-2xl font-bold">{student.fullName}</h2>
            <p className="mt-2 text-white/55">Login admin tomonidan yaratilgan. O'quvchi paneli faqat ko'rish uchun.</p>
          </div>
          {billing ? (
            <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${paymentStatusTone(billing.status)}`}>
              {paymentStatusLabel(billing.status)}
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[20px] border border-white/8 bg-black/10 p-4">
            <p className="text-sm text-white/45">Telefon</p>
            <p className="mt-2 text-lg font-semibold">{student.phone || "Kiritilmagan"}</p>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-black/10 p-4">
            <p className="text-sm text-white/45">Ota-ona</p>
            <p className="mt-2 text-lg font-semibold">{student.parentPhone || "Kiritilmagan"}</p>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-black/10 p-4">
            <p className="text-sm text-white/45">Jadval</p>
            <p className="mt-2 text-lg font-semibold">{group?.schedule ?? "Belgilanmagan"}</p>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-black/10 p-4">
            <p className="text-sm text-white/45">Xona</p>
            <p className="mt-2 text-lg font-semibold">{group?.room ?? "Belgilanmagan"}</p>
          </div>
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <section className="space-y-5">
          <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-white/35">Davomat tarixi</p>
                <h2 className="mt-2 text-2xl font-bold">So'nggi darslar</h2>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-2 text-xs font-semibold text-white/65">
                {student.attendance.length} ta lesson
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {recentAttendance.length ? (
                recentAttendance.map((entry) => (
                  <article key={entry.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-white/8 bg-black/10 p-4">
                    <div>
                      <p className="text-lg font-semibold">{entry.lesson}</p>
                      <p className="mt-1 text-sm text-white/45">{formatDate(entry.date)} · {entry.topic || "Mavzu kiritilmagan"}</p>
                      <p className="mt-2 text-sm text-white/45">Homework: {entry.homework ?? 0}%</p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold ${attendanceTone(entry.status)}`}>
                      {attendanceLabel(entry.status)}
                    </span>
                  </article>
                ))
              ) : (
                <p className="text-white/55">Hali attendance tarixi yo'q.</p>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-white/35">Gradebook</p>
                <h2 className="mt-2 text-2xl font-bold">Baholar tarixi</h2>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-2 text-xs font-semibold text-white/65">
                {student.grades.length} ta baho
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {recentGrades.length ? (
                recentGrades.map((grade) => {
                  const percent = Math.round((grade.score / grade.maxScore) * 100);
                  return (
                    <article key={grade.id} className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                      <p className="text-lg font-semibold">{grade.subject}</p>
                      <p className="mt-1 text-sm text-white/45">{formatDate(grade.examDate)}</p>
                      <p className="mt-4 text-2xl font-bold">{grade.score}/{grade.maxScore}</p>
                      <div className="mt-3 h-3 rounded-full bg-white/10">
                        <div className="h-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${percent}%` }} />
                      </div>
                      <p className="mt-3 text-sm text-white/45">{grade.note || "Teacher izohi yo'q."}</p>
                    </article>
                  );
                })
              ) : (
                <p className="text-white/55">Hali baholar yo'q.</p>
              )}
            </div>
          </section>
        </section>

        <section className="space-y-5">
          <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-white/35">To'lov markazi</p>
                <h2 className="mt-2 text-2xl font-bold">Invoice va to'lovlar</h2>
              </div>
              {billing ? (
                <span className={`inline-flex rounded-full px-3 py-2 text-xs font-semibold ${paymentStatusTone(billing.status)}`}>
                  {paymentStatusLabel(billing.status)}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                <p className="text-sm text-white/45">Oylik tarif</p>
                <p className="mt-2 text-lg font-semibold">{formatCurrency(billing?.monthlyFee ?? group?.monthlyFee ?? 0)}</p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                <p className="text-sm text-white/45">Muddat</p>
                <p className="mt-2 text-lg font-semibold">{billing?.dueDate ? formatDate(billing.dueDate) : "Belgilanmagan"}</p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                <p className="text-sm text-white/45">Jami to'langan</p>
                <p className="mt-2 text-lg font-semibold">{formatCurrency(billing?.totalPaid ?? 0)}</p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                <p className="text-sm text-white/45">Qolgan qarz</p>
                <p className="mt-2 text-lg font-semibold">{formatCurrency(billing?.outstanding ?? 0)}</p>
              </div>
            </div>

            <div className="mt-5 rounded-[20px] border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-emerald-300/70">To'lov yuborish</p>
                  <h3 className="mt-2 text-xl font-semibold">Admin tasdiqlashi uchun so'rov yuboring</h3>
                </div>
                {paymentToast ? <span className="rounded-full bg-white/8 px-3 py-2 text-xs font-semibold text-white/75">{paymentToast}</span> : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm text-white/45">Summa</span>
                  <input
                    value={paymentRequest.amount}
                    onChange={(event) => setPaymentRequest((prev) => ({ ...prev, amount: event.target.value }))}
                    className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm text-white/45">Oy</span>
                  <input
                    value={paymentRequest.month}
                    onChange={(event) => setPaymentRequest((prev) => ({ ...prev, month: event.target.value }))}
                    placeholder="YYYY-MM"
                    className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm text-white/45">To'lov sanasi</span>
                  <input
                    value={paymentRequest.paidAt}
                    onChange={(event) => setPaymentRequest((prev) => ({ ...prev, paidAt: event.target.value }))}
                    className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm text-white/45">Usul</span>
                  <select
                    value={paymentRequest.method}
                    onChange={(event) => setPaymentRequest((prev) => ({ ...prev, method: event.target.value as PaymentMethod }))}
                    className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none"
                  >
                    <option value="card">Karta</option>
                    <option value="transfer">O'tkazma</option>
                    <option value="cash">Naqd</option>
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-sm text-white/45">Tranzaksiya ID</span>
                  <input
                    value={paymentRequest.transactionId}
                    onChange={(event) => setPaymentRequest((prev) => ({ ...prev, transactionId: event.target.value }))}
                    className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm text-white/45">Chek yoki izoh</span>
                  <input
                    value={paymentRequest.proofNote}
                    onChange={(event) => setPaymentRequest((prev) => ({ ...prev, proofNote: event.target.value }))}
                    placeholder="Chek raqami, bank izohi..."
                    className="w-full rounded-2xl border border-white/8 bg-[#0b1120] px-4 py-3 text-white outline-none"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => void handlePaymentRequest()}
                disabled={paymentBusy}
                className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {paymentBusy ? "Yuborilmoqda..." : "To'lov so'rovini yuborish"}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {recentPayments.length ? (
                recentPayments.map((payment) => (
                  <article key={payment.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-white/8 bg-black/10 p-4">
                    <div>
                      <p className="text-lg font-semibold">{formatCurrency(payment.amount)}</p>
                      <p className="mt-1 text-sm text-white/45">
                        {formatDate(payment.paidAt)} · {paymentMethodLabel(payment.method)} {payment.month ? `· ${payment.month}` : ""}
                      </p>
                      <p className="mt-2 text-sm text-white/45">{payment.proofNote || payment.note || "Izoh yo'q"}</p>
                      {payment.transactionId ? <p className="mt-1 text-xs text-white/35">ID: {payment.transactionId}</p> : null}
                    </div>
                    <span className={`rounded-full px-3 py-2 text-xs font-semibold ${requestStatusTone(payment.status)}`}>{requestStatusLabel(payment.status)}</span>
                  </article>
                ))
              ) : (
                <p className="text-white/55">Hali payment history yo'q.</p>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-white/35">Bootcamplar</p>
            <div className="mt-5 space-y-3">
              {enrollments.length ? (
                enrollments.map((enrollment) => (
                  <article key={enrollment.id} className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                    <h3 className="text-lg font-semibold">{enrollment.bootcampName ?? "Bootcamp"}</h3>
                    <p className="mt-1 text-sm text-white/45">Boshlanish: {formatDate(enrollment.startDate)}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-sm text-white/45">Narxi</p>
                        <p className="mt-1 font-semibold">{formatCurrency(enrollment.bootcampPrice ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-white/45">To'lagani</p>
                        <p className="mt-1 font-semibold">{formatCurrency(enrollment.paymentAmount)}</p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-white/55">Sizga hali bootcamp biriktirilmagan.</p>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/8 bg-white/5 p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-white/35">Xabarnomalar</p>
            <div className="mt-5 space-y-3">
              {notificationError ? <p className="text-rose-300">{notificationError}</p> : null}
              {notifications.length ? (
                notifications.map((notification) => (
                  <article key={notification.id} className="rounded-[20px] border border-white/8 bg-black/10 p-4">
                    <p className="text-lg font-semibold">{notification.title}</p>
                    <p className="mt-2 text-sm text-white/55">{notification.message}</p>
                    <p className="mt-3 text-xs text-white/35">{new Date(notification.createdAt).toLocaleString("uz-UZ")}</p>
                  </article>
                ))
              ) : (
                <p className="text-white/55">Hozircha xabarnoma yo'q.</p>
              )}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
