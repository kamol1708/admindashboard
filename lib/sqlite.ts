import { mkdirSync } from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

declare global {
  // eslint-disable-next-line no-var
  var __attendanceDb__: DatabaseSync | undefined;
}

const dbPath = path.join(process.cwd(), "data", "attendance.db");

function ensureColumn(db: DatabaseSync, tableName: string, columnName: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: string }>;
  if (columns.some((column) => column.name === columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
}

function ensureAttendanceLessonUniqueness(db: DatabaseSync) {
  const schemaRow = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'attendance_records'")
    .get() as { sql?: string } | undefined;

  const schema = schemaRow?.sql ?? "";
  if (!schema.includes("UNIQUE(student_id, date)") || schema.includes("UNIQUE(student_id, date, lesson_title)")) {
    return;
  }

  db.exec("PRAGMA foreign_keys = OFF;");
  db.exec("BEGIN;");

  try {
    db.exec(`
      ALTER TABLE attendance_records RENAME TO attendance_records_old;

      CREATE TABLE attendance_records (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        date TEXT NOT NULL,
        lesson_title TEXT NOT NULL,
        topic TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT NOT NULL,
        late_minutes INTEGER NOT NULL DEFAULT 0,
        early_leave INTEGER NOT NULL DEFAULT 0,
        participation_score INTEGER NOT NULL,
        homework_status TEXT NOT NULL,
        daily_grade REAL NOT NULL,
        comment TEXT NOT NULL DEFAULT '',
        recorded_at TEXT NOT NULL,
        recorded_by_user_id TEXT NOT NULL,
        UNIQUE(student_id, date, lesson_title),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      );

      INSERT INTO attendance_records (
        id, student_id, date, lesson_title, topic, status, reason, late_minutes,
        early_leave, participation_score, homework_status, daily_grade, comment,
        recorded_at, recorded_by_user_id
      )
      SELECT
        id, student_id, date, lesson_title, topic, status, reason, late_minutes,
        early_leave, participation_score, homework_status, daily_grade, comment,
        recorded_at, recorded_by_user_id
      FROM attendance_records_old;

      DROP TABLE attendance_records_old;

      CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance_records(student_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
    `);

    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON;");
  }
}

function init(db: DatabaseSync) {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      linked_student_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      group_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      parent_phone TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      status TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      telegram_chat_id TEXT,
      telegram_username TEXT,
      telegram_connected_at TEXT,
      telegram_link_token TEXT,
      telegram_link_expires_at TEXT,
      telegram_link_sent_at TEXT,
      telegram_credentials_sent_at TEXT
    );

    CREATE TABLE IF NOT EXISTS groups_table (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      teacher TEXT NOT NULL,
      schedule TEXT NOT NULL,
      room TEXT NOT NULL,
      monthly_fee REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bootcamps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      bootcamp_id TEXT NOT NULL,
      payment_amount REAL NOT NULL,
      payment_status TEXT NOT NULL,
      start_date TEXT NOT NULL,
      UNIQUE(student_id, bootcamp_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (bootcamp_id) REFERENCES bootcamps(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS grades (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      score REAL NOT NULL,
      max_score REAL NOT NULL,
      exam_date TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_at TEXT NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved',
      month TEXT,
      requested_at TEXT,
      confirmed_at TEXT,
      transaction_id TEXT,
      proof_note TEXT,
      reviewed_by_user_id TEXT,
      note TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      date TEXT NOT NULL,
      lesson_title TEXT NOT NULL,
      topic TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      late_minutes INTEGER NOT NULL DEFAULT 0,
      early_leave INTEGER NOT NULL DEFAULT 0,
      participation_score INTEGER NOT NULL,
      homework_status TEXT NOT NULL,
      daily_grade REAL NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      recorded_at TEXT NOT NULL,
      recorded_by_user_id TEXT NOT NULL,
      UNIQUE(student_id, date, lesson_title),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lesson_library (
      id TEXT PRIMARY KEY,
      group_name TEXT NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      topic TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      UNIQUE(group_name, date, title)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_user_id TEXT,
      created_at TEXT NOT NULL,
      summary TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      attendance_threshold_percent INTEGER NOT NULL,
      consecutive_absence_threshold INTEGER NOT NULL,
      restrict_past_attendance_edits INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id);
    CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
    CREATE INDEX IF NOT EXISTS idx_lesson_library_group_name ON lesson_library(group_name);
    CREATE INDEX IF NOT EXISTS idx_lesson_library_date ON lesson_library(date);
    CREATE INDEX IF NOT EXISTS idx_notifications_student_id ON notifications(student_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_bootcamp_id ON enrollments(bootcamp_id);
  `);

  ensureColumn(db, "students", "telegram_chat_id", "TEXT");
  ensureColumn(db, "students", "telegram_username", "TEXT");
  ensureColumn(db, "students", "telegram_connected_at", "TEXT");
  ensureColumn(db, "students", "telegram_link_token", "TEXT");
  ensureColumn(db, "students", "telegram_link_expires_at", "TEXT");
  ensureColumn(db, "students", "telegram_link_sent_at", "TEXT");
  ensureColumn(db, "students", "telegram_credentials_sent_at", "TEXT");
  ensureColumn(db, "payments", "status", "TEXT NOT NULL DEFAULT 'approved'");
  ensureColumn(db, "payments", "month", "TEXT");
  ensureColumn(db, "payments", "requested_at", "TEXT");
  ensureColumn(db, "payments", "confirmed_at", "TEXT");
  ensureColumn(db, "payments", "transaction_id", "TEXT");
  ensureColumn(db, "payments", "proof_note", "TEXT");
  ensureColumn(db, "payments", "reviewed_by_user_id", "TEXT");
  ensureAttendanceLessonUniqueness(db);
}

export function getDb() {
  if (!global.__attendanceDb__) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    global.__attendanceDb__ = new DatabaseSync(dbPath);
  }

  init(global.__attendanceDb__);
  return global.__attendanceDb__;
}
