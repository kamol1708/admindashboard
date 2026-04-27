import { NextResponse } from "next/server";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";
import { requireRole } from "@/lib/services/auth-service";
import {
  createTelegramInvite,
  ensureTelegramBotRuntime,
  getTelegramConfig,
  handleTelegramWebhook,
  sendTelegramCredentials,
} from "@/lib/services/telegram-service";

export async function createStudentTelegramLinkController(studentId: string) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  try {
    await ensureTelegramBotRuntime();
    const result = await createTelegramInvite(studentId);
    if ("error" in result) return jsonError(result.error ?? "Telegram link yaratilmadi.", 400);
    return NextResponse.json(result);
  } catch {
    return jsonError("Telegram link yaratilmadi.", 500);
  }
}

export async function sendStudentTelegramCredentialsController(studentId: string) {
  const session = await getCurrentSession();
  const auth = requireRole(session, ["admin"]);
  if (!auth.ok) return jsonError(auth.error, auth.status);

  try {
    await ensureTelegramBotRuntime();
    const result = await sendTelegramCredentials(studentId);
    if ("error" in result) return jsonError(result.error ?? "Telegramga login va parol yuborilmadi.", 400);
    return NextResponse.json(result);
  } catch {
    return jsonError("Telegramga login va parol yuborilmadi.", 500);
  }
}

export async function telegramWebhookController(request: Request) {
  const config = getTelegramConfig();
  if (!config.enabled) return jsonError("Telegram bot sozlanmagan.", 503);

  const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token")?.trim();
  if (config.webhookSecret && incomingSecret !== config.webhookSecret) {
    return jsonError("Webhook secret noto'g'ri.", 401);
  }

  try {
    const payload = await request.json();
    await handleTelegramWebhook(payload);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError("Telegram webhook qayta ishlanmadi.", 500);
  }
}
