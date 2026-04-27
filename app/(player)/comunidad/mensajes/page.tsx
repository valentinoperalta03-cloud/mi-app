import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DB_TABLES } from "@/lib/db-tables";
import { fetchConversationPreviews } from "@/lib/chat-partners";
import { createClient } from "@/utils/supabase/server";

export default async function MensajesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conversations = await fetchConversationPreviews(supabase, user.id);
  const mutualIds = new Set<string>();
  if (conversations.length > 0) {
    const peerIds = conversations.map((c) => c.peerId);

    const [{ data: following }, { data: followers }] = await Promise.all([
      supabase
        .from(DB_TABLES.userFavorites)
        .select("favorite_user_id")
        .eq("user_id", user.id)
        .in("favorite_user_id", peerIds),
      supabase
        .from(DB_TABLES.userFavorites)
        .select("user_id")
        .eq("favorite_user_id", user.id)
        .in("user_id", peerIds),
    ]);

    const followingSet = new Set((following ?? []).map((f: { favorite_user_id: string }) => f.favorite_user_id));
    const followersSet = new Set((followers ?? []).map((f: { user_id: string }) => f.user_id));

    for (const id of peerIds) {
      if (followingSet.has(id) && followersSet.has(id)) {
        mutualIds.add(id);
      }
    }
  }

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md bg-slate-50 px-4 pb-32 pt-6">
      <header className="mb-6 space-y-2">
        <Link
          href="/comunidad"
          className="inline-block text-sm font-semibold text-[#0585FC] hover:text-[#0461C4]"
        >
          ← Comunidad
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mensajes</h1>
        <p className="text-sm text-slate-500">
          Chats con favoritos y compañeros con los que ya hablaste.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {conversations.map((c) => {
          const when =
            c.lastAt && new Date(c.lastAt).getTime() > 0
              ? formatDistanceToNow(new Date(c.lastAt), { addSuffix: true, locale: es })
              : null;
          return (
            <li key={c.peerId}>
              <Link
                href={`/comunidad/mensajes/${c.peerId}`}
                className="flex items-center gap-4 rounded-[2.5rem] border border-slate-200/80 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.15)] transition hover:border-slate-300/90"
              >
                <ProfileAvatar
                  avatarUrl={c.avatar_url}
                  name={c.name}
                  size={52}
                  ringClassName="ring-2 ring-slate-100"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{c.name}</p>
                    {mutualIds.has(c.peerId) ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/30">
                        Amigos
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-1 text-sm text-slate-500">{c.lastPreview}</p>
                  {when ? (
                    <p className="mt-0.5 text-xs font-medium text-slate-400">{when}</p>
                  ) : null}
                </div>
                <span className="text-[#0585FC]">→</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {conversations.length === 0 ? (
        <p className="rounded-[2.5rem] border border-dashed border-slate-200/90 bg-white/90 px-5 py-8 text-center text-sm text-slate-500">
          Seguí jugadores en{" "}
          <Link href="/comunidad/buscar" className="font-semibold text-[#0461C4] underline">
            comunidad
          </Link>{" "}
          o esperá un mensaje para ver conversaciones acá.
        </p>
      ) : null}
    </MotionPage>
  );
}
