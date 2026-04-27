import { meController } from "@/lib/controllers/auth-controller";

export async function GET() {
  return meController();
}
