import { exportAttendanceController } from "@/lib/controllers/attendance-controller";

export async function GET(request: Request) {
  return exportAttendanceController(request);
}
