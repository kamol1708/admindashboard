"use client";

import { useEffect, useState } from "react";
import { DashboardResponse, StudentStatus, AttendanceState } from "@/lib/types";

const currency = new Intl.NumberFormat("uz-UZ");

const initialStudentForm = {
  fullName: "",
  group: "",
  phone: "",
  parentPhone: "",
  balance: "0",
  notes: "",
};

const initialGradeForm = {
  subject: "",
  score: "0",
  maxScore: "100",
  examDate: "",
  note: "",
};

const initialAttendanceForm = {
  date: "",
  lesson: "",
  status: "present" as AttendanceState,
};

function statusLabel(status: StudentStatus) {
  switch (status) {
    case "active":
      return "Active";
    case "warning":
      return "Warning";
    case "probation":
      return "Probation";
    case "removed":
      return "Removed";
  }
}

export function DashboardClient() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [studentForm, setStudentForm] = useState(initialStudentForm);
  const [gradeForm, setGradeForm] = useState(initialGradeForm);
  const [attendanceForm, setAttendanceForm] = useState(initialAttendanceForm);
  const [busyAction, setBusyAction] = useState<string>("");

  async function refreshData() {
    setLoading(true);
    const response = await fetch("/api/students", { cache: "no-store" });
    const payload = (await response.json()) as DashboardResponse;
    setData(payload);
    setLoading(false);
    if (!selectedStudentId && payload.students[0]) {
      setSelectedStudentId(payload.students[0].id);
    }
  }

  useEffect(() => {
    void refreshData();
  }, []);

  const selectedStudent = data?.students.find((student) => student.id === selectedStudentId) ?? data?.students[0];
  const selectedInsight = data?.insights.find((item) => item.id === selectedStudent?.id);
  const topPerformer = [...(data?.insights ?? [])].sort((a, b) => b.averageScore - a.averageScore)[0];
  const mostCritical = [...(data?.insights ?? [])].sort((a, b) => a.attendanceRate - b.attendanceRate)[0];

  async function createStudentAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("student");

    await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...studentForm,
        balance: Number(studentForm.balance),
      }),
    });

    setStudentForm(initialStudentForm);
    setBusyAction("");
    await refreshData();
  }

  async function addGradeAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStudent) return;
    setBusyAction("grade");

    await fetch(`/api/students/${selectedStudent.id}/grades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...gradeForm,
        score: Number(gradeForm.score),
        maxScore: Number(gradeForm.maxScore),
      }),
    });

    setGradeForm(initialGradeForm);
    setBusyAction("");
    await refreshData();
  }

  async function addAttendanceAction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStudent) return;
    setBusyAction("attendance");

    await fetch(`/api/students/${selectedStudent.id}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attendanceForm),
    });

    setAttendanceForm(initialAttendanceForm);
    setBusyAction("");
    await refreshData();
  }

  async function updateStatus(status: StudentStatus) {
    if (!selectedStudent) return;
    setBusyAction(status);

    await fetch(`/api/students/${selectedStudent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        notes: selectedStudent.notes,
        balance: selectedStudent.balance,
      }),
    });

    setBusyAction("");
    await refreshData();
  }

  if (loading || !data) {
    return <main className="loading-screen">Yuklanmoqda...</main>;
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="eyebrow">EduHEMS</span>
            <span className="hero-badge">Smart campus control</span>
          </div>
          <h1>O‘quv markazingiz uchun boshqaruv markazi</h1>
          <p>
            Davomat, baholar, to‘lov balansi, risk monitoring va admin nazorat bitta dashboard ichida.
          </p>
          <div className="hero-highlights">
            <article>
              <span>Top performer</span>
              <strong>{topPerformer?.fullName}</strong>
              <small>{topPerformer?.averageScore}% natija</small>
            </article>
            <article>
              <span>Fast action</span>
              <strong>{mostCritical?.fullName}</strong>
              <small>{mostCritical?.attendanceRate}% attendance</small>
            </article>
          </div>
          <div className="hero-actions">
            <a href="#students" className="primary-link">
              Talabalarni boshqarish
            </a>
            <a href="#operations" className="ghost-link">
              Operatsion panel
            </a>
          </div>
        </div>

        <div className="topbar-card">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="topbar-row">
            <div>
              <p className="topbar-label">Shift Lead</p>
              <strong>Admin panel</strong>
            </div>
            <details className="profile-menu">
              <summary>
                <span className="avatar">AK</span>
              </summary>
              <div className="menu-dropdown">
                <a href="#operations">Admin panel</a>
                <a href="#alerts">Risk report</a>
                <a href="#students">Students CRM</a>
                <a href="#finance">To'lov nazorati</a>
              </div>
            </details>
          </div>
          <div className="admin-grid">
            <article>
              <span>Live groups</span>
              <strong>12</strong>
            </article>
            <article>
              <span>Mentor load</span>
              <strong>84%</strong>
            </article>
            <article>
              <span>SMS queue</span>
              <strong>09</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Jami talabalar" value={String(data.metrics.totalStudents)} tone="neutral" />
        <MetricCard label="Aktiv talabalar" value={String(data.metrics.activeStudents)} tone="success" />
        <MetricCard label="Riskdagi talabalar" value={String(data.metrics.warnings)} tone="warning" />
        <MetricCard label="Chetlatilganlar" value={String(data.metrics.removedStudents)} tone="danger" />
        <MetricCard label="O'rtacha baho" value={`${data.metrics.averageScore}%`} tone="neutral" />
        <MetricCard label="Davomat" value={`${data.metrics.attendanceRate}%`} tone="success" />
      </section>

      <section id="alerts" className="content-grid">
        <div className="panel alert-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Risk monitor</span>
              <h2>Kuzatuvga tushgan talabalar</h2>
            </div>
          </div>
          <div className="alert-list">
            {data.alerts.length ? (
              data.alerts.map((alert, index) => (
                <div key={`${alert}-${index}`} className="alert-item">
                  {alert}
                </div>
              ))
            ) : (
              <div className="alert-item success">Hozircha kritik holat yo'q.</div>
            )}
          </div>
        </div>

        <div id="finance" className="panel finance-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Finance view</span>
              <h2>To'lov va intizom</h2>
            </div>
          </div>
          <div className="finance-stats">
            {data.students.slice(0, 3).map((student) => (
              <div key={student.id} className="finance-row">
                <div>
                  <strong>{student.fullName}</strong>
                  <span>{student.group}</span>
                </div>
                <b className={student.balance < 0 ? "danger-text" : "success-text"}>
                  {student.balance < 0 ? "-" : "+"}
                  {currency.format(Math.abs(student.balance))} so'm
                </b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="students" className="workspace-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Student roster</span>
              <h2>Talabalar ro'yxati</h2>
            </div>
          </div>
          <div className="student-list">
            {data.insights.map((student) => (
              <button
                key={student.id}
                className={`student-row ${student.id === selectedStudent?.id ? "selected" : ""}`}
                onClick={() => setSelectedStudentId(student.id)}
                type="button"
              >
                <div>
                  <strong>{student.fullName}</strong>
                  <span>
                    {student.group} · {student.latestLesson}
                  </span>
                </div>
                <div className="student-pill-group">
                  <span className={`pill ${student.status}`}>{statusLabel(student.status)}</span>
                  <small>{student.averageScore}%</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel details-panel">
          {selectedStudent && selectedInsight ? (
            <>
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Student profile</span>
                  <h2>{selectedStudent.fullName}</h2>
                </div>
                <span className={`pill ${selectedStudent.status}`}>{statusLabel(selectedStudent.status)}</span>
              </div>

              <div className="details-grid">
                <InfoCard label="Guruh" value={selectedStudent.group} />
                <InfoCard label="Telefon" value={selectedStudent.phone} />
                <InfoCard label="Ota-ona" value={selectedStudent.parentPhone} />
                <InfoCard label="Qo'shilgan sana" value={selectedStudent.joinedAt.slice(0, 10)} />
                <InfoCard label="O'rtacha baho" value={`${selectedInsight.averageScore}%`} />
                <InfoCard label="Davomat" value={`${selectedInsight.attendanceRate}%`} />
              </div>

              <div className="spotlight-card">
                <div>
                  <span className="eyebrow">Progress spotlight</span>
                  <h3>Talaba holati bo‘yicha tezkor ko‘rinish</h3>
                </div>
                <div className="spotlight-meters">
                  <div>
                    <label>Baho darajasi</label>
                    <div className="meter-track">
                      <div className="meter-fill score" style={{ width: `${selectedInsight.averageScore}%` }} />
                    </div>
                    <strong>{selectedInsight.averageScore}%</strong>
                  </div>
                  <div>
                    <label>Davomat sifati</label>
                    <div className="meter-track">
                      <div
                        className="meter-fill attendance"
                        style={{ width: `${selectedInsight.attendanceRate}%` }}
                      />
                    </div>
                    <strong>{selectedInsight.attendanceRate}%</strong>
                  </div>
                </div>
              </div>

              <div className="notes-block">
                <h3>Mentor izohi</h3>
                <p>{selectedStudent.notes || "Izoh yo'q."}</p>
              </div>

              <div className="action-row">
                <button type="button" onClick={() => updateStatus("warning")} disabled={Boolean(busyAction)}>
                  Ogohlantirish
                </button>
                <button type="button" onClick={() => updateStatus("probation")} disabled={Boolean(busyAction)}>
                  Probation
                </button>
                <button type="button" onClick={() => updateStatus("removed")} disabled={Boolean(busyAction)}>
                  Chetlatish
                </button>
                <button type="button" onClick={() => updateStatus("active")} disabled={Boolean(busyAction)}>
                  Tiklash
                </button>
              </div>

              <div className="history-grid">
                <div>
                  <h3>So'nggi baholar</h3>
                  <div className="mini-list">
                    {selectedStudent.grades.map((grade) => (
                      <div key={grade.id} className="mini-row">
                        <div>
                          <strong>{grade.subject}</strong>
                          <span>{grade.examDate}</span>
                        </div>
                        <b>
                          {grade.score}/{grade.maxScore}
                        </b>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3>Davomat tarixi</h3>
                  <div className="mini-list">
                    {selectedStudent.attendance.map((attendance) => (
                      <div key={attendance.id} className="mini-row">
                        <div>
                          <strong>{attendance.lesson}</strong>
                          <span>{attendance.date}</span>
                        </div>
                        <b className={`attendance-${attendance.status}`}>{attendance.status}</b>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section id="operations" className="operations-grid">
        <form className="panel form-panel" onSubmit={createStudentAction}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Admissions</span>
              <h2>Talaba qo'shish</h2>
            </div>
          </div>
          <div className="form-grid">
            <input
              placeholder="F.I.Sh"
              value={studentForm.fullName}
              onChange={(event) => setStudentForm((prev) => ({ ...prev, fullName: event.target.value }))}
            />
            <input
              placeholder="Guruh"
              value={studentForm.group}
              onChange={(event) => setStudentForm((prev) => ({ ...prev, group: event.target.value }))}
            />
            <input
              placeholder="Telefon"
              value={studentForm.phone}
              onChange={(event) => setStudentForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
            <input
              placeholder="Ota-ona telefoni"
              value={studentForm.parentPhone}
              onChange={(event) => setStudentForm((prev) => ({ ...prev, parentPhone: event.target.value }))}
            />
            <input
              placeholder="Balans"
              value={studentForm.balance}
              onChange={(event) => setStudentForm((prev) => ({ ...prev, balance: event.target.value }))}
            />
            <textarea
              placeholder="Izoh"
              value={studentForm.notes}
              onChange={(event) => setStudentForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
          <button type="submit" disabled={busyAction === "student"}>
            {busyAction === "student" ? "Saqlanmoqda..." : "Talaba qo'shish"}
          </button>
        </form>

        <form className="panel form-panel" onSubmit={addGradeAction}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Assessment</span>
              <h2>Baho qo'yish</h2>
            </div>
          </div>
          <div className="form-grid">
            <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
              {data.students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </select>
            <input
              placeholder="Fan yoki test"
              value={gradeForm.subject}
              onChange={(event) => setGradeForm((prev) => ({ ...prev, subject: event.target.value }))}
            />
            <input
              placeholder="Ball"
              value={gradeForm.score}
              onChange={(event) => setGradeForm((prev) => ({ ...prev, score: event.target.value }))}
            />
            <input
              placeholder="Maksimal ball"
              value={gradeForm.maxScore}
              onChange={(event) => setGradeForm((prev) => ({ ...prev, maxScore: event.target.value }))}
            />
            <input
              type="date"
              value={gradeForm.examDate}
              onChange={(event) => setGradeForm((prev) => ({ ...prev, examDate: event.target.value }))}
            />
            <textarea
              placeholder="Izoh"
              value={gradeForm.note}
              onChange={(event) => setGradeForm((prev) => ({ ...prev, note: event.target.value }))}
            />
          </div>
          <button type="submit" disabled={busyAction === "grade"}>
            {busyAction === "grade" ? "Kiritilmoqda..." : "Bahoni saqlash"}
          </button>
        </form>

        <form className="panel form-panel" onSubmit={addAttendanceAction}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Attendance</span>
              <h2>Davomat belgilash</h2>
            </div>
          </div>
          <div className="form-grid">
            <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
              {data.students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fullName}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={attendanceForm.date}
              onChange={(event) => setAttendanceForm((prev) => ({ ...prev, date: event.target.value }))}
            />
            <input
              placeholder="Dars nomi"
              value={attendanceForm.lesson}
              onChange={(event) => setAttendanceForm((prev) => ({ ...prev, lesson: event.target.value }))}
            />
            <select
              value={attendanceForm.status}
              onChange={(event) =>
                setAttendanceForm((prev) => ({ ...prev, status: event.target.value as AttendanceState }))
              }
            >
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </select>
          </div>
          <button type="submit" disabled={busyAction === "attendance"}>
            {busyAction === "attendance" ? "Saqlanmoqda..." : "Davomatni saqlash"}
          </button>
        </form>
      </section>
    </main>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: "neutral" | "success" | "warning" | "danger" }) {
  return (
    <article className={`metric-card ${tone}`}>
      <i className="metric-glow" />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="info-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
