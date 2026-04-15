"use server";

import { revalidatePath } from "next/cache";
import { applyTechnicalRatingAfterMatchResult } from "@/lib/apply-match-technical-rating";
import { DB_TABLES } from "@/lib/db-tables";
import { matchTypeAffectsTechnicalRating } from "@/lib/level-logic";
import { createClient } from "@/utils/supabase/server";

export type RecordMatchResultState = { ok: boolean; message: string };

const initialState: RecordMatchResultState = { ok: false, message: "" };

function parseScore(raw: FormDataEntryValue | null): number | null {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 0 || n > 30) return null;
  return n;
}

export async function recordMatchResultAction(
  prevState: RecordMatchResultState = initialState,
  formData: FormData
): Promise<RecordMatchResultState> {
  void prevState;

  const matchId = String(formData.get("match_id") ?? "").trim();
  const teamA = parseScore(formData.get("team_a_score"));
  const teamB = parseScore(formData.get("team_b_score"));

  if (!matchId || teamA == null || teamB == null) {
    return { ok: false, message: "Completá los sets con números válidos (0–30)." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { ok: false, message: "Iniciá sesión para cargar el resultado." };
  }

  const { data: existing } = await supabase
    .from(DB_TABLES.matchResults)
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();

  if (existing) {
    return { ok: false, message: "Este partido ya tiene un resultado cargado." };
  }

  const { data: mp } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", matchId);

  const ids = (mp ?? []).map((r: { player_id: string }) => r.player_id);
  const { data: matchRow } = await supabase
    .from(DB_TABLES.matches)
    .select("owner_id, match_type")
    .eq("id", matchId)
    .maybeSingle();
  const ownerId = (matchRow as { owner_id?: string | null } | null)?.owner_id;
  const matchType = (matchRow as { match_type?: string | null } | null)?.match_type;
  const allowed = ids.includes(user.id) || ownerId === user.id;

  if (!allowed) {
    return { ok: false, message: "No podés cargar el resultado de este partido." };
  }

  const { data: inserted, error: insErr } = await supabase
    .from(DB_TABLES.matchResults)
    .insert({
      match_id: matchId,
      team_a_score: teamA,
      team_b_score: teamB,
    })
    .select("id")
    .maybeSingle();

  if (insErr || !inserted?.id) {
    return {
      ok: false,
      message: insErr?.message ?? "No se pudo guardar el resultado.",
    };
  }

  const rating = await applyTechnicalRatingAfterMatchResult(supabase, {
    matchId,
    teamAScore: teamA,
    teamBScore: teamB,
  });

  if (!rating.ok) {
    await supabase.from(DB_TABLES.matchResults).delete().eq("match_id", matchId);
    return { ok: false, message: rating.message };
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/home");
  revalidatePath("/perfil");
  revalidatePath("/buscar-partido");

  let message: string;
  if (rating.ratingApplied) {
    message = "Resultado cargado; el nivel competitivo se actualizó.";
  } else if (!matchTypeAffectsTechnicalRating(matchType)) {
    message = "Resultado cargado (amistoso: el nivel no cambia).";
  } else {
    message = `Resultado cargado. ${rating.message}`;
  }

  return { ok: true, message };
}
