import { updateAttendanceController } from "@/lib/controllers/attendance-controller";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return updateAttendanceController(id, request);
}
