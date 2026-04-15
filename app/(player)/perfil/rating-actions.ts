"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export type RatingActionState = { ok: boolean; message: string };

export async function submitPlayerRating(
  matchId: string,
  ratedId: string,
  rating: number
): Promise<RatingActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "No hay sesión." };
  }

  if (!matchId || !ratedId) {
    return { ok: false, message: "Datos incompletos." };
  }

  if (ratedId === user.id) {
    return { ok: false, message: "No podés calificarte a vos mismo." };
  }

  const r = Math.round(rating);
  if (r < 1 || r > 7) {
    return { ok: false, message: "La calificación debe ser entre 1 y 7." };
  }

  const { data: inMatch } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();

  if (!inMatch) {
    return { ok: false, message: "No participaste en este partido." };
  }

  const { data: peerIn } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("match_id", matchId)
    .eq("player_id", ratedId)
    .maybeSingle();

  if (!peerIn) {
    return { ok: false, message: "Ese jugador no estaba en el partido." };
  }

  const { data: finished } = await supabase
    .from(DB_TABLES.matchResults)
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();

  if (!finished) {
    return { ok: false, message: "Este partido aún no está registrado como finalizado." };
  }

  const { error } = await supabase.from(DB_TABLES.playerRatings).insert({
    match_id: matchId,
    rater_id: user.id,
    rated_id: ratedId,
    rating: r,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "Ya calificaste a este jugador en este partido." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/perfil");
  return { ok: true, message: "Calificación guardada." };
}
