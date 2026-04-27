import { createBootcampController, listBootcampsController } from "@/lib/controllers/bootcamp-controller";

export async function GET() {
  return listBootcampsController();
}

export async function POST(request: Request) {
  return createBootcampController(request);
}
