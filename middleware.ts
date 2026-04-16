import { type NextRequest, NextResponse } from "next/server";
import {
  isAdminPanelPath,
  isJugadorAppPath,
  isPublicAuthPath,
  resolveHomePath,
} from "@/lib/auth-redirect";
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

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (user && !user.email_confirmed_at) {
    if (pathname === "/verificar-email" || pathname.startsWith("/auth/")) {
      return response;
    }
    return redirectPreservingSupabaseCookies(request, "/verificar-email", response);
  }

  if (!user) {
    if (isPublicAuthPath(pathname)) {
      return response;
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return redirectPreservingSupabaseCookies(request, `${loginUrl.pathname}${loginUrl.search}`, response);
  }

  const homePath = await resolveHomePath(supabase, user.id);
  const isAdmin = homePath === "/admin/dashboard";

  if (pathname === "/") {
    return redirectPreservingSupabaseCookies(request, homePath, response);
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
