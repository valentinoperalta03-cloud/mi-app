import { type NextRequest, NextResponse } from "next/server";
import {
  isAdminPanelPath,
  isJugadorAppPath,
  isPublicAuthPath,
  resolveHomePath,
} from "@/lib/auth-redirect";
import { createMiddlewareClient } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user) {
    if (isPublicAuthPath(pathname)) {
      return response;
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const homePath = await resolveHomePath(supabase, user.id);
  const isAdmin = homePath === "/admin/dashboard";

  if (pathname === "/") {
    return NextResponse.redirect(new URL(homePath, request.url));
  }

  if (isPublicAuthPath(pathname)) {
    return NextResponse.redirect(new URL(homePath, request.url));
  }

  if (isAdmin) {
    if (isJugadorAppPath(pathname)) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return response;
  }

  if (isAdminPanelPath(pathname)) {
    return NextResponse.redirect(new URL("/app/feed", request.url));
  }

  if (pathname === "/inicio") {
    return NextResponse.redirect(new URL("/app/feed", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
