"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export type FavoriteState = { ok: boolean; added: boolean; message: string };

export async function setUserFavorite(
  favoriteUserId: string,
  shouldFavorite: boolean
): Promise<FavoriteState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, added: false, message: "Iniciá sesión para usar favoritos." };
  }

  if (favoriteUserId === user.id) {
    return { ok: false, added: false, message: "No podés favoritarte a vos mismo." };
  }

  if (shouldFavorite) {
    const { error } = await supabase.from(DB_TABLES.userFavorites).insert({
      user_id: user.id,
      favorite_user_id: favoriteUserId,
    });

    if (error) {
      if (error.code === "23505") {
        return { ok: true, added: false, message: "Ya estaba en favoritos." };
      }
      return { ok: false, added: false, message: error.message };
    }

    revalidatePath(`/jugador/${favoriteUserId}`);
    revalidatePath("/home");
    return { ok: true, added: true, message: "Añadido a favoritos." };
  }

  const { error: delErr } = await supabase
    .from(DB_TABLES.userFavorites)
    .delete()
    .eq("user_id", user.id)
    .eq("favorite_user_id", favoriteUserId);

  if (delErr) {
    return { ok: false, added: false, message: delErr.message };
  }

  revalidatePath(`/jugador/${favoriteUserId}`);
  revalidatePath("/home");
  return { ok: true, added: false, message: "Quitado de favoritos." };
}
