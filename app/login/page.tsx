import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { AUTH_COOKIE, decodeSession } from "@/lib/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(AUTH_COOKIE)?.value);

  if (session) {
    redirect(session.role === "admin" ? "/admin" : "/panel");
  }

  return <LoginForm />;
}
