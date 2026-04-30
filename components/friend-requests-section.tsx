import { ProfileAvatar } from "@/components/profile-avatar";
import { acceptFriendRequest, rejectFriendRequest } from "@/app/(player)/jugador/[userId]/actions";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export async function FriendRequestsSection({ userId }: { userId: string }) {
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from(DB_TABLES.friendRequests)
    .select("id, sender_id, created_at")
    .eq("receiver_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!requests?.length) return null;

  const senderIds = requests.map((r: { sender_id: string }) => r.sender_id);
  const { data: profiles } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url, category")
    .in("user_id", senderIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: { user_id: string; name?: string | null; avatar_url?: string | null; category?: string | null }) => [
      p.user_id,
      p,
    ])
  );

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
        Solicitudes de amistad ({requests.length})
      </h2>
      {requests.map((req) => {
        const typedReq = req as { id: string; sender_id: string };
        const profile = profileMap.get(typedReq.sender_id);
        const name = profile?.name ?? "Jugador";
        const avatarUrl = profile?.avatar_url ?? null;
        const category = profile?.category ?? null;
        return (
          <div
            key={typedReq.id}
            className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm dark:border-white/[0.06]"
          >
            <ProfileAvatar avatarUrl={avatarUrl} name={name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900 dark:text-white">{name}</p>
              {category ? <p className="text-xs text-slate-500">Nivel {category}</p> : null}
            </div>
            <div className="shrink-0 flex gap-2">
              <form
                action={async () => {
                  "use server";
                  await acceptFriendRequest(typedReq.id, typedReq.sender_id);
                }}
              >
                <button type="submit" className="btn-primary-gradient rounded-xl px-3 py-2 text-xs font-semibold">
                  Aceptar
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await rejectFriendRequest(typedReq.id);
                }}
              >
                <button
                  type="submit"
                  className="btn-danger rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  Rechazar
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </section>
  );
}
