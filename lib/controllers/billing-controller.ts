import { NextResponse } from "next/server";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { requireRole } from "@/lib/services/auth-service";
import { getDashboardData } from "@/lib/store";

export async function listBillingController() {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const dashboard = await getDashboardData();
  if (session?.role === "teacher") {
    const allowedGroups = new Set(dashboard.groups.map((group) => group.name));
    return NextResponse.json(dashboard.billing.filter((item) => allowedGroups.has(item.group)));
  }

  return NextResponse.json(dashboard.billing);
}
