import { cookies } from "next/headers";
import { AdminDashboard } from "@/components/admin/dashboard";
import { AUTH_COOKIE, decodeSession } from "@/lib/auth";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(AUTH_COOKIE)?.value);

  return <AdminDashboard adminName={session?.name || "Azizbek Rahimov"} />;
}
