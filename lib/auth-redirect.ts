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
    "/matches",
    "/clases",
    "/torneos",
    "/test",
  ];
  return roots.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isPublicAuthPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/privacidad") return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}
