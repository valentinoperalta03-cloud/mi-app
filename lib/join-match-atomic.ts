import type { SupabaseClient } from "@supabase/supabase-js";

export type JoinMatchAtomicResult = {
  ok: boolean;
  reason: string | null;
  participantCount: number;
  matchStatus: string | null;
};

type JoinMatchAtomicRow = {
  ok?: boolean;
  reason?: string | null;
  participant_count?: number | null;
  match_status_out?: string | null;
};

/**
 * Union atomica a un partido via RPC `join_match_atomic` (SELECT ... FOR UPDATE
 * en Supabase): valida cupo total, cupo por equipo y actualiza match_status a
 * "full" dentro de la misma transaccion, evitando la carrera de "leer cupo →
 * insertar" que permitia pasarse de 4 jugadores o de 2 por equipo.
 */
export async function joinMatchAtomic(
  supabase: SupabaseClient,
  matchId: string,
  playerId: string,
  team: 1 | 2 | null
): Promise<JoinMatchAtomicResult> {
  const { data, error } = await supabase.rpc("join_match_atomic", {
    p_match_id: matchId,
    p_player_id: playerId,
    p_team: team,
  });
  if (error) {
    console.error("[join_match_atomic]", error.message);
    return { ok: false, reason: "db_error", participantCount: 0, matchStatus: null };
  }
  const row = (Array.isArray(data) ? data[0] : data) as JoinMatchAtomicRow | null;
  return {
    ok: Boolean(row?.ok),
    reason: row?.reason ?? null,
    participantCount: row?.participant_count ?? 0,
    matchStatus: row?.match_status_out ?? null,
  };
}
