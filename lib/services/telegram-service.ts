import { randomBytes } from "crypto";
import { getDb } from "@/lib/sqlite";
import { loadStore } from "@/lib/repositories/system-repository";
import { hashPassword } from "@/lib/services/password-service";

declare global {
  // eslint-disable-next-line no-var
  var __telegramPollingStarted__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __telegramUpdateOffset__: number | undefined;
}

const TELEGRAM_API_BASE = "https://api.telegram.org";
const TELEGRAM_MENU = [
  ["📚 Kurslarim", "🗓 Jadvalim"],
  ["💳 To'lovlarim", "📊 Baholarim"],
  ["📝 Vazifalarim"],
] as const;

type TelegramChat = {
  id: number;
  username?: string;
};

type TelegramUpdate = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: TelegramChat;
    from?: TelegramChat & { first_name?: string };
  };
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getTelegramConfig() {
  const token = env("TELEGRAM_BOT_TOKEN");
  const webhookUrl = env("TELEGRAM_WEBHOOK_URL");
  const webhookSecret = env("TELEGRAM_WEBHOOK_SECRET");
  const botUsername = env("TELEGRAM_BOT_USERNAME").replace(/^@/, "");
  const expireMinutes = Number(process.env.TELEGRAM_LINK_EXPIRE_MINUTES || 60);

  return {
    enabled: Boolean(token),
    token,
    webhookUrl,
    webhookSecret,
    botUsername,
    expireMinutes: Number.isFinite(expireMinutes) && expireMinutes > 0 ? expireMinutes : 60,
  };
}

async function telegramRequest<T>(method: string, body: Record<string, unknown>) {
  const config = getTelegramConfig();
  if (!config.token) throw new Error("Telegram bot token sozlanmagan.");

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${config.token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram API xatosi: ${method}`);
  }

  return payload.result as T;
}

async function resolveBotUsername() {
  const config = getTelegramConfig();
  if (config.botUsername) return config.botUsername;

  const result = await telegramRequest<{ username?: string }>("getMe", {});
  if (!result.username) throw new Error("Telegram bot username aniqlanmadi.");
  return result.username;
}

async function fetchTelegramUpdates() {
  const offset = global.__telegramUpdateOffset__ ?? 0;
  return telegramRequest<TelegramUpdate[]>("getUpdates", {
    offset,
    timeout: 20,
    allowed_updates: ["message"],
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildReplyKeyboard() {
  return {
    keyboard: TELEGRAM_MENU.map((row) => row.map((label) => ({ text: label }))),
    resize_keyboard: true,
    is_persistent: true,
  };
}

export async function sendTelegramMessage(chatId: string, text: string) {
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: buildReplyKeyboard(),
  });
}

function formatDateTime(value?: string) {
  if (!value) return "mavjud emas";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("uz-UZ");
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("uz-UZ");
}

function formatScore(score: number) {
  return `${Math.max(0, Math.round(score))}%`;
}

function splitLessonTitle(lessonTitle: string) {
  const parts = lessonTitle.split("·").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      lessonName: parts[0],
      paraLabel: parts.slice(1).join(" · "),
    };
  }

  return {
    lessonName: lessonTitle.trim(),
    paraLabel: "",
  };
}

function buildGradeStars(score: number) {
  const filled = Math.max(1, Math.min(5, Math.round(score / 20)));
  return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`;
}

function buildAttendanceFeedback(attendanceLabel: string) {
  if (attendanceLabel === "Keldi") return "Barakalla, bugungi darsda qatnashdingiz va bu juda muhim.";
  if (attendanceLabel === "Kechikdi") return "Keyingi safar darsga biroz ertaroq kelishga harakat qiling.";
  return "Dars qoldirilgan. Keyingi mashg'ulotlarda qatnashish juda muhim.";
}

function buildGradeFeedback(score: number) {
  if (score >= 90) return "Juda kuchli natija. Shu tempni ushlasangiz, yanada porlaysiz!";
  if (score >= 75) return "Yaxshi natija. Bir oz ko'proq e'tibor bilan yanada yuqoriga chiqasiz.";
  if (score >= 60) return "Natija yomon emas. Muhim joylarni takrorlasangiz, tez o'sasiz.";
  return "Ko'proq mashq va takror bilan natijani ancha yaxshilash mumkin.";
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("uz-UZ").format(value)} so'm`;
}

function formatPaymentMethod(method: "cash" | "card" | "transfer") {
  if (method === "cash") return "Naqd";
  if (method === "card") return "Karta";
  return "O'tkazma";
}

function getAppLoginUrl() {
  const explicitUrl = env("APP_LOGIN_URL");
  if (explicitUrl) return explicitUrl;

  const appUrl = env("APP_URL") || env("NEXT_PUBLIC_APP_URL");
  if (appUrl) {
    return `${appUrl.replace(/\/$/, "")}/login`;
  }

  return "http://localhost:3000/login";
}

function normalizeMenuText(text: string) {
  return text.replace(/[^\p{L}\p{N}' ]/gu, "").trim().toLowerCase();
}

function buildStudentCourseMessage(studentId: string, store: Awaited<ReturnType<typeof loadStore>>) {
  const student = store.students.find((item) => item.id === studentId);
  if (!student) return "Student topilmadi.";

  const group = store.groups.find((item) => item.name === student.group);
  const enrollments = store.enrollments.filter((item) => item.studentId === student.id);
  const courseLines = enrollments.map((enrollment) => {
    const bootcamp = store.bootcamps.find((item) => item.id === enrollment.bootcampId);
    return `• ${bootcamp?.name ?? enrollment.bootcampId} (${enrollment.paymentStatus})`;
  });

  return [
    "📚 <b>Kurslarim</b>",
    "",
    `👥 Guruh: <b>${escapeHtml(student.group)}</b>`,
    `🧑‍🏫 Mentor: <b>${escapeHtml(group?.teacher ?? "Belgilanmagan")}</b>`,
    courseLines.length ? `🎯 Kurslar:\n${courseLines.join("\n")}` : "📭 Kurslar hozircha biriktirilmagan.",
    "",
    "✨ O'qishingizga omad!",
  ].join("\n");
}

function buildStudentScheduleMessage(studentId: string, store: Awaited<ReturnType<typeof loadStore>>) {
  const student = store.students.find((item) => item.id === studentId);
  if (!student) return "Student topilmadi.";
  const group = store.groups.find((item) => item.name === student.group);

  return [
    "🗓 <b>Jadvalim</b>",
    "",
    `👥 Guruh: <b>${escapeHtml(student.group)}</b>`,
    `⏰ Jadval: <b>${escapeHtml(group?.schedule ?? "Belgilanmagan")}</b>`,
    `🏫 Xona: <b>${escapeHtml(group?.room ?? "Belgilanmagan")}</b>`,
    "",
    "🟢 Darslarga vaqtida kelishni unutmang.",
  ].join("\n");
}

function buildStudentGradesMessage(studentId: string, store: Awaited<ReturnType<typeof loadStore>>) {
  const student = store.students.find((item) => item.id === studentId);
  if (!student) return "Student topilmadi.";

  const grades = [...student.grades]
    .sort((a, b) => b.examDate.localeCompare(a.examDate))
    .slice(0, 5);

  if (!grades.length) return "📊 <b>Baholarim</b>\n\n🕘 Hali baho qo'yilmagan.";

  return `📊 <b>Baholarim</b>\n\n${grades
    .map((grade) => `• ${escapeHtml(grade.subject)}: <b>${grade.score}/${grade.maxScore}</b> (${formatShortDate(grade.examDate)})`)
    .join("\n")}\n\n🏆 Harakatda davom eting!`;
}

function buildStudentPaymentsMessage(studentId: string, store: Awaited<ReturnType<typeof loadStore>>) {
  const student = store.students.find((item) => item.id === studentId);
  if (!student) return "Student topilmadi.";

  const payments = [...student.payments]
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .slice(0, 5);

  const paymentLines = payments.length
    ? payments
        .map((payment) => {
          const statusLabel =
            payment.status === "pending" ? "tasdiqlanmoqda" : payment.status === "rejected" ? "rad etilgan" : "qabul qilingan";
          return `• ${formatMoney(payment.amount)} - ${payment.paidAt} (${formatPaymentMethod(payment.method)}, ${statusLabel})`;
        })
        .join("\n")
    : "📭 To'lov tarixi hozircha yo'q.";

  return ["💳 <b>To'lovlarim</b>", "", paymentLines, `💰 Joriy balans: <b>${formatMoney(student.balance)}</b>`, "", "📌 To'lovlarni vaqtida qilishingizni so'raymiz."].join("\n");
}

function buildStudentHomeworkMessage(studentId: string, store: Awaited<ReturnType<typeof loadStore>>) {
  const records = store.attendanceRecords
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  if (!records.length) return "📝 <b>Vazifalarim</b>\n\n📭 Hali dars yozuvlari mavjud emas.";

  return `📝 <b>Vazifalarim</b>\n\n${records
    .map((record) => `• ${formatShortDate(record.date)} - ${escapeHtml(record.lessonTitle)}: ${record.homeworkStatus === "done" ? "✅ Bajarilgan" : "⏳ Bajarilmagan"}`)
    .join("\n")}\n\n🚀 Vazifalarni vaqtida topshirishga harakat qiling.`;
}

async function replyForStudent(chatId: string, studentId: string, text: string) {
  const store = await loadStore();
  const normalizedText = normalizeMenuText(text);

  if (normalizedText === "kurslarim" || normalizedText === "mening kursim") {
    await sendTelegramMessage(chatId, buildStudentCourseMessage(studentId, store));
    return;
  }

  if (normalizedText === "jadvalim") {
    await sendTelegramMessage(chatId, buildStudentScheduleMessage(studentId, store));
    return;
  }

  if (normalizedText === "baholarim") {
    await sendTelegramMessage(chatId, buildStudentGradesMessage(studentId, store));
    return;
  }

  if (normalizedText === "tolovlarim" || normalizedText === "to'lovlarim") {
    await sendTelegramMessage(chatId, buildStudentPaymentsMessage(studentId, store));
    return;
  }

  if (normalizedText === "vazifalarim") {
    await sendTelegramMessage(chatId, buildStudentHomeworkMessage(studentId, store));
    return;
  }

  await sendTelegramMessage(
    chatId,
    "👇 <b>Quyidagi menyudan kerakli bo'limni tanlang:</b>\n\n📚 Kurslarim\n🗓 Jadvalim\n💳 To'lovlarim\n📊 Baholarim\n📝 Vazifalarim",
  );
}

async function pollTelegramLoop() {
  const config = getTelegramConfig();
  if (!config.enabled || config.webhookUrl) {
    global.__telegramPollingStarted__ = false;
    return;
  }

  try {
    const updates = await fetchTelegramUpdates();
    for (const update of updates) {
      if (typeof update.update_id === "number") {
        global.__telegramUpdateOffset__ = update.update_id + 1;
      }
      await handleTelegramWebhook(update);
    }
  } catch {
    // Polling should keep retrying quietly in the background.
  } finally {
    setTimeout(() => {
      void pollTelegramLoop();
    }, 1000);
  }
}

export async function ensureTelegramBotRuntime() {
  const config = getTelegramConfig();
  if (!config.enabled || config.webhookUrl || global.__telegramPollingStarted__) return;

  global.__telegramPollingStarted__ = true;

  try {
    await telegramRequest("deleteWebhook", { drop_pending_updates: false });
  } catch {
    // If webhook is already absent, polling can still continue.
  }

  void pollTelegramLoop();
}

export async function createTelegramInvite(studentId: string) {
  const config = getTelegramConfig();
  if (!config.enabled) {
    return { error: "Telegram bot token sozlanmagan." as const };
  }
  await ensureTelegramBotRuntime();

  const botUsername = await resolveBotUsername();
  const token = randomBytes(24).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.expireMinutes * 60 * 1000).toISOString();
  const sentAt = now.toISOString();

  const db = getDb();
  const row = db.prepare(`
    SELECT id, full_name, telegram_connected_at, telegram_username, telegram_chat_id, telegram_credentials_sent_at
    FROM students
    WHERE id = ?
    LIMIT 1
  `).get(studentId) as
    | {
        id: string;
        full_name: string;
        telegram_connected_at?: string | null;
        telegram_username?: string | null;
        telegram_chat_id?: string | null;
        telegram_credentials_sent_at?: string | null;
      }
    | undefined;

  if (!row) return { error: "Talaba topilmadi." as const };

  db.prepare(`
    UPDATE students
    SET telegram_link_token = ?, telegram_link_expires_at = ?, telegram_link_sent_at = ?
    WHERE id = ?
  `).run(token, expiresAt, sentAt, studentId);

  return {
    studentId,
    studentName: row.full_name,
    botUsername,
    startLink: `https://t.me/${botUsername}?start=${token}`,
    expiresAt,
    inviteToken: token,
    connectedAt: row.telegram_connected_at ?? undefined,
    username: row.telegram_username ?? undefined,
    chatId: row.telegram_chat_id ?? undefined,
    credentialsSentAt: row.telegram_credentials_sent_at ?? undefined,
  };
}

export async function connectTelegramStudent(token: string, chat: TelegramChat) {
  const now = new Date().toISOString();
  const db = getDb();
  const student = db.prepare(`
    SELECT id, full_name, telegram_link_expires_at
    FROM students
    WHERE telegram_link_token = ?
    LIMIT 1
  `).get(token) as { id: string; full_name: string; telegram_link_expires_at?: string | null } | undefined;

  if (!student) {
    return { error: "Bu start link topilmadi yoki yaroqsiz." as const };
  }

  if (!student.telegram_link_expires_at || student.telegram_link_expires_at < now) {
    return { error: "Bu start link muddati tugagan." as const };
  }

  db.prepare(`
    UPDATE students
    SET
      telegram_chat_id = ?,
      telegram_username = ?,
      telegram_connected_at = ?,
      telegram_link_token = NULL
    WHERE id = ?
  `).run(String(chat.id), chat.username ?? null, now, student.id);

  return { studentId: student.id, studentName: student.full_name };
}

async function findStudentIdByChat(chatId: string) {
  const db = getDb();
  const row = db.prepare(`
    SELECT id
    FROM students
    WHERE telegram_chat_id = ?
    LIMIT 1
  `).get(chatId) as { id: string } | undefined;

  return row?.id ?? null;
}

function generateTemporaryPassword() {
  return randomBytes(6).toString("base64url");
}

export async function sendTelegramCredentials(studentId: string) {
  await ensureTelegramBotRuntime();
  const db = getDb();
  const row = db.prepare(`
    SELECT s.full_name, s.telegram_chat_id, u.id as user_id, u.email
    FROM students s
    LEFT JOIN users u ON u.linked_student_id = s.id AND u.role = 'student'
    WHERE s.id = ?
    LIMIT 1
  `).get(studentId) as
    | { full_name: string; telegram_chat_id?: string | null; user_id?: string | null; email?: string | null }
    | undefined;

  if (!row) return { error: "Talaba topilmadi." as const };
  if (!row.telegram_chat_id) return { error: "Student hali Telegram botga ulanmagan." as const };
  if (!row.user_id || !row.email) return { error: "Student logini topilmadi." as const };

  const nextPassword = generateTemporaryPassword();
  const sentAt = new Date().toISOString();

  db.prepare(`
    UPDATE users
    SET password = ?, updated_at = ?
    WHERE id = ?
  `).run(hashPassword(nextPassword), sentAt, row.user_id);

  db.prepare(`
    UPDATE students
    SET telegram_credentials_sent_at = ?
    WHERE id = ?
  `).run(sentAt, studentId);

  await sendTelegramMessage(
    row.telegram_chat_id,
    [
      `🌟 Assalomu alaykum, <b>${escapeHtml(row.full_name)}</b>!`,
      "",
      "🎓 Course Center ga xush kelibsiz.",
      "Siz uchun yangi student akkaunti tayyorlandi.",
      "",
      "🔐 <b>Kirish ma'lumotlari</b>",
      `• Login: <code>${escapeHtml(row.email)}</code>`,
      `• Parol: <code>${escapeHtml(nextPassword)}</code>`,
      "",
      "🌐 <b>Shaxsiy kabinet manzili</b>",
      escapeHtml(getAppLoginUrl()),
      "",
      "⚠️ Xavfsizlik uchun tizimga kirgach parolni darhol yangilashingizni tavsiya qilamiz.",
      "",
      "💬 Savol tug'ilsa, admin bilan bemalol bog'lanishingiz mumkin.",
      "",
      "✨ O'qishingizga omad tilaymiz!",
    ].join("\n"),
  );

  return { sentAt };
}

export async function sendTelegramLessonNotification(input: {
  studentId: string;
  lessonTitle: string;
  date: string;
  dailyGrade?: number;
  attendanceLabel: string;
  topic?: string;
  comment?: string;
  homeworkStatus?: "done" | "not_done";
}) {
  const db = getDb();
  const row = db.prepare(`
    SELECT full_name, group_name, telegram_chat_id
    FROM students
    WHERE id = ?
    LIMIT 1
  `).get(input.studentId) as { full_name: string; group_name: string; telegram_chat_id?: string | null } | undefined;

  if (!row?.telegram_chat_id) return;

  const { lessonName, paraLabel } = splitLessonTitle(input.lessonTitle);
  const attendanceComment = input.comment?.trim() || "Davomat bo'yicha qo'shimcha izoh qoldirilmagan.";
  const gradeComment = input.comment?.trim() || "Baho bo'yicha qo'shimcha izoh qoldirilmagan.";
  const attendanceMessage = [
    "📍 <b>Sizning davomatingiz yangilandi!</b>",
    "",
    `📚 <b>Guruh:</b> ${escapeHtml(row.group_name)}`,
    `📘 <b>Dars:</b> ${escapeHtml(input.topic?.trim() || lessonName)}`,
    paraLabel ? `🕘 <b>Para:</b> ${escapeHtml(paraLabel)}` : "",
    `📅 <b>Sana:</b> ${escapeHtml(formatShortDate(input.date))}`,
    `✅ <b>Holat:</b> ${escapeHtml(input.attendanceLabel)}`,
    `📝 <b>Izoh:</b> ${escapeHtml(attendanceComment)}`,
    "",
    escapeHtml(buildAttendanceFeedback(input.attendanceLabel)),
  ]
    .filter(Boolean)
    .join("\n");

  const lessonMessage = [
    "🆕 <b>Yangi dars yozuvi saqlandi!</b>",
    "",
    `📚 <b>Guruh:</b> ${escapeHtml(row.group_name)}`,
    `📘 <b>Dars:</b> ${escapeHtml(input.topic?.trim() || lessonName)}`,
    paraLabel ? `🕘 <b>Para:</b> ${escapeHtml(paraLabel)}` : "",
    `📅 <b>Sana:</b> ${escapeHtml(formatShortDate(input.date))}`,
    `📝 <b>Vazifa:</b> ${input.homeworkStatus === "done" ? "✅ Bajarilgan deb belgilangan" : "⏳ Vazifa biriktirildi"}`,
  ].join("\n");

  await sendTelegramMessage(row.telegram_chat_id, attendanceMessage);

  if (typeof input.dailyGrade === "number") {
    const gradeMessage = [
      "🏆 ⭐ <b>Sizning bahoyingiz yangilandi!</b>",
      "",
      `📚 <b>Guruh:</b> ${escapeHtml(row.group_name)}`,
      `📘 <b>Dars:</b> ${escapeHtml(input.topic?.trim() || lessonName)}`,
      `📅 <b>Sana:</b> ${escapeHtml(formatShortDate(input.date))}`,
      "",
      "────────────────",
      `⭐ <b>Sizning bahoyingiz:</b> ${escapeHtml(formatScore(input.dailyGrade))}`,
      `⭐ <b>Natija:</b> ${escapeHtml(buildGradeStars(input.dailyGrade))}`,
      `⭐ <b>Fikr:</b> ${escapeHtml(buildGradeFeedback(input.dailyGrade))}`,
      `📝 <b>Izoh:</b> ${escapeHtml(gradeComment)}`,
      "",
      "⭐ Oldinga qarab shunday davom eting!",
    ].join("\n");
    await sendTelegramMessage(row.telegram_chat_id, lessonMessage);
    await sendTelegramMessage(row.telegram_chat_id, gradeMessage);
    return;
  }

  await sendTelegramMessage(row.telegram_chat_id, lessonMessage);
}

export async function sendTelegramPaymentNotification(input: {
  studentId: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  paidAt: string;
  month?: string;
  method: "cash" | "card" | "transfer";
  transactionId?: string;
  note?: string;
}) {
  const db = getDb();
  const row = db.prepare(`
    SELECT full_name, group_name, telegram_chat_id
    FROM students
    WHERE id = ?
    LIMIT 1
  `).get(input.studentId) as { full_name: string; group_name: string; telegram_chat_id?: string | null } | undefined;

  if (!row?.telegram_chat_id) return;

  const title =
    input.status === "pending"
      ? "💳 <b>To'lov so'rovingiz qabul qilindi!</b>"
      : input.status === "approved"
        ? "✅ <b>To'lovingiz tasdiqlandi!</b>"
        : "⚠️ <b>To'lovingiz rad etildi!</b>";

  const statusText =
    input.status === "pending" ? "Tasdiqlash kutilmoqda" : input.status === "approved" ? "Tasdiqlandi" : "Rad etildi";

  await sendTelegramMessage(
    row.telegram_chat_id,
    [
      title,
      "",
      `📚 <b>Guruh:</b> ${escapeHtml(row.group_name)}`,
      `🗓 <b>Oy:</b> ${escapeHtml(input.month || input.paidAt.slice(0, 7))}`,
      `💵 <b>Summa:</b> ${escapeHtml(formatMoney(input.amount))}`,
      `💳 <b>Usul:</b> ${escapeHtml(formatPaymentMethod(input.method))}`,
      `📅 <b>Sana:</b> ${escapeHtml(formatShortDate(input.paidAt))}`,
      `📌 <b>Holat:</b> ${escapeHtml(statusText)}`,
      input.transactionId ? `🧾 <b>Tranzaksiya ID:</b> ${escapeHtml(input.transactionId)}` : "",
      `📝 <b>Izoh:</b> ${escapeHtml(input.note?.trim() || "Qo'shimcha izoh yo'q.")}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export async function handleTelegramWebhook(update: TelegramUpdate) {
  const message = update.message;
  const text = message?.text?.trim();
  const chat = message?.chat;
  if (!text || !chat?.id) return;

  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1]?.trim();
    if (!token) {
      await sendTelegramMessage(String(chat.id), "Start link topilmadi. Admin yuborgan havoladan qayta kiring.");
      return;
    }

    const result = await connectTelegramStudent(token, chat);
    if ("error" in result) {
      await sendTelegramMessage(String(chat.id), result.error ?? "Start link yaroqsiz.");
      return;
    }

    await sendTelegramMessage(
      String(chat.id),
      [
        `🎉 Tabriklaymiz, <b>${escapeHtml(result.studentName)}</b>!`,
        "",
        "🤖 Telegram bot student akkauntingizga muvaffaqiyatli ulandi.",
        "🔐 Endi admin sizga login va vaqtinchalik parol yuborishi mumkin.",
        "",
        "📬 Keyingi xabarlarni shu yerda olasiz.",
      ].join("\n"),
    );
    await sendTelegramMessage(
      String(chat.id),
      "👇 <b>Quyidagi menyudan kerakli bo'limni tanlang:</b>\n\n📚 Kurslarim\n🗓 Jadvalim\n💳 To'lovlarim\n📊 Baholarim\n📝 Vazifalarim",
    );
    return;
  }

  const studentId = await findStudentIdByChat(String(chat.id));
  if (!studentId) {
    await sendTelegramMessage(String(chat.id), "Avval admin yuborgan start link orqali botni ulang.");
    return;
  }

  await replyForStudent(String(chat.id), studentId, text);
}

export async function getTelegramStudentStatus(studentId: string) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      full_name,
      telegram_chat_id,
      telegram_username,
      telegram_connected_at,
      telegram_link_expires_at,
      telegram_link_sent_at,
      telegram_credentials_sent_at
    FROM students
    WHERE id = ?
    LIMIT 1
  `).get(studentId) as
    | {
        full_name: string;
        telegram_chat_id?: string | null;
        telegram_username?: string | null;
        telegram_connected_at?: string | null;
        telegram_link_expires_at?: string | null;
        telegram_link_sent_at?: string | null;
        telegram_credentials_sent_at?: string | null;
      }
    | undefined;

  if (!row) return null;

  return {
    studentName: row.full_name,
    chatId: row.telegram_chat_id ?? undefined,
    username: row.telegram_username ?? undefined,
    connectedAt: row.telegram_connected_at ?? undefined,
    inviteExpiresAt: row.telegram_link_expires_at ?? undefined,
    inviteSentAt: row.telegram_link_sent_at ?? undefined,
    credentialsSentAt: row.telegram_credentials_sent_at ?? undefined,
    connectedLabel: row.telegram_connected_at ? "Ulangan" : "Ulanmagan",
    connectedMeta: row.telegram_connected_at ? formatDateTime(row.telegram_connected_at) : "Hali ulanmagan",
  };
}
