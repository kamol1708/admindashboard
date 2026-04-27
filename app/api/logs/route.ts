import { logsController } from "@/lib/controllers/analytics-controller";

export async function GET() {
  return logsController();
}
