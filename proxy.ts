import { type NextRequest, NextResponse } from "next/server";
import {
  fetchIsGloballyBlocked,
  GLOBAL_BLOCK_LOGIN_MESSAGE,
  isActivacionPath,
  isAdminPanelPath,
  isFacturacionPath,
  isGlobalBlockExemptPath,
  isJugadorAppPath,
  isPublicAuthPath,
  isPublicPath,
  isSuperadminPath,
  resolveHomePath,
} from "@/lib/auth-redirect";
import { SUBSCRIPTION_COOKIE_MAX_AGE_SECONDS, SUBSCRIPTION_COOKIE_NAME } from "@/lib/club-subscription-cookie";
import { DB_TABLES } from "@/lib/db-tables";
import { SUPERADMIN_EMAILS } from "@/lib/superadmin/constants";
import { evaluateClubSubscriptionGate } from "@/lib/subscription-gate";
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

const API_PUBLIC_PREFIXES = ["/api/mp/webhook", "/api/mp/subscriptions/webhook", "/api/cron/"] as const;

function isApiPublicPath(pathname: string): boolean {
  return API_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function setSubscriptionCookie(response: NextResponse, value: string) {
  response.cookies.set(SUBSCRIPTION_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SUBSCRIPTION_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
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
    if (isPublicAuthPath(pathname) || isPublicPath(pathname) || pathname.startsWith("/api/")) {
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

    if (isAdminPanelPath(pathname) && !isFacturacionPath(pathname) && !isActivacionPath(pathname)) {
      const { data: ownedClub } = await supabase
        .from(DB_TABLES.clubs)
        .select("id")
        .eq("owner_id", user.id)
        .limit(1)
        .maybeSingle();
      const clubId = String((ownedClub as { id?: string } | null)?.id ?? "").trim();

      if (clubId) {
        const gate = await evaluateClubSubscriptionGate(
          request.cookies.get(SUBSCRIPTION_COOKIE_NAME)?.value,
          clubId
        );

        if (gate.blockReason) {
          const target =
            gate.blockReason === "pending"
              ? "/admin/activacion"
              : `/admin/facturacion?reason=${gate.blockReason}`;
          const blockedResponse = redirectPreservingSupabaseCookies(request, target, response);
          if (gate.refreshedCookieValue) {
            setSubscriptionCookie(blockedResponse, gate.refreshedCookieValue);
          }
          return blockedResponse;
        }

        if (gate.refreshedCookieValue) {
          setSubscriptionCookie(response, gate.refreshedCookieValue);
        }
      }
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
