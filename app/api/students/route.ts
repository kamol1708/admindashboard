import { createStudentController, listStudentsController } from "@/lib/controllers/student-controller";

export async function GET() {
  return listStudentsController();
}

export async function POST(request: Request) {
  return createStudentController(request);
}
