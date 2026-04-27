import { createStudentTelegramLinkController } from "@/lib/controllers/telegram-controller";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return createStudentTelegramLinkController(id);
}
