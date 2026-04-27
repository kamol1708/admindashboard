import { listBillingController } from "@/lib/controllers/billing-controller";

export async function GET() {
  return listBillingController();
}
