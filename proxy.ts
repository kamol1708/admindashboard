import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, decodeSession } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const session = decodeSession(request.cookies.get(AUTH_COOKIE)?.value);
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
  const isPanelRoute = request.nextUrl.pathname.startsWith("/panel");
  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  if (isAdminRoute && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && session?.role !== "admin") {
    return NextResponse.redirect(new URL("/panel", request.url));
  }

  if (isPanelRoute && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && session) {
    return NextResponse.redirect(new URL(session.role === "admin" ? "/admin" : "/panel", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/panel/:path*", "/login"],
};
