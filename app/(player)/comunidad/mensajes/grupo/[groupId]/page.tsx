import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { fetchGroupMessages } from "@/lib/group-chats";
import { createClient, getAdminClient } from "@/utils/supabase/server";
import { GroupChatClient } from "./group-chat-client";

type PageProps = { params: Promise<{ groupId: string }> };

export default async function GroupChatPage({ params }: PageProps) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const service = await getAdminClient();

  const [{ data: group }, { data: memberRow }] = await Promise.all([
    service
      .from(DB_TABLES.groupChats)
      .select("id, title, description, created_by")
      .eq("id", groupId)
      .maybeSingle(),
    service
      .from(DB_TABLES.groupChatMembers)
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!group || !memberRow) redirect("/comunidad/mensajes");
  const typedGroup = group as { id: string; title: string; description: string | null; created_by: string };
  const isAdmin = typedGroup.created_by === user.id;

  const [messages, members] = await Promise.all([
    fetchGroupMessages(service, groupId),
    service
      .from(DB_TABLES.groupChatMembers)
      .select("user_id")
      .eq("group_id", groupId),
  ]);
  const memberIds = ((members.data ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);

  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  const { data: profilesData } = senderIds.length
    ? await service
        .from(DB_TABLES.profiles)
        .select("user_id, name, avatar_url")
        .in("user_id", senderIds)
    : { data: [] };

  const [{ data: iFollow }, { data: followsMe }] = await Promise.all([
    service.from(DB_TABLES.userFavorites).select("favorite_user_id").eq("user_id", user.id),
    service.from(DB_TABLES.userFavorites).select("user_id").eq("favorite_user_id", user.id),
  ]);
  const iFollowSet = new Set((iFollow ?? []).map((r: { favorite_user_id: string }) => r.favorite_user_id));
  const followsMeSet = new Set((followsMe ?? []).map((r: { user_id: string }) => r.user_id));
  const mutualIds = [...iFollowSet].filter((id) => followsMeSet.has(id) && !memberIds.includes(id));
  const { data: candidateProfiles } = mutualIds.length
    ? await service
        .from(DB_TABLES.profiles)
        .select("user_id, name, avatar_url")
        .in("user_id", mutualIds)
    : { data: [] };

  return (
    <GroupChatClient
      groupId={groupId}
      title={typedGroup.title}
      description={typedGroup.description}
      myId={user.id}
      isAdmin={isAdmin}
      initialMessages={messages}
      profiles={
        (profilesData ?? []) as Array<{ user_id: string; name: string | null; avatar_url: string | null }>
      }
      addCandidates={
        (candidateProfiles ?? []) as Array<{ user_id: string; name: string | null; avatar_url: string | null }>
      }
    />
  );
}
