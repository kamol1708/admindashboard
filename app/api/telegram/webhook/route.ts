import { telegramWebhookController } from "@/lib/controllers/telegram-controller";

export async function POST(request: Request) {
  return telegramWebhookController(request);
}
