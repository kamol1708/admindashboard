import { notificationsController } from "@/lib/controllers/analytics-controller";

export async function GET() {
  return notificationsController();
}
