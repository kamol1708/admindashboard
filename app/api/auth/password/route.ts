import { changePasswordController } from "@/lib/controllers/auth-controller";

export async function POST(request: Request) {
  return changePasswordController(request);
}
