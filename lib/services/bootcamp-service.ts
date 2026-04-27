import { randomUUID } from "crypto";
import type { BootcampModel } from "@/lib/models/bootcamp";
import { loadStore } from "@/lib/repositories/system-repository";
import { getDb } from "@/lib/sqlite";

export interface CreateBootcampInput {
  name: string;
  price: number;
}

export interface UpdateBootcampInput {
  name?: string;
  price?: number;
}

function validateBootcampInput(input: CreateBootcampInput | UpdateBootcampInput) {
  if ("name" in input && input.name !== undefined && !input.name.trim()) return "Bootcamp nomi majburiy.";
  if ("price" in input && input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) return "Bootcamp narxi noto'g'ri.";
  return null;
}

export async function listBootcamps() {
  const store = await loadStore();
  return store.bootcamps;
}

export async function createBootcampRecord(input: CreateBootcampInput, actorUserId?: string) {
  const validationError = validateBootcampInput(input);
  if (validationError) return { error: validationError };

  const store = await loadStore();
  const exists = store.bootcamps.some((bootcamp) => bootcamp.name.trim().toLowerCase() === input.name.trim().toLowerCase());
  if (exists) return { error: "Bu bootcamp allaqachon mavjud." };

  const bootcamp: BootcampModel = {
    id: randomUUID(),
    name: input.name.trim(),
    price: Number(input.price),
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO bootcamps (id, name, price)
    VALUES (?, ?, ?)
  `).run(bootcamp.id, bootcamp.name, bootcamp.price);

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    "bootcamp",
    bootcamp.id,
    "create",
    actorUserId ?? "admin-001",
    new Date().toISOString(),
    `${bootcamp.name} bootcamp yaratildi.`,
  );

  return { bootcamp };
}

export async function updateBootcampRecord(bootcampId: string, input: UpdateBootcampInput, actorUserId?: string) {
  const validationError = validateBootcampInput(input);
  if (validationError) return { error: validationError };

  const store = await loadStore();
  const bootcamp = store.bootcamps.find((item) => item.id === bootcampId);
  if (!bootcamp) return { error: "Bootcamp topilmadi." };

  const nextName = input.name?.trim() ?? bootcamp.name;
  const duplicate = store.bootcamps.some(
    (item) => item.id !== bootcampId && item.name.trim().toLowerCase() === nextName.toLowerCase(),
  );
  if (duplicate) return { error: "Bu bootcamp nomi allaqachon mavjud." };

  const nextPrice = input.price !== undefined ? Number(input.price) : bootcamp.price;
  const db = getDb();
  db.prepare(`
    UPDATE bootcamps
    SET name = ?, price = ?
    WHERE id = ?
  `).run(nextName, nextPrice, bootcampId);

  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), "bootcamp", bootcampId, "update", actorUserId ?? "admin-001", new Date().toISOString(), `${nextName} bootcamp yangilandi.`);

  return { bootcamp: { id: bootcampId, name: nextName, price: nextPrice } };
}

export async function deleteBootcampRecord(bootcampId: string, actorUserId?: string) {
  const store = await loadStore();
  const bootcamp = store.bootcamps.find((item) => item.id === bootcampId);
  if (!bootcamp) return { error: "Bootcamp topilmadi." };

  const hasEnrollments = store.enrollments.some((item) => item.bootcampId === bootcampId);
  if (hasEnrollments) return { error: "Bu bootcampga enrollmentlar biriktirilgan. Avval enrollmentlarni o'chiring." };

  const db = getDb();
  db.prepare(`DELETE FROM bootcamps WHERE id = ?`).run(bootcampId);
  db.prepare(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, created_at, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), "bootcamp", bootcampId, "delete", actorUserId ?? "admin-001", new Date().toISOString(), `${bootcamp.name} bootcamp o'chirildi.`);

  return { bootcamp };
}
