import {
  createStudentAttendanceController,
  listAttendanceController,
} from "@/lib/controllers/attendance-controller";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  url.searchParams.set("studentId", id);
  return listAttendanceController(new Request(url.toString(), request));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return createStudentAttendanceController(id, request);
}
