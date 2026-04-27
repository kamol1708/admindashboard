"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AttendanceEntry,
  AttendanceState,
  Bootcamp,
  DashboardResponse,
  Enrollment,
  Student,
  StudentStatus,
} from "@/lib/types";
import { apiJson, apiVoid, ClientApiError } from "@/lib/client/http";
import {
  AdminTab,
  AttendanceLessonDraft,
  dayShell,
  defaultBootcampForm,
  defaultEnrollmentForm,
  defaultGroupForm,
  defaultPaymentForm,
  defaultStudentForm,
  defaultTeacherForm,
  sidebarItems,
  StudentFilter,
  StudentPaymentFilter,
  StudentSort,
  teacherPool,
  ThemeMode,
} from "@/components/admin/constants";
import {
  GroupsPanel as GroupsPanelSection,
  PaymentsPanel as PaymentsPanelSection,
  StudentsPanel as StudentsPanelSection,
} from "@/components/admin/panels-core";
import { DashboardPanel } from "@/components/admin/panels-dashboard";
import { TeachersPanel as TeachersPanelSection } from "@/components/admin/panels-academic";
import { CoursesPanel as CoursesPanelSection, SettingsPanel as SettingsPanelSection } from "@/components/admin/panels-ops";
import {
  BootcampModal,
  EnrollmentModal,
  GroupModal,
  PaymentModal,
  StudentModal,
  TelegramModal,
  TeacherModal,
} from "@/components/admin/modals";
import { buildLessonLibrary, latestAttendance } from "@/components/admin/utils";
import { billingStatusLabel, billingStatusTone, formatCurrency } from "@/lib/ui/billing-formatters";

type TelegramModalState = {
  studentId: string;
  studentName: string;
  botUsername: string;
  startLink: string;
  expiresAt: string;
  connectedAt?: string;
  username?: string;
  chatId?: string;
  credentialsSentAt?: string;
};

export function AdminDashboard({ adminName }: { adminName: string }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [theme, setTheme] = useState<ThemeMode>("day");
  const [search, setSearch] = useState("");
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [showBootcampModal, setShowBootcampModal] = useState(false);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [telegramModal, setTelegramModal] = useState<TelegramModalState | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingBootcampId, setEditingBootcampId] = useState<string | null>(null);
  const [editingEnrollmentId, setEditingEnrollmentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState(defaultStudentForm);
  const [groupForm, setGroupForm] = useState(defaultGroupForm);
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm);
  const [teacherForm, setTeacherForm] = useState(defaultTeacherForm);
  const [bootcampForm, setBootcampForm] = useState(defaultBootcampForm);
  const [enrollmentForm, setEnrollmentForm] = useState(defaultEnrollmentForm);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentFilter, setStudentFilter] = useState<StudentFilter>("all");
  const [studentSort, setStudentSort] = useState<StudentSort>("name");
  const [studentGroupFilter, setStudentGroupFilter] = useState("all");
  const [studentTeacherFilter, setStudentTeacherFilter] = useState("all");
  const [studentPaymentFilter, setStudentPaymentFilter] = useState<StudentPaymentFilter>("all");
  const [studentPage, setStudentPage] = useState(1);
  const [toast, setToast] = useState("");
  const [settingsState, setSettingsState] = useState({
    autoMessages: true,
    smsReminder: true,
    parentDigest: false,
  });
  const [lessonDrafts, setLessonDrafts] = useState<AttendanceLessonDraft[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    try {
      const payload = await apiJson<DashboardResponse>("/api/students", { cache: "no-store" });
      setData(payload);
      setSelectedStudentId((current) => current || payload.students[0]?.id || "");
    } catch (error) {
      setToast(error instanceof ClientApiError ? error.message : "Dashboard ma'lumotlarini o'qishda xatolik yuz berdi.");
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("admin-theme");
    if (stored === "day" || stored === "night") {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("attendance-lessons");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as AttendanceLessonDraft[];
      setLessonDrafts(parsed);
    } catch {
      setLessonDrafts([]);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function openPaymentModal() {
    setPaymentForm({
      ...defaultPaymentForm,
      paidAt: new Date().toISOString().slice(0, 10),
      month: new Date().toISOString().slice(0, 7),
    });
    setShowPaymentModal(true);
  }

  useEffect(() => {
    window.localStorage.setItem("attendance-lessons", JSON.stringify(lessonDrafts));
  }, [lessonDrafts]);

  const students = data?.students ?? [];
  const bootcamps = data?.bootcamps ?? [];
  const enrollments = data?.enrollments ?? [];
  const billing = data?.billing ?? [];
  const insights = data?.insights ?? [];
  const billingByStudentId = useMemo(() => new Map(billing.map((item) => [item.studentId, item])), [billing]);
  const insightByStudentId = useMemo(() => new Map(insights.map((item) => [item.id, item])), [insights]);
  const filteredStudents = useMemo(() => {
    const searched = students.filter((student) => {
      const billingMeta = billingByStudentId.get(student.id);
      const insightMeta = insightByStudentId.get(student.id);
      const haystack = [
        student.id,
        student.fullName,
        student.group,
        student.phone,
        student.parentPhone,
        student.notes,
        billingStatusLabel(billingMeta?.status ?? "unpaid"),
        billingMeta?.dueDate ?? "",
        insightMeta?.riskLabel ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search.toLowerCase());
    });

    const filtered = searched.filter((student) => {
      const billingMeta = billingByStudentId.get(student.id);
      if (studentFilter === "active") return student.status === "active";
      if (studentFilter === "risk") return student.status === "warning" || student.status === "probation" || student.status === "removed";
      if (studentFilter === "debt") return (billingMeta?.outstanding ?? 0) > 0 || billingMeta?.status === "overdue";
      return true;
    });

    const advancedFiltered = filtered.filter((student) => {
      const billingMeta = billingByStudentId.get(student.id);
      const groupMeta = data?.groups?.find((group) => group.name === student.group);

      if (studentGroupFilter !== "all" && student.group !== studentGroupFilter) return false;
      if (studentTeacherFilter !== "all" && groupMeta?.teacher !== studentTeacherFilter) return false;
      if (studentPaymentFilter !== "all" && (billingMeta?.status ?? "unpaid") !== studentPaymentFilter) return false;
      return true;
    });

    const withAttendance = advancedFiltered.map((student) => {
      const total = student.attendance.length;
      const present = student.attendance.filter((item) => item.status === "present").length;
      const attendancePercent = Math.round((present / Math.max(total, 1)) * 100);
      const outstanding = billingByStudentId.get(student.id)?.outstanding ?? 0;
      return { student, attendancePercent, outstanding };
    });

    withAttendance.sort((a, b) => {
      if (studentSort === "attendance") return b.attendancePercent - a.attendancePercent;
      if (studentSort === "balance") return b.outstanding - a.outstanding;
      return a.student.fullName.localeCompare(b.student.fullName);
    });

    return withAttendance.map((item) => item.student);
  }, [billingByStudentId, data?.groups, insightByStudentId, search, studentFilter, studentGroupFilter, studentPaymentFilter, studentSort, studentTeacherFilter, students]);

  useEffect(() => {
    setStudentPage(1);
  }, [studentFilter, studentGroupFilter, studentPaymentFilter, studentSort, studentTeacherFilter, search]);

  const paginatedStudents = useMemo(() => {
    const pageSize = 6;
    const start = (studentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, studentPage]);

  const totalStudentPages = Math.max(1, Math.ceil(filteredStudents.length / 6));

  const selectedStudent =
    filteredStudents.find((student) => student.id === selectedStudentId) ?? filteredStudents[0] ?? students[0] ?? null;

  useEffect(() => {
    if (!filteredStudents.length) {
      setSelectedStudentId("");
      return;
    }

    if (!filteredStudents.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [filteredStudents, selectedStudentId]);

  const uniqueGroups = useMemo(() => {
    const baseGroups = data?.groups?.length
      ? data.groups
      : [...new Set(students.map((student) => student.group))].map((name, index) => ({
          id: `fallback-${index}`,
          name,
          teacher: teacherPool[index % teacherPool.length]?.name ?? "Tayinlanmagan",
          schedule: "Jadval belgilanmagan",
          room: "Room -",
          monthlyFee: 0,
        }));

    return baseGroups.map((group, index) => {
      const groupStudents = students.filter((student) => student.group === group.name);
      const attendanceAverage = Math.round(
        groupStudents.reduce((sum, student) => {
          const total = student.attendance.length;
          const positive = student.attendance.filter((item) => item.status === "present").length;
          return sum + (total ? (positive / total) * 100 : 100);
        }, 0) / Math.max(groupStudents.length, 1),
      );

      return {
        id: group.id,
        name: group.name,
        students: groupStudents.length,
        attendanceAverage,
        teacher: group.teacher || teacherPool[index % teacherPool.length]?.name || "Tayinlanmagan",
        schedule: group.schedule,
        room: group.room,
        monthlyFee: group.monthlyFee,
      };
    });
  }, [data?.groups, students]);

  const teacherUsers = useMemo(() => {
    const storedTeachers = (data?.users ?? []).filter((user) => user.role === "teacher");
    if (storedTeachers.length) {
      return storedTeachers.map((user, index) => ({
        name: user.fullName,
        subject: "Teacher account",
        groups: uniqueGroups.filter((group) => group.teacher === user.fullName).map((group) => group.name),
        load: `${80 + (index % 10)}%`,
        email: user.email,
      }));
    }

    return teacherPool.map((teacher) => ({
      ...teacher,
      email: `${teacher.name.toLowerCase().replace(/\s+/g, ".")}@hems.uz`,
    }));
  }, [data?.users, uniqueGroups]);

  const availableStudentTeachers = useMemo(
    () => [...new Set(uniqueGroups.map((group) => group.teacher).filter(Boolean))],
    [uniqueGroups],
  );
  const availableStudentGroups = useMemo(() => [...new Set(uniqueGroups.map((group) => group.name))], [uniqueGroups]);

  const filteredStudentGroups = useMemo(() => {
    if (!studentForm.teacher) return uniqueGroups;
    return uniqueGroups.filter((group) => group.teacher === studentForm.teacher);
  }, [studentForm.teacher, uniqueGroups]);

  const paymentRows = useMemo(() => {
    return students.map((student) => {
      const billingMeta = billing.find((item) => item.studentId === student.id);
      return {
        id: student.id,
        name: student.fullName,
        group: student.group,
        balance: student.balance,
        status: billingStatusLabel(billingMeta?.status ?? "unpaid"),
        rawStatus: billingMeta?.status ?? "unpaid",
        paidAmount: billingMeta?.totalPaid ?? 0,
        dueAmount: billingMeta?.outstanding ?? 0,
        monthlyFee: billingMeta?.monthlyFee ?? 0,
        totalDue: billingMeta?.totalDue ?? 0,
        dueDate: billingMeta?.dueDate ?? null,
        activeMonths: billingMeta?.activeMonths ?? 0,
      };
    });
  }, [billing, students]);

  const paymentRequests = useMemo(
    () =>
      students.flatMap((student) =>
        student.payments
          .filter((payment) => (payment.status ?? "approved") === "pending")
          .map((payment) => ({
            studentId: student.id,
            paymentId: payment.id,
            studentName: student.fullName,
            group: student.group,
            amount: payment.amount,
            month: payment.month,
            paidAt: payment.paidAt,
            method: payment.method,
            transactionId: payment.transactionId,
            proofNote: payment.proofNote,
            requestedAt: payment.requestedAt,
          })),
      ),
    [students],
  );

  const latestAttendanceRows = useMemo(() => {
    return students
      .map((student) => ({
        studentId: student.id,
        name: student.fullName,
        group: student.group,
        entry: latestAttendance(student),
      }))
      .filter((item) => item.entry)
      .sort((a, b) => b.entry!.date.localeCompare(a.entry!.date));
  }, [students]);

  const sixDayAttendance = useMemo(() => {
    const map = new Map<string, { present: number; total: number }>();
    students.forEach((student) => {
      student.attendance.forEach((entry) => {
        const current = map.get(entry.date) ?? { present: 0, total: 0 };
        current.total += 1;
        if (entry.status === "present") current.present += 1;
        map.set(entry.date, current);
      });
    });

    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([date, value]) => ({
        date,
        percent: Math.round((value.present / Math.max(value.total, 1)) * 100),
      }));
  }, [students]);

  const unpaidStudents = paymentRows.filter((row) => row.rawStatus === "unpaid" || row.rawStatus === "overdue");
  const absentToday = latestAttendanceRows.filter((row) => row.entry?.status === "absent");
  const income = paymentRows.reduce((sum, row) => sum + row.paidAmount, 0);
  const attendanceLessons = useMemo(() => {
    const deduped = new Map<string, AttendanceLessonDraft>();
    lessonDrafts.forEach((item) => deduped.set(`${item.date}-${item.title}`, item));
    return [...deduped.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [lessonDrafts]);

  const enrollmentStudent = students.find((student) => student.id === enrollmentForm.studentId) ?? null;
  const enrollmentBootcamp = bootcamps.find((bootcamp) => bootcamp.id === enrollmentForm.bootcampId) ?? null;
  const enrollmentPaymentAmount = Number(enrollmentForm.paymentAmount || 0);
  const enrollmentRemaining = Math.max((enrollmentBootcamp?.price ?? 0) - (Number.isFinite(enrollmentPaymentAmount) ? enrollmentPaymentAmount : 0), 0);
  const isEditingStudent = Boolean(editingStudentId);
  const isEditingGroup = Boolean(editingGroupId);
  const isEditingBootcamp = Boolean(editingBootcampId);
  const isEditingEnrollment = Boolean(editingEnrollmentId);

  async function handleCreateStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!studentForm.fullName.trim()) {
      setToast("Student F.I.Sh kiritilishi shart.");
      return;
    }

    if (!studentForm.group.trim()) {
      setToast("Student uchun guruh tanlanishi shart.");
      return;
    }

    if (!studentForm.phone.trim()) {
      setToast("Student telefoni kiritilishi shart.");
      return;
    }

    if (!studentForm.parentPhone.trim()) {
      setToast("Ota-ona telefoni kiritilishi shart.");
      return;
    }

    if (editingStudentId) {
      const response = await fetch(`/api/students/${editingStudentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: studentForm.fullName,
          group: studentForm.group,
          phone: studentForm.phone,
          parentPhone: studentForm.parentPhone,
          notes: studentForm.notes,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setToast(payload.error || "Student yangilanmadi.");
        return;
      }
      setShowStudentModal(false);
      setEditingStudentId(null);
      setStudentForm(defaultStudentForm);
      setToast("Student ma'lumotlari yangilandi.");
      await loadData();
      return;
    }

    if (!studentForm.email.trim()) {
      setToast("Student login kiritilishi shart.");
      return;
    }

    if (!studentForm.password.trim()) {
      setToast("Student paroli kiritilishi shart.");
      return;
    }

    const selectedGroupMeta = uniqueGroups.find((group) => group.name === studentForm.group);
    const monthlyFee = selectedGroupMeta?.monthlyFee ?? 0;
    const rawPaidAmount =
      studentForm.paymentStatus === "unpaid"
        ? 0
        : studentForm.paymentStatus === "full"
          ? monthlyFee || Number(studentForm.paidAmount)
          : Number(studentForm.paidAmount);
    const normalizedPaidAmount = Number.isFinite(rawPaidAmount) ? rawPaidAmount : 0;
    const computedBalance = monthlyFee > 0 ? normalizedPaidAmount - monthlyFee : normalizedPaidAmount;

    let createdStudent: Student | null = null;
    try {
      const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: studentForm.fullName,
          group: studentForm.group,
          phone: studentForm.phone,
          parentPhone: studentForm.parentPhone,
          email: studentForm.email,
          password: studentForm.password,
          notes: studentForm.notes,
          balance: computedBalance,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setToast(payload.error || "Student saqlanmadi.");
        return;
      }

      createdStudent = (await response.json()) as Student;

      if (normalizedPaidAmount > 0) {
        const paymentResponse = await fetch(`/api/students/${createdStudent.id}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: normalizedPaidAmount,
            paidAt: new Date().toISOString().slice(0, 10),
            method: "cash",
            note:
              studentForm.paymentStatus === "full"
                ? "Ro'yxatdan o'tishda to'liq to'lov"
                : "Ro'yxatdan o'tishda boshlang'ich to'lov",
          }),
        });

        if (!paymentResponse.ok) {
          const payload = (await paymentResponse.json().catch(() => ({}))) as { error?: string };
          setToast(payload.error || "Student yaratildi, lekin boshlang'ich to'lov saqlanmadi.");
          await loadData();
          setShowStudentModal(false);
          setStudentForm(defaultStudentForm);
          return;
        }
      }
    } catch {
      setToast("Student yaratishda tarmoq xatosi yuz berdi.");
      return;
    }

    if (!createdStudent) {
      setToast("Student saqlanmadi.");
      return;
    }

    setShowStudentModal(false);
    setStudentForm(defaultStudentForm);
    setToast("Yangi o'quvchi qo'shildi.");
    await loadData();
  }

  async function handleCreateTeacher(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiVoid("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...teacherForm,
          role: "teacher",
        }),
      });
    } catch (error) {
      setToast(error instanceof ClientApiError ? error.message : "Teacher yaratilmadi.");
      return;
    }
    setShowTeacherModal(false);
    setTeacherForm(defaultTeacherForm);
    setToast("Yangi teacher account yaratildi.");
    await loadData();
  }

  async function handleCreateBootcamp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(isEditingBootcamp ? `/api/bootcamps/${editingBootcampId}` : "/api/bootcamps", {
      method: isEditingBootcamp ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: bootcampForm.name,
        price: Number(bootcampForm.price),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setToast(payload.error || "Bootcamp saqlanmadi.");
      return;
    }

    setShowBootcampModal(false);
    setEditingBootcampId(null);
    setBootcampForm(defaultBootcampForm);
    setToast(isEditingBootcamp ? "Bootcamp yangilandi." : "Yangi bootcamp yaratildi.");
    await loadData();
  }

  async function handleCreateEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(isEditingEnrollment ? `/api/enrollments/${editingEnrollmentId}` : "/api/enrollments", {
      method: isEditingEnrollment ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: enrollmentForm.studentId,
        bootcampId: enrollmentForm.bootcampId,
        paymentAmount: Number(enrollmentForm.paymentAmount),
        paymentStatus: enrollmentForm.paymentStatus,
        startDate: enrollmentForm.startDate,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setToast(payload.error || "Enrollment saqlanmadi.");
      return;
    }

    setShowEnrollmentModal(false);
    setEditingEnrollmentId(null);
    setEnrollmentForm(defaultEnrollmentForm);
    setToast(isEditingEnrollment ? "Enrollment yangilandi." : "Student bootcampga biriktirildi.");
    await loadData();
  }

  async function handleClosePayment(studentId: string) {
    const target = students.find((student) => student.id === studentId);
    if (!target) return;

    await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        balance: 0,
        notes: `${target.notes}\nTo'lov admin tomonidan yopildi.`.trim(),
      }),
    });
    setToast("To'lov holati yangilandi.");
    await loadData();
  }

  async function handleAttendance(
    studentId: string,
    payload: { date: string; title: string; topic: string; status: AttendanceState; homework: number },
  ) {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;

    const response = await fetch(`/api/students/${studentId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: payload.date,
        lesson: payload.title,
        topic: payload.topic,
        homework: payload.homework,
        status: payload.status,
      }),
    });

    if (response.status === 409) {
      const payload = (await response.json()) as { error?: string };
      setToast(payload.error || "Bugungi davomat allaqachon olingan.");
      return;
    }

    setToast("Davomat yangilandi.");
    await loadData();
  }

  async function handleStatusChange(studentId: string, status: StudentStatus) {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;

    await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        notes: student.notes,
        balance: student.balance,
      }),
    });
    setToast("Talaba statusi yangilandi.");
    await loadData();
  }

  function exportStudents() {
    const header = ["O'quvchi", "Guruh", "Telefon", "Ota-ona", "Davomat", "To'lov"];
    const rows = filteredStudents.map((student) => [
      student.fullName,
      student.group,
      student.phone,
      student.parentPhone,
      `${Math.round(
        (student.attendance.filter((item) => item.status === "present").length / Math.max(student.attendance.length, 1)) *
          100,
      )}%`,
      String(student.balance),
    ]);

    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "students-report.csv";
    link.click();
    URL.revokeObjectURL(url);
    setToast("CSV eksport qilindi.");
  }

  function handlePrint() {
    window.print();
  }

  const shellClass =
    theme === "day"
      ? dayShell.shell
      : "min-h-screen bg-[radial-gradient(circle_at_top,#16203a,transparent_28%),linear-gradient(180deg,#07111f,#0c1526)] text-white";

  async function handleLogout() {
    await apiVoid("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/login");
    router.refresh();
  }

  async function handleCreateGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupForm.name.trim() || !groupForm.teacher.trim() || !groupForm.schedule.trim() || !groupForm.room.trim()) {
      setToast("Guruh uchun nom, mentor, jadval va xona kiritilishi shart.");
      return;
    }

    const normalizedMonthlyFee = Number(groupForm.monthlyFee.replace(/\s+/g, "").replace(/\./g, "").replace(/,/g, "."));

    let createdGroup: DashboardResponse["groups"][number];
    try {
      createdGroup = await apiJson<DashboardResponse["groups"][number]>(
        isEditingGroup ? `/api/groups/${editingGroupId}` : "/api/groups",
        {
          method: isEditingGroup ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...groupForm,
            monthlyFee: Number.isFinite(normalizedMonthlyFee) ? normalizedMonthlyFee : 0,
          }),
        },
      );
    } catch (error) {
      setToast(error instanceof ClientApiError ? error.message : "Guruh saqlanmadi.");
      return;
    }

    try {
      const groupsPayload = await apiJson<DashboardResponse["groups"]>("/api/groups", { cache: "no-store" });
      setData((current) =>
        current
          ? {
              ...current,
              groups: groupsPayload,
            }
          : current,
      );
    } catch {
      setData((current) =>
        current
          ? {
              ...current,
              groups: [createdGroup, ...current.groups.filter((group) => group.id !== createdGroup.id)],
            }
          : current,
      );
    }
    setShowGroupModal(false);
    setEditingGroupId(null);
    setGroupForm(defaultGroupForm);
    setToast(isEditingGroup ? "Guruh yangilandi." : "Yangi guruh yaratildi.");
  }

  async function handleCreatePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStudent) return;
    const normalizedPaidAt = paymentForm.paidAt?.trim() || new Date().toISOString().slice(0, 10);
    const normalizedMonth = paymentForm.month?.trim() || normalizedPaidAt.slice(0, 7);
    const response = await fetch(`/api/students/${selectedStudent.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...paymentForm,
        amount: Number(paymentForm.amount),
        paidAt: normalizedPaidAt,
        month: normalizedMonth,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setToast(payload.error || "To'lov saqlanmadi.");
      return;
    }
    setShowPaymentModal(false);
    setPaymentForm(defaultPaymentForm);
    setToast("To'lov tarixi yangilandi.");
    await loadData();
  }

  async function handleReviewPayment(studentId: string, paymentId: string, status: "approved" | "rejected") {
    const response = await fetch(`/api/students/${studentId}/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setToast(payload.error || "To'lov so'rovi yangilanmadi.");
      return;
    }

    setToast(status === "approved" ? "To'lov tasdiqlandi." : "To'lov rad etildi.");
    await loadData();
  }

  function openEditStudent(student: Student) {
    const matchedGroup = uniqueGroups.find((group) => group.name === student.group);
    setEditingStudentId(student.id);
    setStudentForm({
      fullName: student.fullName,
      teacher: matchedGroup?.teacher ?? "",
      group: student.group,
      phone: student.phone,
      parentPhone: student.parentPhone,
      balance: String(student.balance),
      paymentStatus: student.balance < 0 ? "unpaid" : "full",
      paidAmount: "0",
      email: "",
      password: "",
      notes: student.notes,
    });
    setShowStudentModal(true);
  }

  async function handleDeleteStudent(studentId: string) {
    try {
      await apiVoid(`/api/students/${studentId}`, { method: "DELETE" });
    } catch (error) {
      setToast(error instanceof ClientApiError ? error.message : "Student o'chirilmadi.");
      return;
    }
    setToast("Student o'chirildi.");
    setSelectedStudentId("");
    await loadData();
  }

  async function handleOpenTelegram(student: Student) {
    try {
      const response = await fetch(`/api/students/${student.id}/telegram/link`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as TelegramModalState & { error?: string };
      if (!response.ok) {
        setToast(payload.error || "Telegram link yaratilmadi.");
        return;
      }

      setTelegramModal(payload);
      await loadData();
    } catch {
      setToast("Telegram link yaratishda tarmoq xatosi yuz berdi.");
    }
  }

  async function handleSendTelegramCredentials(studentId: string) {
    try {
      const response = await fetch(`/api/students/${studentId}/telegram/credentials`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { sentAt?: string; error?: string };
      if (!response.ok) {
        setToast(payload.error || "Telegramga login va parol yuborilmadi.");
        return;
      }

      setTelegramModal((current) =>
        current && current.studentId === studentId
          ? {
              ...current,
              credentialsSentAt: payload.sentAt,
            }
          : current,
      );
      setToast("Student login va vaqtinchalik paroli Telegramga yuborildi.");
      await loadData();
    } catch {
      setToast("Telegramga yuborishda tarmoq xatosi yuz berdi.");
    }
  }

  function openEditGroup(groupId: string) {
    const group = uniqueGroups.find((item) => item.id === groupId);
    if (!group) return;
    setEditingGroupId(group.id);
    setGroupForm({
      name: group.name,
      teacher: group.teacher,
      schedule: group.schedule,
      room: group.room,
      monthlyFee: String(group.monthlyFee),
    });
    setShowGroupModal(true);
  }

  async function handleDeleteGroup(groupId: string) {
    try {
      await apiVoid(`/api/groups/${groupId}`, { method: "DELETE" });
    } catch (error) {
      setToast(error instanceof ClientApiError ? error.message : "Guruh o'chirilmadi.");
      return;
    }
    setToast("Guruh o'chirildi.");
    await loadData();
  }

  function openEditBootcamp(bootcamp: Bootcamp) {
    setEditingBootcampId(bootcamp.id);
    setBootcampForm({
      name: bootcamp.name,
      price: String(bootcamp.price),
    });
    setShowBootcampModal(true);
  }

  async function handleDeleteBootcamp(bootcampId: string) {
    try {
      await apiVoid(`/api/bootcamps/${bootcampId}`, { method: "DELETE" });
    } catch (error) {
      setToast(error instanceof ClientApiError ? error.message : "Bootcamp o'chirilmadi.");
      return;
    }
    setToast("Bootcamp o'chirildi.");
    await loadData();
  }

  function openEditEnrollment(enrollment: Enrollment) {
    setEditingEnrollmentId(enrollment.id);
    setEnrollmentForm({
      studentId: enrollment.studentId,
      bootcampId: enrollment.bootcampId,
      paymentAmount: String(enrollment.paymentAmount),
      paymentStatus: enrollment.paymentStatus,
      startDate: enrollment.startDate,
    });
    setShowEnrollmentModal(true);
  }

  async function handleDeleteEnrollment(enrollmentId: string) {
    try {
      await apiVoid(`/api/enrollments/${enrollmentId}`, { method: "DELETE" });
    } catch (error) {
      setToast(error instanceof ClientApiError ? error.message : "Enrollment o'chirilmadi.");
      return;
    }
    setToast("Enrollment o'chirildi.");
    await loadData();
  }

  function openNewStudentModal() {
    setEditingStudentId(null);
    setStudentForm(defaultStudentForm);
    setShowStudentModal(true);
  }

  function openNewStudentModalForGroup(groupId: string) {
    const group = uniqueGroups.find((item) => item.id === groupId);
    if (!group) {
      openNewStudentModal();
      return;
    }

    setEditingStudentId(null);
    setStudentForm({
      ...defaultStudentForm,
      group: group.name,
      teacher: group.teacher,
    });
    setShowStudentModal(true);
  }

  function openNewGroupModal() {
    setEditingGroupId(null);
    setGroupForm(defaultGroupForm);
    setShowGroupModal(true);
  }

  function openNewBootcampModal() {
    setEditingBootcampId(null);
    setBootcampForm(defaultBootcampForm);
    setShowBootcampModal(true);
  }

  function openNewEnrollmentModal() {
    setEditingEnrollmentId(null);
    setEnrollmentForm(defaultEnrollmentForm);
    setShowEnrollmentModal(true);
  }

  const selectedGroupMeta = uniqueGroups.find((group) => group.name === studentForm.group);
  const registrationFee = selectedGroupMeta?.monthlyFee ?? 0;
  const registrationPaidAmount =
    studentForm.paymentStatus === "unpaid"
      ? 0
      : studentForm.paymentStatus === "full"
        ? registrationFee || Number(studentForm.paidAmount)
        : Number(studentForm.paidAmount || 0);
  const registrationDueAmount = Math.max(registrationFee - (Number.isFinite(registrationPaidAmount) ? registrationPaidAmount : 0), 0);

  return (
    <main className={shellClass}>
      <div className="flex h-screen w-full gap-4 overflow-hidden p-2 md:gap-5 md:p-4">
        <aside className={`relative z-20 hidden h-[calc(100vh-1rem)] w-[250px] shrink-0 flex-col rounded-[28px] border p-4 shadow-[0_22px_80px_rgba(0,0,0,0.28)] lg:sticky lg:top-2 lg:flex ${
          theme === "day" ? dayShell.sidebar : "border-white/10 bg-[#070d18]/95"
        }`}>
          <div className={`flex items-center gap-4 rounded-[22px] border p-4 ${theme === "day" ? dayShell.panelSoft : "border-white/8 bg-white/[0.04]"}`}>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-xl text-white">
              🎓
            </div>
            <div>
              <p className={`text-[11px] uppercase tracking-[0.26em] ${theme === "day" ? "text-slate-400" : "text-white/35"}`}>Course center</p>
              <h1 className="text-xl font-bold">Kurs Boshqaruv</h1>
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            {sidebarItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                    active
                      ? theme === "day"
                        ? "bg-slate-950 text-white"
                        : "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-[0_14px_30px_rgba(250,204,21,0.24)]"
                      : theme === "day"
                        ? "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                        : "text-white/50 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  <span className={`grid h-8 w-8 place-items-center rounded-xl text-sm ${theme === "day" ? "bg-slate-100 text-slate-950" : active ? "bg-black/10" : "bg-white/5"}`}>{item.icon}</span>
                  <span className="text-base">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className={`mt-auto flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              theme === "day" ? "border-slate-200 bg-white text-slate-900" : "border-white/12 bg-transparent text-white/90 hover:bg-white/5"
            }`}
          >
            ⎋ Chiqish
          </button>
        </aside>

        <section className={`min-h-0 flex h-[calc(100vh-1rem)] min-w-0 flex-1 flex-col overflow-hidden rounded-[30px] border px-3 py-3 shadow-[0_22px_80px_rgba(0,0,0,0.28)] md:px-5 md:py-4 ${
          theme === "day" ? dayShell.panel : "border-white/10 bg-[#0a1220]/95"
        }`}>
          <header className={`relative z-10 shrink-0 rounded-[26px] border p-4 md:p-5 ${theme === "day" ? dayShell.panelSoft : "border-white/8 bg-[#0d1728]"}`}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className={`text-base ${theme === "day" ? dayShell.muted : "text-white/45"}`}>Xush kelibsiz</p>
                <h2 className="text-2xl font-bold md:text-4xl">{adminName}</h2>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <label className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${theme === "day" ? dayShell.input : "border-white/8 bg-[#0b1224] text-white/70"}`}>
                  <span>⌕</span>
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Ctrl+K"
                    className={`w-full bg-transparent text-sm outline-none md:w-44 ${theme === "day" ? "placeholder:text-slate-400" : "placeholder:text-white/40"}`}
                  />
                </label>

                <div
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${theme === "day" ? dayShell.input : "border-white/8 bg-[#0b1224] text-white"}`}
                >
                  Admin
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = theme === "day" ? "night" : "day";
                    setTheme(next);
                    window.localStorage.setItem("admin-theme", next);
                  }}
                  className={`rounded-2xl border px-5 py-3 text-sm font-semibold ${theme === "day" ? "border-slate-950 bg-slate-950 text-white" : "border-blue-400/30 bg-blue-500/10 text-white"}`}
                >
                  {theme === "day" ? "☾ Kechgi" : "☀ Kunduzgi"}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`rounded-2xl border px-5 py-3 text-sm font-semibold ${theme === "day" ? dayShell.input : "border-white/8 bg-white/5 text-white/85"}`}
                >
                  Chiqish
                </button>
              </div>
            </div>
          </header>

          <div className="mt-4 shrink-0 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`shrink-0 rounded-2xl border px-4 py-3 text-sm font-medium ${
                  activeTab === item.id
                    ? theme === "day"
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-sky-400/30 bg-sky-500/15 text-white"
                    : theme === "day"
                      ? "border-slate-200 bg-white text-slate-700"
                      : "border-white/8 bg-white/5 text-white/55"
                }`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>

          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="flex flex-col gap-5 pb-4">
            {activeTab === "dashboard" ? (
              <DashboardPanel
                data={data}
                absentToday={absentToday.length}
                income={income}
                sixDayAttendance={sixDayAttendance}
                unpaidStudents={unpaidStudents.length}
                totalTeachers={teacherUsers.length}
                onAddStudent={openNewStudentModal}
                onExport={exportStudents}
                onPrint={handlePrint}
                onOpenTab={setActiveTab}
                theme={theme}
              />
            ) : null}

            {activeTab === "students" ? (
              <StudentsPanelSection
                students={paginatedStudents}
                billing={billing}
                insights={insights}
                selectedStudent={selectedStudent}
                onAddStudent={openNewStudentModal}
                onAddPayment={openPaymentModal}
                onExport={exportStudents}
                onSelectStudent={setSelectedStudentId}
                onStatusChange={handleStatusChange}
                onEditStudent={openEditStudent}
                onDeleteStudent={handleDeleteStudent}
                onTelegram={handleOpenTelegram}
                filter={studentFilter}
                sort={studentSort}
                page={studentPage}
                totalPages={totalStudentPages}
                totalCount={filteredStudents.length}
                onFilterChange={setStudentFilter}
                onSortChange={setStudentSort}
                onPageChange={setStudentPage}
                searchQuery={search}
                groupFilter={studentGroupFilter}
                teacherFilter={studentTeacherFilter}
                paymentFilter={studentPaymentFilter}
                availableGroups={availableStudentGroups}
                availableTeachers={availableStudentTeachers}
                onGroupFilterChange={setStudentGroupFilter}
                onTeacherFilterChange={setStudentTeacherFilter}
                onPaymentFilterChange={setStudentPaymentFilter}
                theme={theme}
              />
            ) : null}

            {activeTab === "teachers" ? <TeachersPanelSection groups={uniqueGroups} teachers={teacherUsers} theme={theme} onAddTeacher={() => setShowTeacherModal(true)} /> : null}
            {activeTab === "groups" ? (
              <GroupsPanelSection
                groups={uniqueGroups}
                students={students}
                billing={billing}
                onAddGroup={openNewGroupModal}
                onEditGroup={openEditGroup}
                onDeleteGroup={handleDeleteGroup}
                theme={theme}
              />
            ) : null}
            {activeTab === "courses" ? (
              <CoursesPanelSection
                bootcamps={bootcamps}
                enrollments={enrollments}
                students={students}
                onAddBootcamp={openNewBootcampModal}
                onAddEnrollment={openNewEnrollmentModal}
                onEditBootcamp={openEditBootcamp}
                onDeleteBootcamp={handleDeleteBootcamp}
                onEditEnrollment={openEditEnrollment}
                onDeleteEnrollment={handleDeleteEnrollment}
                theme={theme}
              />
            ) : null}

            {activeTab === "payments" ? (
              <PaymentsPanelSection
                rows={paymentRows}
                requests={paymentRequests}
                onClosePayment={handleClosePayment}
                onReviewPayment={handleReviewPayment}
                theme={theme}
              />
            ) : null}

            {activeTab === "settings" ? (
              <SettingsPanelSection settingsState={settingsState} onToggle={(key) => setSettingsState((prev) => ({ ...prev, [key]: !prev[key] }))} theme={theme} />
            ) : null}
            </div>
          </div>
        </section>
      </div>

      <StudentModal
        open={showStudentModal}
        isEditing={isEditingStudent}
        theme={theme}
        form={studentForm}
        availableTeachers={availableStudentTeachers}
        filteredGroups={filteredStudentGroups}
        registrationFee={registrationFee}
        registrationPaidAmount={registrationPaidAmount}
        registrationDueAmount={registrationDueAmount}
        onClose={() => {
          setShowStudentModal(false);
          setEditingStudentId(null);
          setStudentForm(defaultStudentForm);
        }}
        onSubmit={handleCreateStudent}
        onChange={(updater) => setStudentForm(updater)}
      />

      <GroupModal
        open={showGroupModal}
        isEditing={isEditingGroup}
        theme={theme}
        form={groupForm}
        onClose={() => {
          setShowGroupModal(false);
          setEditingGroupId(null);
          setGroupForm(defaultGroupForm);
        }}
        onSubmit={handleCreateGroup}
        onChange={(updater) => setGroupForm(updater)}
      />

      <TeacherModal
        open={showTeacherModal}
        theme={theme}
        form={teacherForm}
        onClose={() => setShowTeacherModal(false)}
        onSubmit={handleCreateTeacher}
        onChange={(updater) => setTeacherForm(updater)}
      />

      <PaymentModal
        open={showPaymentModal}
        theme={theme}
        selectedStudent={selectedStudent}
        form={paymentForm}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentForm(defaultPaymentForm);
        }}
        onSubmit={handleCreatePayment}
        onChange={(updater) => setPaymentForm(updater)}
      />

      <BootcampModal
        open={showBootcampModal}
        isEditing={isEditingBootcamp}
        theme={theme}
        form={bootcampForm}
        onClose={() => {
          setShowBootcampModal(false);
          setEditingBootcampId(null);
          setBootcampForm(defaultBootcampForm);
        }}
        onSubmit={handleCreateBootcamp}
        onChange={(updater) => setBootcampForm(updater)}
      />

      <EnrollmentModal
        open={showEnrollmentModal}
        isEditing={isEditingEnrollment}
        theme={theme}
        form={enrollmentForm}
        students={students}
        bootcamps={bootcamps}
        enrollmentStudentName={enrollmentStudent?.fullName ?? ""}
        enrollmentBootcampName={enrollmentBootcamp?.name ?? ""}
        enrollmentBootcampPrice={enrollmentBootcamp?.price ?? 0}
        enrollmentRemaining={enrollmentRemaining}
        onClose={() => {
          setShowEnrollmentModal(false);
          setEditingEnrollmentId(null);
          setEnrollmentForm(defaultEnrollmentForm);
        }}
        onSubmit={handleCreateEnrollment}
        onChange={(updater) => setEnrollmentForm(updater)}
      />

      <TelegramModal
        open={Boolean(telegramModal)}
        theme={theme}
        data={telegramModal}
        onClose={() => setTelegramModal(null)}
        onSendCredentials={(studentId) => void handleSendTelegramCredentials(studentId)}
      />

      {toast ? (
        <div className={`fixed bottom-5 right-5 z-50 rounded-2xl border px-5 py-3 text-sm shadow-[0_18px_50px_rgba(0,0,0,0.45)] ${theme === "day" ? "border-slate-200 bg-white text-slate-900" : "border-blue-400/20 bg-[#10192f] text-white"}`}>
          {toast}
        </div>
      ) : null}
    </main>
  );
}
