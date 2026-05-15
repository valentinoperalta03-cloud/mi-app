import { type NextRequest, NextResponse } from "next/server";
import {
  fetchIsGloballyBlocked,
  GLOBAL_BLOCK_LOGIN_MESSAGE,
  isAdminPanelPath,
  isGlobalBlockExemptPath,
  isJugadorAppPath,
  isPublicAuthPath,
  isSuperadminPath,
  resolveHomePath,
} from "@/lib/auth-redirect";
import { SUPERADMIN_EMAILS } from "@/lib/superadmin/constants";
import { createMiddlewareClient } from "@/utils/supabase/middleware";

/**
 * Supabase puede refrescar la sesión durante getUser() y escribir cookies en `sessionResponse`.
 * Si devolvemos un redirect nuevo sin copiar esas cookies, el cliente pierde la sesión o entra en bucles.
 */
function redirectPreservingSupabaseCookies(
  request: NextRequest,
  targetPath: string,
  sessionResponse: NextResponse
) {
  const url = new URL(targetPath, request.url);
  const redirect = NextResponse.redirect(url);
  const setCookies = sessionResponse.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    redirect.headers.append("Set-Cookie", cookie);
  }
  return redirect;
}

function redirectGloballyBlocked(request: NextRequest, sessionResponse: NextResponse) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("message", GLOBAL_BLOCK_LOGIN_MESSAGE);
  loginUrl.searchParams.set("kind", "error");
  return redirectPreservingSupabaseCookies(request, `${loginUrl.pathname}${loginUrl.search}`, sessionResponse);
}

const API_PUBLIC_PREFIXES = ["/api/mp/webhook", "/api/cron/"] as const;

function isApiPublicPath(pathname: string): boolean {
  return API_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const pathname = new URL(request.url).pathname;

  if (isApiPublicPath(pathname)) {
    return NextResponse.next();
  }

  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const blocked = await fetchIsGloballyBlocked(supabase, user.id);
    if (blocked) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Account suspended" }, { status: 403 });
      }
      if (!isGlobalBlockExemptPath(pathname)) {
        return redirectGloballyBlocked(request, response);
      }
      return response;
    }
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.next();
  }

  if (user && !user.email_confirmed_at) {
    if (pathname === "/verificar-email" || pathname.startsWith("/auth/")) {
      return response;
    }
    return redirectPreservingSupabaseCookies(request, "/verificar-email", response);
  }

  if (!user) {
    if (isPublicAuthPath(pathname) || pathname.startsWith("/api/")) {
      return response;
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return redirectPreservingSupabaseCookies(request, `${loginUrl.pathname}${loginUrl.search}`, response);
  }

  if (isSuperadminPath(pathname)) {
    const email = (user.email ?? "").trim().toLowerCase();
    if (!SUPERADMIN_EMAILS.has(email)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return redirectPreservingSupabaseCookies(request, `${loginUrl.pathname}${loginUrl.search}`, response);
    }
    return response;
  }

  const homePath = await resolveHomePath(supabase, user.id);
  const isAdmin = homePath === "/admin/dashboard";

  if (pathname === "/") {
    return redirectPreservingSupabaseCookies(request, homePath, response);
  }

  if (pathname === "/onboarding") {
    return response;
  }

  if (isPublicAuthPath(pathname)) {
    return redirectPreservingSupabaseCookies(request, homePath, response);
  }

  if (isAdmin) {
    if (isJugadorAppPath(pathname)) {
      const isPerfil = pathname === "/perfil" || pathname.startsWith("/perfil/");
      if (isPerfil) {
        return response;
      }
      return redirectPreservingSupabaseCookies(request, "/admin/dashboard", response);
    }
    return response;
  }

  if (isAdminPanelPath(pathname)) {
    return redirectPreservingSupabaseCookies(request, "/home", response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
