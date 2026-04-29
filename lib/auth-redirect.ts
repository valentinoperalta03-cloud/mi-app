import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

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
  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("onboarding_completed,is_leveled")
    .eq("user_id", userId)
    .maybeSingle();
  const row = profile as { onboarding_completed?: boolean | null; is_leveled?: boolean | null } | null;
  if (row?.onboarding_completed === true) {
    return "/home";
  }
  if ((row?.onboarding_completed === false || row?.onboarding_completed == null) && row?.is_leveled === true) {
    const service = createServiceClient();
    await service
      .from(DB_TABLES.profiles)
      .update({ onboarding_completed: true })
      .eq("user_id", userId);
    return "/home";
  }
  if (!row?.onboarding_completed && !row?.is_leveled) {
    return "/onboarding";
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
    "/onboarding",
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
