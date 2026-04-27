import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, encodeSession } from "@/lib/auth";
import { authenticateUser, changeOwnPassword, toSessionPayload } from "@/lib/services/auth-service";
import { getCurrentSession, jsonError } from "@/lib/controllers/http";

export async function loginController(request: Request) {
  try {
    const payload = (await request.json()) as { email?: string; password?: string };
    const user = await authenticateUser(payload.email ?? "", payload.password ?? "");
    if (!user) return jsonError("Login yoki parol noto'g'ri.", 401);

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, encodeSession(toSessionPayload(user)), {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({ ok: true, user: toSessionPayload(user) });
  } catch {
    return jsonError("Kirishni bajarishda server xatoligi yuz berdi.", 500);
  }
}

export async function logoutController() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  return NextResponse.json({ ok: true });
}

export async function meController() {
  const session = await getCurrentSession();
  if (!session) return jsonError("Session topilmadi.", 401);
  return NextResponse.json(session);
}

export async function changePasswordController(request: Request) {
  const session = await getCurrentSession();
  if (!session) return jsonError("Autentifikatsiya talab qilinadi.", 401);

  try {
    const payload = (await request.json()) as { currentPassword?: string; newPassword?: string };
    const result = await changeOwnPassword(session, payload.currentPassword ?? "", payload.newPassword ?? "");
    if ("error" in result) return jsonError(result.error ?? "Parol yangilanmadi.", 400);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError("Parolni yangilashda server xatoligi yuz berdi.", 500);
  }
}
