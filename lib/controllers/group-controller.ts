import { NextResponse } from "next/server";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { requireRole } from "@/lib/services/auth-service";
import { createGroupRecord, deleteGroupRecord, listGroups, updateGroupRecord } from "@/lib/services/group-service";

export async function listGroupsController() {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin", "teacher"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const groups = await listGroups();
  return NextResponse.json(groups);
}

export async function createGroupController(request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const payload = await request.json();
  const result = await createGroupRecord(payload, session?.id);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", 400);
  return NextResponse.json(result.group, { status: 201 });
}

export async function updateGroupController(groupId: string, request: Request) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const payload = await request.json();
  const result = await updateGroupRecord(groupId, payload, session?.id);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", result.error === "Guruh topilmadi." ? 404 : 400);
  return NextResponse.json(result.group);
}

export async function deleteGroupController(groupId: string) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const result = await deleteGroupRecord(groupId, session?.id);
  if ("error" in result) return jsonError(result.error ?? "Xatolik yuz berdi.", result.error === "Guruh topilmadi." ? 404 : 400);
  return NextResponse.json({ ok: true, group: result.group });
}
