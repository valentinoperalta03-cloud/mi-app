import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

export async function resolveHomePath(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: ownedClub } = await supabase
    .from(DB_TABLES.clubs)
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  if (ownedClub) {
    return "/admin/dashboard";
  }
  return "/home";
}

const NEXT_SAFE_PREFIXES = ["/partidos/", "/reservas/", "/torneos/", "/clubes/"] as const;

/** Valida `?next=` post-login: solo rutas internas conocidas, nunca URLs externas. */
export function resolveSafeNextPath(next: string | null | undefined): string | null {
  const trimmed = (next ?? "").trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return NEXT_SAFE_PREFIXES.some((p) => trimmed.startsWith(p)) ? trimmed : null;
}

export function isAdminPanelPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Paywall de suscripcion y sus subflujos: siempre accesibles aunque el club este bloqueado. */
export function isFacturacionPath(pathname: string): boolean {
  return pathname === "/admin/facturacion" || pathname.startsWith("/admin/facturacion/");
}

/** Activacion inicial (subscription_status = 'pending'): siempre accesible, igual que facturacion. */
export function isActivacionPath(pathname: string): boolean {
  return pathname === "/admin/activacion" || pathname.startsWith("/admin/activacion/");
}

export function isSuperadminPath(pathname: string): boolean {
  return pathname === "/superadmin" || pathname.startsWith("/superadmin/");
}

export function isJugadorAppPath(pathname: string): boolean {
  const roots = [
    "/home",
    "/inicio",
    "/feed",
    "/comunidad",
    "/clubes",
    "/partidos",
    "/buscar-partido",
    "/reservas",
    "/perfil",
    "/jugador",
    "/clases",
    "/torneos",
    "/test",
  ];
  return roots.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPublicAuthPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/registro-club") return true;
  if (pathname === "/verificar-email") return true;
  if (pathname === "/privacidad") return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

/**
 * Rutas públicas sin sesión que NO deben redirigir a usuarios ya logueados (a diferencia de isPublicAuthPath).
 * Las páginas públicas de club (`/[slug]`) NO se listan acá: se resuelven en `proxy.ts` dejando pasar
 * cualquier ruta que no matchee ninguna ruta conocida de la app (ver `isKnownRoute` en proxy.ts).
 */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/agenda";
}

/** Rutas permitidas con sesión activa pero cuenta suspendida globalmente. */
export function isGlobalBlockExemptPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/auth/");
}

export const GLOBAL_BLOCK_LOGIN_MESSAGE =
  "Tu cuenta fue suspendida. Contactá a soporte.padelibre@gmail.com";

export async function fetchIsGloballyBlocked(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from(DB_TABLES.profiles)
    .select("is_globally_blocked")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean((data as { is_globally_blocked?: boolean | null } | null)?.is_globally_blocked);
}
