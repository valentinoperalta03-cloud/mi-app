import Link from "next/link";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { fetchConversationPreviews } from "@/lib/chat-partners";
import { fetchGroupPreviews } from "@/lib/group-chats";
import { createClient } from "@/utils/supabase/server";
import { MensajesClient } from "./mensajes-client";

export default async function MensajesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conversations = await fetchConversationPreviews(supabase, user.id);
  const groups = await fetchGroupPreviews(supabase, user.id);
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

  const mutualFriendIds = [...mutualIds];
  const { data: mutualFriendProfiles } = mutualFriendIds.length
    ? await supabase
        .from(DB_TABLES.profiles)
        .select("user_id, name, avatar_url")
        .in("user_id", mutualFriendIds)
    : { data: [] };

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
        <p className="text-sm text-slate-500">Chats directos y grupos.</p>
      </header>
      <MensajesClient
        conversations={conversations}
        groups={groups}
        mutualIds={mutualFriendIds}
        mutualFriends={
          (mutualFriendProfiles ?? []) as Array<{
            user_id: string;
            name: string | null;
            avatar_url: string | null;
          }>
        }
      />
    </MotionPage>
  );
}
