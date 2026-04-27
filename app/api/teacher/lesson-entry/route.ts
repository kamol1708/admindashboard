import { createTeacherLessonEntryController } from "@/lib/controllers/attendance-controller";

export async function POST(request: Request) {
  return createTeacherLessonEntryController(request);
}
