import { randomUUID } from "crypto";
import type { GroupItem } from "@/lib/types";
import { loadStore } from "@/lib/repositories/system-repository";
import { getDb } from "@/lib/sqlite";

export interface CreateGroupInput {
  name: string;
  teacher: string;
  schedule: string;
  room: string;
  monthlyFee?: number;
}

export interface UpdateGroupInput {
  name?: string;
  teacher?: string;
  schedule?: string;
  room?: string;
  monthlyFee?: number;
}

function normalizeFee(value: number | undefined) {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
}

function validateGroupInput(input: CreateGroupInput | UpdateGroupInput) {
  if ("name" in input && input.name !== undefined && !input.name.trim()) return "Guruh nomi majburiy.";
  if ("teacher" in input && input.teacher !== undefined && !input.teacher.trim()) return "Teacher majburiy.";
  if ("schedule" in input && input.schedule !== undefined && !input.schedule.trim()) return "Jadval majburiy.";
  if ("room" in input && input.room !== undefined && !input.room.trim()) return "Xona majburiy.";
  if ("monthlyFee" in input && input.monthlyFee !== undefined && !Number.isFinite(Number(input.monthlyFee))) return "Oylik to'lov noto'g'ri.";
  return null;
}

export async function listGroups() {
  const store = await loadStore();
  return store.groups;
}

export async function createGroupRecord(input: CreateGroupInput, actorUserId?: string) {
  const validationError = validateGroupInput(input);
  if (validationError) return { error: validationError };

  const store = await loadStore();
  const exists = store.groups.some((group) => group.name.trim().toLowerCase() === input.name.trim().toLowerCase());
  if (exists) return { error: "Bu guruh allaqachon mavjud." };

  const group: GroupItem = {
    id: randomUUID(),
    name: input.name.trim(),
    teacher: input.teacher.trim(),
    schedule: input.schedule.trim(),
    room: input.room.trim(),
    monthlyFee: normalizeFee(input.monthlyFee),
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO groups_table (id, name, teacher, schedule, room, monthly_fee)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(group.id, group.name, group.teacher, group.schedule, group.room, group.monthlyFee);

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), "group", group.id, "create", actorUserId ?? null, new Date().toISOString(), `${group.name} guruhi yaratildi.`);

  return { group };
}

export async function updateGroupRecord(groupId: string, input: UpdateGroupInput, actorUserId?: string) {
  const validationError = validateGroupInput(input);
  if (validationError) return { error: validationError };

  const store = await loadStore();
  const group = store.groups.find((item) => item.id === groupId);
  if (!group) return { error: "Guruh topilmadi." };

  const nextName = input.name?.trim() ?? group.name;
  const duplicate = store.groups.some(
    (item) => item.id !== groupId && item.name.trim().toLowerCase() === nextName.toLowerCase(),
  );
  if (duplicate) return { error: "Bu guruh nomi allaqachon mavjud." };

  const updated: GroupItem = {
    ...group,
    name: nextName,
    teacher: input.teacher?.trim() ?? group.teacher,
    schedule: input.schedule?.trim() ?? group.schedule,
    room: input.room?.trim() ?? group.room,
    monthlyFee: input.monthlyFee !== undefined ? normalizeFee(input.monthlyFee) : group.monthlyFee,
  };

  const db = getDb();
  db.prepare(`
    UPDATE groups_table
    SET name = ?, teacher = ?, schedule = ?, room = ?, monthly_fee = ?
    WHERE id = ?
  `).run(updated.name, updated.teacher, updated.schedule, updated.room, updated.monthlyFee, groupId);

  db.prepare(`
    UPDATE students
    SET group_name = ?
    WHERE group_name = ?
  `).run(updated.name, group.name);

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), "group", groupId, "update", actorUserId ?? null, new Date().toISOString(), `${updated.name} guruhi yangilandi.`);

  return { group: updated };
}

export async function deleteGroupRecord(groupId: string, actorUserId?: string) {
  const store = await loadStore();
  const group = store.groups.find((item) => item.id === groupId);
  if (!group) return { error: "Guruh topilmadi." };

  const hasStudents = store.students.some((student) => student.group === group.name);
  if (hasStudents) return { error: "Bu guruhga studentlar biriktirilgan. Avval studentlarni boshqa guruhga o'tkazing." };

  const db = getDb();
  db.prepare(`DELETE FROM groups_table WHERE id = ?`).run(groupId);
  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), "group", groupId, "delete", actorUserId ?? null, new Date().toISOString(), `${group.name} guruhi o'chirildi.`);

  return { group };
}
