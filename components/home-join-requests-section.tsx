import Link from "next/link";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export default async function HomeJoinRequestsSection({ userId }: { userId: string }) {
  const supabase = await createClient();

  const [{ data: ownedMatches }, { data: participations }] = await Promise.all([
    supabase.from(DB_TABLES.matches).select("id").eq("owner_id", userId),
    supabase.from(DB_TABLES.matchParticipants).select("match_id").eq("player_id", userId),
  ]);

  const ownerMatchIds = new Set((ownedMatches ?? []).map((row: { id: string }) => row.id));
  const matchIds = [
    ...new Set([
      ...ownerMatchIds,
      ...(participations ?? []).map((row: { match_id: string }) => row.match_id),
    ]),
  ];

  if (matchIds.length === 0) return null;

  const { data: rows } = await supabase
    .from(DB_TABLES.matchJoinRequests)
    .select("id, match_id, player_id, created_at")
    .eq("status", "pending")
    .in("match_id", matchIds)
    .neq("player_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const pending = (rows ?? []) as Array<{
    id: string;
    match_id: string;
    player_id: string;
    created_at: string;
  }>;
  if (pending.length === 0) return null;

  const requesterIds = [...new Set(pending.map((item) => item.player_id))];
  const { data: requesterProfiles } =
    requesterIds.length > 0
      ? await supabase
          .from(DB_TABLES.profiles)
          .select("user_id, name, category, avatar_url")
          .in("user_id", requesterIds)
      : { data: [] as Array<{ user_id: string; name: string | null; category: string | null; avatar_url: string | null }> };

  const profileMap = new Map(
    ((requesterProfiles ?? []) as Array<{
      user_id: string;
      name: string | null;
      category: string | null;
      avatar_url: string | null;
    }>).map((profile) => [profile.user_id, profile])
  );

  const visible = pending.map((row) => {
    const prof = profileMap.get(row.player_id);
    return {
      id: row.id,
      matchId: row.match_id,
      requesterName: prof?.name?.trim() || "Jugador",
      requesterCategory: prof?.category?.trim() || "Sin nivel",
      avatarUrl: prof?.avatar_url ?? null,
      isOwnerRequest: ownerMatchIds.has(row.match_id),
    };
  });

  if (visible.length === 0) return null;

  return (
    <article className="rounded-[2rem] border border-[#0585FC]/20 bg-[#0585FC]/5/70 p-5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
      <h2 className="text-base font-semibold tracking-tight text-slate-900">Solicitudes pendientes</h2>
      <ul className="mt-3 space-y-2">
        {visible.slice(0, 6).map((item) => (
          <li key={item.id} className="flex gap-3 rounded-2xl border border-[#0585FC]/20 bg-white/90 px-3 py-2">
            <ProfileAvatar avatarUrl={item.avatarUrl} name={item.requesterName} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{item.requesterName}</p>
              <p className="text-xs text-slate-600">Nivel: {item.requesterCategory}</p>
              <Link
                href={
                  item.isOwnerRequest
                    ? `/partidos/${item.matchId}`
                    : `/partidos/${item.matchId}/solicitudes`
                }
                className="mt-1 inline-block text-xs font-semibold text-[#0461C4] underline decoration-sky-200/80 underline-offset-2"
              >
                {item.isOwnerRequest ? "Gestionar acceso" : "Ver y votar"}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
