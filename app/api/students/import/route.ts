import { importStudentsController } from "@/lib/controllers/attendance-controller";

export async function POST(request: Request) {
  return importStudentsController(request);
}
