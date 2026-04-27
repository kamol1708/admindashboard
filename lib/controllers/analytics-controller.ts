import { NextResponse } from "next/server";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { requireRole } from "@/lib/services/auth-service";
import { getAnalyticsSnapshot } from "@/lib/services/analytics-service";
import { loadStore } from "@/lib/repositories/system-repository";

export async function analyticsController() {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  const analytics = await getAnalyticsSnapshot();
  return NextResponse.json(analytics);
}

export async function notificationsController() {
  const session = await getCurrentSession();
  if (!session) return jsonError("Autentifikatsiya talab qilinadi.", 401);
  const store = await loadStore();
  const notifications =
    session.role === "student" && session.linkedStudentId
      ? store.notifications.filter((notification) => notification.studentId === session.linkedStudentId)
      : store.notifications;
  return NextResponse.json(notifications);
}

export async function logsController() {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);
  const store = await loadStore();
  return NextResponse.json(store.auditLogs);
}
