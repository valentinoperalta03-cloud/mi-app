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

export function isAdminPanelPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
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
  if (pathname === "/verificar-email") return true;
  if (pathname === "/privacidad") return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
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
