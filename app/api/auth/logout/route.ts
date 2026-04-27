import { logoutController } from "@/lib/controllers/auth-controller";

export async function POST() {
  return logoutController();
}
