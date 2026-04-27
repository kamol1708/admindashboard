import { randomUUID } from "crypto";
import { getDb } from "@/lib/sqlite";
import { loadStore } from "@/lib/repositories/system-repository";
import type { AttendanceLessonDraft } from "@/components/admin/constants";

export async function listLessonsForGroup(groupName: string): Promise<AttendanceLessonDraft[]> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, title, date, topic
    FROM lesson_library
    WHERE group_name = ?
    ORDER BY date DESC, title DESC
  `).all(groupName) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    date: String(row.date),
    topic: String(row.topic ?? ""),
  }));
}

export async function createLessonForGroup(groupId: string, input: { date: string; title: string; topic: string }) {
  const store = await loadStore();
  const group = store.groups.find((item) => item.id === groupId);
  if (!group) return { error: "Guruh topilmadi.", status: 404 as const };

  const title = input.title.trim();
  const topic = input.topic.trim();
  const date = input.date;
  if (!title || !date) return { error: "Sana va dars nomi majburiy.", status: 400 as const };

  const db = getDb();
  const duplicate = db.prepare(`
    SELECT id FROM lesson_library
    WHERE group_name = ? AND date = ? AND lower(title) = lower(?)
  `).get(group.name, date, title) as { id?: string } | undefined;

  if (duplicate?.id) {
    return { error: "Bu dars allaqachon mavjud.", status: 409 as const };
  }

  const lesson: AttendanceLessonDraft = {
    id: randomUUID(),
    title,
    date,
    topic,
  };

  db.prepare(`
    INSERT INTO lesson_library (id, group_name, title, date, topic, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(lesson.id, group.name, lesson.title, lesson.date, lesson.topic, new Date().toISOString());

  return { lesson };
}
