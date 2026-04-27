import { createEnrollmentController, listEnrollmentsController } from "@/lib/controllers/bootcamp-controller";

export async function GET(request: Request) {
  return listEnrollmentsController(request);
}

export async function POST(request: Request) {
  return createEnrollmentController(request);
}
