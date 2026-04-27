import { deleteEnrollmentController, updateEnrollmentController } from "@/lib/controllers/bootcamp-controller";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return updateEnrollmentController(id, request);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return deleteEnrollmentController(id);
}
