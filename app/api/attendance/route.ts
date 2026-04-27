import { createAttendanceController, listAttendanceController } from "@/lib/controllers/attendance-controller";

export async function GET(request: Request) {
  return listAttendanceController(request);
}

export async function POST(request: Request) {
  return createAttendanceController(request);
}
