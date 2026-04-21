import Link from "next/link";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { voteOnRequest } from "./actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function MatchRequestsPage({ params }: PageProps) {
  const { id: matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myParticipant } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();
  if (!myParticipant) redirect(`/partidos/${matchId}`);

  const [{ data: pendingRows }, { count: participantsCount }] = await Promise.all([
    supabase
      .from(DB_TABLES.matchJoinRequests)
      .select("id, match_id, player_id, status, created_at")
      .eq("match_id", matchId)
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase.from(DB_TABLES.matchParticipants).select("player_id", { count: "exact", head: true }).eq("match_id", matchId),
  ]);

  const pending = (pendingRows ?? []) as Array<{
    id: string;
    match_id: string;
    player_id: string;
    status: string;
  }>;
  const totalParticipants = participantsCount ?? 0;
  const requesterIds = [...new Set(pending.map((item) => item.player_id))];
  const requestIds = pending.map((item) => item.id);
  const profilesData =
    requesterIds.length > 0
      ? await supabase.from(DB_TABLES.profiles).select("user_id,name,category,avatar_url").in("user_id", requesterIds)
      : { data: [] };
  const votesData =
    requestIds.length > 0
      ? await supabase.from(DB_TABLES.matchJoinVotes).select("request_id,vote").in("request_id", requestIds)
      : { data: [] };
  const profiles = (profilesData.data ?? []) as Array<{
    user_id: string;
    name: string | null;
    category: string | null;
    avatar_url: string | null;
  }>;
  const votes = (votesData.data ?? []) as Array<{ request_id: string; vote: boolean }>;
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const yesVotesByRequest = new Map<string, number>();
  for (const vote of votes) {
    if (vote.vote !== true) continue;
    yesVotesByRequest.set(vote.request_id, (yesVotesByRequest.get(vote.request_id) ?? 0) + 1);
  }

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-2">
        <Link href={`/partidos/${matchId}`} className="inline-block text-sm font-semibold text-[#0585FC] hover:text-[#0461C4]">
          ← Volver al partido
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">Solicitudes de acceso</h1>
        <p className="text-sm text-slate-500">Votá quién puede entrar al partido cuando hay nivel restringido.</p>
      </header>

      {pending.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          No hay solicitudes pendientes.
        </section>
      ) : (
        <section className="space-y-3">
          {pending.map((request) => {
            const profile = profileMap.get(request.player_id) ?? null;
            const name = profile?.name?.trim() || "Jugador";
            const category = profile?.category?.trim() || "Sin nivel";
            const yesVotes = yesVotesByRequest.get(request.id) ?? 0;

            return (
              <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <ProfileAvatar avatarUrl={profile?.avatar_url ?? null} name={name} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                    <p className="text-xs text-slate-500">Nivel: {category}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {yesVotes} de {Math.floor(totalParticipants / 2) + 1} votos necesarios
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <form action={voteOnRequest}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <input type="hidden" name="match_id" value={matchId} />
                    <input type="hidden" name="vote" value="true" />
                    <button
                      type="submit"
                      className="w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Aceptar ✓
                    </button>
                  </form>
                  <form action={voteOnRequest}>
                    <input type="hidden" name="request_id" value={request.id} />
                    <input type="hidden" name="match_id" value={matchId} />
                    <input type="hidden" name="vote" value="false" />
                    <button
                      type="submit"
                      className="w-full rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Rechazar ✗
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </MotionPage>
  );
}
