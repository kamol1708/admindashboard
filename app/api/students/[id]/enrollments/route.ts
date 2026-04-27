import { studentEnrollmentSummaryController } from "@/lib/controllers/bootcamp-controller";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return studentEnrollmentSummaryController(id);
}
