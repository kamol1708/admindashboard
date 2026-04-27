import { createGroupController, listGroupsController } from "@/lib/controllers/group-controller";

export async function GET() {
  return listGroupsController();
}

export async function POST(request: Request) {
  return createGroupController(request);
}
