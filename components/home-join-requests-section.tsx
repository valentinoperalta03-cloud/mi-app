import Link from "next/link";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export default async function HomeJoinRequestsSection({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .select("id, match_id, player_id, created_at")
    .eq("status", "pending");

  const pending = (rows ?? []) as Array<{
    id: string;
    match_id: string;
    player_id: string;
    created_at: string;
  }>;
  if (pending.length === 0) return null;

  const matchIds = [...new Set(pending.map((item) => item.match_id))];
  const requesterIds = [...new Set(pending.map((item) => item.player_id))];

  const { data: myParticipations } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id, player_id")
    .in("match_id", matchIds)
    .eq("player_id", userId);
  const { data: requesterProfiles } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, category, avatar_url")
    .in("user_id", requesterIds);

  const allowedMatchIds = new Set((myParticipations ?? []).map((row: { match_id: string }) => row.match_id));
  const profileMap = new Map(
    ((requesterProfiles ?? []) as Array<{
      user_id: string;
      name: string | null;
      category: string | null;
      avatar_url: string | null;
    }>).map((profile) => [profile.user_id, profile])
  );

  const visible = pending
    .filter((row) => row.player_id !== userId && allowedMatchIds.has(row.match_id))
    .map((row) => ({
      id: row.id,
      matchId: row.match_id,
      requesterName: profileMap.get(row.player_id)?.name?.trim() || "Jugador",
      requesterCategory: profileMap.get(row.player_id)?.category?.trim() || "Sin nivel",
    }));

  if (visible.length === 0) return null;

  return (
    <article className="rounded-[2rem] border border-sky-200 bg-sky-50/70 p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
      <h2 className="text-lg font-bold tracking-tight text-slate-900">Solicitudes pendientes</h2>
      <ul className="mt-3 space-y-2">
        {visible.slice(0, 4).map((item) => (
          <li key={item.id} className="rounded-2xl border border-sky-100 bg-white/90 px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">{item.requesterName}</p>
            <p className="text-xs text-slate-600">Nivel: {item.requesterCategory}</p>
            <Link
              href={`/partidos/${item.matchId}/solicitudes`}
              className="mt-1 inline-block text-xs font-semibold text-sky-700 underline decoration-sky-200/80 underline-offset-2"
            >
              Ver y votar
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
