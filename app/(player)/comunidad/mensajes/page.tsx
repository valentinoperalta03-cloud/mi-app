import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { PlayerStackHeader } from "@/components/player-back-button";
import { DB_TABLES } from "@/lib/db-tables";
import { fetchConversationPreviews } from "@/lib/chat-partners";
import { fetchGroupPreviews } from "@/lib/group-chats";
import { createClient, getAdminClient } from "@/utils/supabase/server";
import { MensajesClient } from "./mensajes-client";

export default async function MensajesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const service = await getAdminClient();

  const conversations = await fetchConversationPreviews(service, user.id);
  const groups = await fetchGroupPreviews(service, user.id);
  const mutualIds = new Set<string>();
  const [{ data: following }, { data: followers }] = await Promise.all([
    service
      .from(DB_TABLES.userFavorites)
      .select("favorite_user_id")
      .eq("user_id", user.id),
    service
      .from(DB_TABLES.userFavorites)
      .select("user_id")
      .eq("favorite_user_id", user.id),
  ]);
  const followingSet = new Set((following ?? []).map((f: { favorite_user_id: string }) => f.favorite_user_id));
  const followersSet = new Set((followers ?? []).map((f: { user_id: string }) => f.user_id));
  for (const id of followingSet) {
    if (followersSet.has(id)) mutualIds.add(id);
  }

  const mutualFriendIds = [...mutualIds];
  const { data: mutualFriendProfiles } = mutualFriendIds.length
    ? await service
        .from(DB_TABLES.profiles)
        .select("user_id, name, avatar_url")
        .in("user_id", mutualFriendIds)
    : { data: [] };

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md bg-[var(--bg-app)] px-4 pb-32 pt-6">
      <PlayerStackHeader
        backHref="/comunidad"
        backLabel="Volver a Comunidad"
        title="Mensajes"
        subtitle="Chats directos y grupos"
      />
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
