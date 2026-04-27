"use client";

import { useState } from "react";
import type { Student } from "@/lib/types";
import type {
  BootcampFormState,
  EnrollmentFormState,
  GroupFormState,
  PaymentFormState,
  StudentFormState,
  TeacherFormState,
  ThemeMode,
} from "@/components/admin/constants";
import { InfoCard, InputField } from "@/components/admin/ui";
import { formatCurrency } from "@/lib/ui/billing-formatters";

type GroupOption = {
  id: string;
  name: string;
  teacher: string;
};

function modalShell(theme: ThemeMode) {
  return theme === "day"
    ? "border-slate-200 bg-white text-slate-950"
    : "border-white/10 bg-[#0f152a]";
}

function mute(theme: ThemeMode) {
  return theme === "day" ? "text-slate-400" : "text-white/40";
}

function closeButton(theme: ThemeMode) {
  return theme === "day" ? "bg-slate-100 text-slate-600" : "bg-white/5 text-white/60";
}

function selectShell(theme: ThemeMode) {
  return theme === "day"
    ? "border-slate-200 bg-slate-50 text-slate-900"
    : "border-white/8 bg-white/5 text-white";
}

function formatDateTime(value?: string) {
  if (!value) return "Mavjud emas";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("uz-UZ");
}

type StudentModalProps = {
  open: boolean;
  isEditing: boolean;
  theme: ThemeMode;
  form: StudentFormState;
  availableTeachers: string[];
  filteredGroups: GroupOption[];
  registrationFee: number;
  registrationPaidAmount: number;
  registrationDueAmount: number;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (updater: (prev: StudentFormState) => StudentFormState) => void;
};

export function StudentModal({
  open,
  isEditing,
  theme,
  form,
  availableTeachers,
  filteredGroups,
  registrationFee,
  registrationPaidAmount,
  registrationDueAmount,
  onClose,
  onSubmit,
  onChange,
}: StudentModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <div className={`max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[30px] border p-5 shadow-[0_22px_90px_rgba(0,0,0,0.45)] ${modalShell(theme)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm uppercase tracking-[0.28em] ${mute(theme)}`}>{isEditing ? "O'quvchini tahrirlash" : "Yangi o'quvchi"}</p>
            <h3 className="mt-2 text-3xl font-bold">{isEditing ? "Student ma'lumotlari" : "Ro'yxatdan o'tkazish"}</h3>
          </div>
          <button type="button" onClick={onClose} className={`rounded-2xl px-4 py-2 ${closeButton(theme)}`}>
            Yopish
          </button>
        </div>

        <form noValidate className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <InputField value={form.fullName} onChange={(value) => onChange((prev) => ({ ...prev, fullName: value }))} placeholder="F.I.Sh" theme={theme} />
          <label className={`rounded-2xl border px-4 py-3 ${selectShell(theme)}`}>
            <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>Teacher</span>
            <select
              value={form.teacher}
              onChange={(event) =>
                onChange((prev) => ({
                  ...prev,
                  teacher: event.target.value,
                  group: "",
                }))
              }
              className={`w-full bg-transparent outline-none ${theme === "day" ? "text-slate-900" : "text-white"}`}
            >
              <option value="">Teacher tanlang</option>
              {[...new Set(availableTeachers)].map((teacher, index) => (
                <option key={`${teacher}-${index}`} value={teacher}>
                  {teacher}
                </option>
              ))}
            </select>
          </label>
          <label className={`rounded-2xl border px-4 py-3 ${selectShell(theme)}`}>
            <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>Guruh</span>
            <select
              value={form.group}
              onChange={(event) => {
                const selectedGroup = filteredGroups.find((group) => group.name === event.target.value);
                onChange((prev) => ({
                  ...prev,
                  group: event.target.value,
                  teacher: selectedGroup?.teacher ?? prev.teacher,
                }));
              }}
              className={`w-full bg-transparent outline-none ${theme === "day" ? "text-slate-900" : "text-white"}`}
            >
              <option value="">Guruh tanlang</option>
              {filteredGroups.map((group) => (
                <option key={group.id} value={group.name}>
                  {group.name} {group.teacher ? `· ${group.teacher}` : ""}
                </option>
              ))}
            </select>
          </label>
          <InputField value={form.phone} onChange={(value) => onChange((prev) => ({ ...prev, phone: value }))} placeholder="Telefon" theme={theme} />
          <InputField value={form.parentPhone} onChange={(value) => onChange((prev) => ({ ...prev, parentPhone: value }))} placeholder="Ota-ona telefoni" theme={theme} />
          <label className={`rounded-2xl border px-4 py-3 ${selectShell(theme)}`}>
            <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>To'lov holati</span>
            <select
              value={form.paymentStatus}
              onChange={(event) =>
                onChange((prev) => ({
                  ...prev,
                  paymentStatus: event.target.value as StudentFormState["paymentStatus"],
                  paidAmount:
                    event.target.value === "unpaid"
                      ? "0"
                      : event.target.value === "full" && registrationFee > 0
                        ? String(registrationFee)
                        : prev.paidAmount,
                }))
              }
              className={`w-full bg-transparent outline-none ${theme === "day" ? "text-slate-900" : "text-white"}`}
            >
              <option value="unpaid">Umuman to'lamagan</option>
              <option value="partial">Qisman to'lagan</option>
              <option value="full">To'liq to'lagan</option>
            </select>
          </label>
          <InputField value={form.paidAmount} onChange={(value) => onChange((prev) => ({ ...prev, paidAmount: value }))} placeholder="Qancha to'lagan" theme={theme} />
          {!isEditing ? <InputField value={form.email} onChange={(value) => onChange((prev) => ({ ...prev, email: value }))} placeholder="Student login" theme={theme} /> : <div />}
          {!isEditing ? <InputField value={form.password} onChange={(value) => onChange((prev) => ({ ...prev, password: value }))} placeholder="Student parol" theme={theme} /> : <div />}
          <div className={`rounded-[22px] border p-3 md:col-span-2 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
            <div className="grid gap-3 md:grid-cols-3">
              <InfoCard label="Guruh tarifi" value={registrationFee ? formatCurrency(registrationFee) : "Kiritilmagan"} theme={theme} />
              <InfoCard label="To'langan" value={formatCurrency(Number.isFinite(registrationPaidAmount) ? registrationPaidAmount : 0)} theme={theme} />
              <InfoCard label="Qoldiq" value={formatCurrency(registrationDueAmount)} theme={theme} />
            </div>
            <p className={`mt-3 text-sm ${theme === "day" ? "text-slate-500" : "text-white/45"}`}>
              Admin guruhni tanlaydi, tizim oylik tarifga qarab studentning boshlang'ich to'lov holatini avtomatik hisoblaydi.
            </p>
          </div>
          <textarea
            value={form.notes}
            onChange={(event) => onChange((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Izoh"
            className={`min-h-20 rounded-2xl border px-4 py-3 outline-none md:col-span-2 ${theme === "day" ? "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400" : "border-white/8 bg-white/5 text-white placeholder:text-white/35"}`}
          />
          <button type="submit" className="rounded-2xl bg-gradient-to-r from-blue-500 to-sky-400 px-5 py-3 text-base font-semibold text-white md:col-span-2">
            {isEditing ? "Yangilash" : "Saqlash"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function GroupModal({
  open,
  isEditing,
  theme,
  form,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean;
  isEditing: boolean;
  theme: ThemeMode;
  form: GroupFormState;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (updater: (prev: GroupFormState) => GroupFormState) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <div className={`w-full max-w-xl rounded-[30px] border p-6 shadow-[0_22px_90px_rgba(0,0,0,0.45)] ${modalShell(theme)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm uppercase tracking-[0.28em] ${mute(theme)}`}>{isEditing ? "Guruhni tahrirlash" : "Yangi guruh"}</p>
            <h3 className="mt-2 text-3xl font-bold">{isEditing ? "Guruh ma'lumotlari" : "Guruh yaratish"}</h3>
          </div>
          <button type="button" onClick={onClose} className={`rounded-2xl px-4 py-2 ${closeButton(theme)}`}>Yopish</button>
        </div>
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <InputField value={form.name} onChange={(value) => onChange((prev) => ({ ...prev, name: value }))} placeholder="Guruh nomi" theme={theme} />
          <InputField value={form.teacher} onChange={(value) => onChange((prev) => ({ ...prev, teacher: value }))} placeholder="O'qituvchi" theme={theme} />
          <InputField value={form.schedule} onChange={(value) => onChange((prev) => ({ ...prev, schedule: value }))} placeholder="Jadval" theme={theme} />
          <InputField value={form.room} onChange={(value) => onChange((prev) => ({ ...prev, room: value }))} placeholder="Xona" theme={theme} />
          <InputField value={form.monthlyFee} onChange={(value) => onChange((prev) => ({ ...prev, monthlyFee: value }))} placeholder="Oylik to'lov" theme={theme} />
          <button type="submit" className="rounded-2xl bg-gradient-to-r from-blue-500 to-sky-400 px-5 py-3 text-base font-semibold text-white md:col-span-2">
            {isEditing ? "Guruhni yangilash" : "Guruhni saqlash"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function TeacherModal({
  open,
  theme,
  form,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean;
  theme: ThemeMode;
  form: TeacherFormState;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (updater: (prev: TeacherFormState) => TeacherFormState) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <div className={`w-full max-w-xl rounded-[30px] border p-6 shadow-[0_22px_90px_rgba(0,0,0,0.45)] ${modalShell(theme)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm uppercase tracking-[0.28em] ${mute(theme)}`}>Yangi teacher</p>
            <h3 className="mt-2 text-3xl font-bold">Teacher account yaratish</h3>
          </div>
          <button type="button" onClick={onClose} className={`rounded-2xl px-4 py-2 ${closeButton(theme)}`}>Yopish</button>
        </div>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <InputField value={form.fullName} onChange={(value) => onChange((prev) => ({ ...prev, fullName: value }))} placeholder="Teacher F.I.Sh" theme={theme} />
          <InputField value={form.email} onChange={(value) => onChange((prev) => ({ ...prev, email: value }))} placeholder="Teacher login" theme={theme} />
          <InputField value={form.password} onChange={(value) => onChange((prev) => ({ ...prev, password: value }))} placeholder="Teacher parol" theme={theme} />
          <button type="submit" className="rounded-2xl bg-gradient-to-r from-blue-500 to-sky-400 px-5 py-3 text-base font-semibold text-white">Teacher yaratish</button>
        </form>
      </div>
    </div>
  );
}

export function PaymentModal({
  open,
  theme,
  selectedStudent,
  form,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean;
  theme: ThemeMode;
  selectedStudent: Student | null;
  form: PaymentFormState;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (updater: (prev: PaymentFormState) => PaymentFormState) => void;
}) {
  if (!open || !selectedStudent) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <div className={`w-full max-w-xl rounded-[30px] border p-6 shadow-[0_22px_90px_rgba(0,0,0,0.45)] ${modalShell(theme)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm uppercase tracking-[0.28em] ${mute(theme)}`}>To'lov kiritish</p>
            <h3 className="mt-2 text-3xl font-bold">{selectedStudent.fullName}</h3>
          </div>
          <button type="button" onClick={onClose} className={`rounded-2xl px-4 py-2 ${closeButton(theme)}`}>Yopish</button>
        </div>
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <InputField value={form.amount} onChange={(value) => onChange((prev) => ({ ...prev, amount: value }))} placeholder="To'lov summasi" theme={theme} />
          <InputField value={form.paidAt} onChange={(value) => onChange((prev) => ({ ...prev, paidAt: value }))} placeholder="Sana YYYY-MM-DD" theme={theme} />
          <InputField value={form.month} onChange={(value) => onChange((prev) => ({ ...prev, month: value }))} placeholder="Oy YYYY-MM" theme={theme} />
          <select
            value={form.method}
            onChange={(event) => onChange((prev) => ({ ...prev, method: event.target.value as PaymentFormState["method"] }))}
            className={`rounded-2xl border px-4 py-3 outline-none ${selectShell(theme)}`}
          >
            <option value="cash">Naqd</option>
            <option value="card">Karta</option>
            <option value="transfer">O'tkazma</option>
          </select>
          <InputField value={form.transactionId} onChange={(value) => onChange((prev) => ({ ...prev, transactionId: value }))} placeholder="Tranzaksiya ID" theme={theme} />
          <InputField value={form.proofNote} onChange={(value) => onChange((prev) => ({ ...prev, proofNote: value }))} placeholder="Chek yoki proof izohi" theme={theme} />
          <InputField value={form.note} onChange={(value) => onChange((prev) => ({ ...prev, note: value }))} placeholder="Izoh" theme={theme} />
          <button type="submit" className="rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-400 px-5 py-3 text-base font-semibold text-white md:col-span-2">To'lovni saqlash</button>
        </form>
      </div>
    </div>
  );
}

export function BootcampModal({
  open,
  isEditing,
  theme,
  form,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean;
  isEditing: boolean;
  theme: ThemeMode;
  form: BootcampFormState;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (updater: (prev: BootcampFormState) => BootcampFormState) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <div className={`w-full max-w-xl rounded-[30px] border p-6 shadow-[0_22px_90px_rgba(0,0,0,0.45)] ${modalShell(theme)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm uppercase tracking-[0.28em] ${mute(theme)}`}>{isEditing ? "Bootcampni tahrirlash" : "Yangi bootcamp"}</p>
            <h3 className="mt-2 text-3xl font-bold">{isEditing ? "Bootcamp ma'lumotlari" : "Kurs yaratish"}</h3>
          </div>
          <button type="button" onClick={onClose} className={`rounded-2xl px-4 py-2 ${closeButton(theme)}`}>Yopish</button>
        </div>
        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <InputField value={form.name} onChange={(value) => onChange((prev) => ({ ...prev, name: value }))} placeholder="Bootcamp nomi" theme={theme} />
          <InputField value={form.price} onChange={(value) => onChange((prev) => ({ ...prev, price: value }))} placeholder="Bootcamp narxi" theme={theme} />
          <button type="submit" className="rounded-2xl bg-gradient-to-r from-blue-500 to-sky-400 px-5 py-3 text-base font-semibold text-white">
            {isEditing ? "Bootcampni yangilash" : "Bootcampni saqlash"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function EnrollmentModal({
  open,
  isEditing,
  theme,
  form,
  students,
  bootcamps,
  enrollmentStudentName,
  enrollmentBootcampName,
  enrollmentBootcampPrice,
  enrollmentRemaining,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean;
  isEditing: boolean;
  theme: ThemeMode;
  form: EnrollmentFormState;
  students: Student[];
  bootcamps: { id: string; name: string; price: number }[];
  enrollmentStudentName: string;
  enrollmentBootcampName: string;
  enrollmentBootcampPrice: number;
  enrollmentRemaining: number;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: (updater: (prev: EnrollmentFormState) => EnrollmentFormState) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <div className={`w-full max-w-2xl rounded-[30px] border p-6 shadow-[0_22px_90px_rgba(0,0,0,0.45)] ${modalShell(theme)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm uppercase tracking-[0.28em] ${mute(theme)}`}>Enrollment</p>
            <h3 className="mt-2 text-3xl font-bold">{isEditing ? "Enrollmentni tahrirlash" : "Studentni bootcampga biriktirish"}</h3>
          </div>
          <button type="button" onClick={onClose} className={`rounded-2xl px-4 py-2 ${closeButton(theme)}`}>Yopish</button>
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <label className={`rounded-2xl border px-4 py-3 ${selectShell(theme)}`}>
            <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>Student</span>
            <select
              disabled={isEditing}
              value={form.studentId}
              onChange={(event) => onChange((prev) => ({ ...prev, studentId: event.target.value }))}
              className={`w-full bg-transparent outline-none ${theme === "day" ? "text-slate-900" : "text-white"}`}
            >
              <option value="">Student tanlang</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className={`rounded-2xl border px-4 py-3 ${selectShell(theme)}`}>
            <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>Bootcamp</span>
            <select
              disabled={isEditing}
              value={form.bootcampId}
              onChange={(event) => {
                const selectedBootcampId = event.target.value;
                const selectedBootcamp = bootcamps.find((bootcamp) => bootcamp.id === selectedBootcampId);
                onChange((prev) => ({
                  ...prev,
                  bootcampId: selectedBootcampId,
                  paymentAmount:
                    prev.paymentStatus === "paid" && selectedBootcamp
                      ? String(selectedBootcamp.price)
                      : prev.paymentAmount,
                }));
              }}
              className={`w-full bg-transparent outline-none ${theme === "day" ? "text-slate-900" : "text-white"}`}
            >
              <option value="">Bootcamp tanlang</option>
              {bootcamps.map((bootcamp) => (
                <option key={bootcamp.id} value={bootcamp.id}>
                  {bootcamp.name}
                </option>
              ))}
            </select>
          </label>
          <InputField value={form.paymentAmount} onChange={(value) => onChange((prev) => ({ ...prev, paymentAmount: value }))} placeholder="To'langan summa" theme={theme} />
          <label className={`rounded-2xl border px-4 py-3 ${selectShell(theme)}`}>
            <span className={`mb-2 block text-xs uppercase tracking-[0.24em] ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>To'lov holati</span>
            <select
              value={form.paymentStatus}
              onChange={(event) =>
                onChange((prev) => ({
                  ...prev,
                  paymentStatus: event.target.value as EnrollmentFormState["paymentStatus"],
                  paymentAmount:
                    event.target.value === "unpaid"
                      ? "0"
                      : event.target.value === "paid" && enrollmentBootcampPrice
                        ? String(enrollmentBootcampPrice)
                        : prev.paymentAmount,
                }))
              }
              className={`w-full bg-transparent outline-none ${theme === "day" ? "text-slate-900" : "text-white"}`}
            >
              <option value="unpaid">To'lanmagan</option>
              <option value="partial">Qisman to'langan</option>
              <option value="paid">To'liq to'langan</option>
            </select>
          </label>
          <InputField value={form.startDate} onChange={(value) => onChange((prev) => ({ ...prev, startDate: value }))} placeholder="Boshlanish sanasi YYYY-MM-DD" theme={theme} />
          <div className={`rounded-[22px] border p-4 md:col-span-2 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
            <div className="grid gap-3 md:grid-cols-4">
              <InfoCard label="Student" value={enrollmentStudentName || "Tanlanmagan"} theme={theme} />
              <InfoCard label="Bootcamp" value={enrollmentBootcampName || "Tanlanmagan"} theme={theme} />
              <InfoCard label="Narx" value={formatCurrency(enrollmentBootcampPrice)} theme={theme} />
              <InfoCard label="Qolgan balans" value={formatCurrency(enrollmentRemaining)} theme={theme} />
            </div>
          </div>
          <button type="submit" className="rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-base font-semibold text-white md:col-span-2">
            {isEditing ? "Enrollmentni yangilash" : "Enrollmentni saqlash"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function TelegramModal({
  open,
  theme,
  data,
  onClose,
  onSendCredentials,
}: {
  open: boolean;
  theme: ThemeMode;
  data: {
    studentId: string;
    studentName: string;
    botUsername: string;
    startLink: string;
    expiresAt: string;
    connectedAt?: string;
    username?: string;
    chatId?: string;
    credentialsSentAt?: string;
  } | null;
  onClose: () => void;
  onSendCredentials: (studentId: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!open || !data) return null;
  const currentData = data;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(currentData.startLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
      <div className={`w-full max-w-2xl rounded-[30px] border p-6 shadow-[0_22px_90px_rgba(0,0,0,0.45)] ${modalShell(theme)}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className={`text-sm uppercase tracking-[0.28em] ${mute(theme)}`}>Telegram</p>
            <h3 className="mt-2 text-3xl font-bold">{currentData.studentName}</h3>
          </div>
          <button type="button" onClick={onClose} className={`rounded-2xl px-4 py-2 ${closeButton(theme)}`}>
            Yopish
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <InfoCard label="Bot" value={currentData.botUsername ? `@${currentData.botUsername}` : "Aniqlanmagan"} theme={theme} />
          <InfoCard label="Holat" value={currentData.connectedAt ? "Ulangan" : "Ulanmagan"} theme={theme} />
          <InfoCard label="Ulangan vaqt" value={formatDateTime(currentData.connectedAt)} theme={theme} />
          <InfoCard label="Login yuborilgan" value={formatDateTime(currentData.credentialsSentAt)} theme={theme} />
        </div>

        <div className={`mt-5 rounded-[24px] border p-4 ${theme === "day" ? "border-slate-200 bg-slate-50" : "border-white/8 bg-white/5"}`}>
          <p className={`text-sm ${theme === "day" ? "text-slate-500" : "text-white/55"}`}>
            Studentga shu havolani yuboring. Havola muddati: {formatDateTime(currentData.expiresAt)} gacha.
          </p>
          <div className={`mt-3 break-all rounded-2xl border px-4 py-4 text-sm ${theme === "day" ? "border-slate-200 bg-white text-slate-800" : "border-white/8 bg-[#0b1120] text-white/90"}`}>
            {currentData.startLink}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white"
            >
              {copied ? "Nusxalandi" : "Linkni nusxalash"}
            </button>
            <button
              type="button"
              onClick={() => onSendCredentials(currentData.studentId)}
              disabled={!currentData.connectedAt}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold ${
                currentData.connectedAt
                  ? "bg-gradient-to-r from-emerald-500 to-cyan-400 text-white"
                  : theme === "day"
                    ? "bg-slate-200 text-slate-500"
                    : "bg-white/10 text-white/45"
              }`}
            >
              Login va parol yuborish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
