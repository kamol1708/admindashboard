import { deleteBootcampController, updateBootcampController } from "@/lib/controllers/bootcamp-controller";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return updateBootcampController(id, request);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return deleteBootcampController(id);
}
