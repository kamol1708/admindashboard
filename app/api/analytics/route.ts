import { analyticsController } from "@/lib/controllers/analytics-controller";

export async function GET() {
  return analyticsController();
}
