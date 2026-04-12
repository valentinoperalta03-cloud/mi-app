"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { fetchLatestMatchResultForUser } from "@/lib/para-ti-posts";
import { createClient } from "@/utils/supabase/server";

export type CreatePostState = { ok: boolean; message: string };

export const initialCreatePostState: CreatePostState = { ok: false, message: "" };

function getText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createPostAction(
  _prev: CreatePostState,
  formData: FormData
): Promise<CreatePostState> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Iniciá sesión para publicar." };
  }

  const content = getText(formData, "content");
  if (!content) {
    return { ok: false, message: "Escribí algo antes de publicar." };
  }
  if (content.length > 4000) {
    return { ok: false, message: "El texto es demasiado largo." };
  }

  const linkMatch = formData.get("link_match") === "on";
  let matchId: string | null = null;

  if (linkMatch) {
    const latest = await fetchLatestMatchResultForUser(supabase, user.id);
    if (!latest?.match_id) {
      return { ok: false, message: "No tenés un resultado reciente para vincular." };
    }
    const { data: inMatch } = await supabase
      .from(DB_TABLES.matchPlayers)
      .select("match_id")
      .eq("match_id", latest.match_id)
      .eq("player_id", user.id)
      .maybeSingle();
    if (!inMatch) {
      return { ok: false, message: "No podés vincular ese partido." };
    }
    matchId = latest.match_id;
  }

  const { data: inserted, error } = await supabase
    .from(DB_TABLES.posts)
    .insert({
      user_id: user.id,
      content,
      match_id: matchId,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!inserted?.id) {
    return { ok: false, message: "No se pudo confirmar la publicación. Intentá de nuevo." };
  }

  revalidatePath("/comunidad/feed", "page");
  return { ok: true, message: "Publicación creada." };
}
