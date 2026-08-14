"use server";

import { revalidatePath } from "next/cache";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export type UpdateClubSlugResult = { ok: true } | { error: string };

export async function updateClubSlugAction(
  clubId: string,
  newSlug: string
): Promise<UpdateClubSlugResult> {
  const slug = String(newSlug ?? "").trim();

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: "El link solo puede tener letras minúsculas, números y guiones" };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.clubIds.includes(clubId)) {
    return { error: "No tenés permiso para editar este club." };
  }

  const { data: club, error: clubError } = await supabase
    .from(DB_TABLES.clubs)
    .select("id, slug")
    .eq("owner_id", ctx.userId)
    .maybeSingle();

  console.log("[slug] club:", club, "error:", clubError);

  if (!club) return { error: `Club no encontrado para owner ${ctx.userId}` };

  const { data: existing } = await supabase
    .from(DB_TABLES.clubs)
    .select("id")
    .eq("slug", slug)
    .neq("id", clubId)
    .maybeSingle();

  if (existing) {
    return { error: "Ese link ya está en uso, elegí otro" };
  }

  const { data: currentClub } = await supabase
    .from(DB_TABLES.clubs)
    .select("slug")
    .eq("id", clubId)
    .single();

  const oldSlug = (currentClub as { slug?: string | null } | null)?.slug ?? null;
  if (oldSlug && oldSlug !== slug) {
    await supabase
      .from(DB_TABLES.clubSlugRedirects)
      .upsert({ old_slug: oldSlug, club_id: clubId });
  }

  const { error } = await supabase
    .from(DB_TABLES.clubs)
    .update({ slug })
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);

  if (error) return { error: "No se pudo guardar el link." };

  revalidatePath("/admin/config/informacion");
  revalidatePath("/admin/dashboard");
  return { ok: true };
}

export type UpdateClubSocialsResult = { ok: true } | { error: string };

const HANDLE_PATTERN = /^[^\s]+$/;

function cleanHandle(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/\S+\//, "");
}

export async function updateClubSocialsAction(
  clubId: string,
  socials: { instagram: string; whatsapp: string; facebook: string; tiktok: string }
): Promise<UpdateClubSocialsResult> {
  const instagram = cleanHandle(socials.instagram);
  const whatsapp = String(socials.whatsapp ?? "").trim().replace(/\D/g, "");
  const facebook = cleanHandle(socials.facebook);
  const tiktok = cleanHandle(socials.tiktok);

  for (const [label, value] of [
    ["Instagram", instagram],
    ["Facebook", facebook],
    ["TikTok", tiktok],
  ] as const) {
    if (value && (!HANDLE_PATTERN.test(value) || value.includes("://"))) {
      return { error: `${label}: usá solo el usuario, sin espacios ni URLs completas.` };
    }
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId || !ctx.clubIds.includes(clubId)) {
    return { error: "No tenés permiso para editar este club." };
  }

  const { error } = await supabase
    .from(DB_TABLES.clubs)
    .update({
      instagram: instagram || null,
      whatsapp: whatsapp || null,
      facebook: facebook || null,
      tiktok: tiktok || null,
    })
    .eq("id", clubId)
    .eq("owner_id", ctx.userId);

  if (error) return { error: "No se pudieron guardar las redes sociales." };

  revalidatePath("/admin/config/informacion");
  return { ok: true };
}
