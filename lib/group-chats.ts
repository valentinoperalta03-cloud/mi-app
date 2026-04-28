import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

export type GroupPreview = {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  lastMessage: string;
  lastAt: string;
  membersCount: number;
};

export type GroupMessageRow = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: { name: string | null; avatar_url: string | null } | null;
};

export async function fetchGroupPreviews(
  supabase: SupabaseClient,
  userId: string
): Promise<GroupPreview[]> {
  const { data: memberRows } = await supabase
    .from(DB_TABLES.groupChatMembers)
    .select("group_id")
    .eq("user_id", userId);

  const groupIds = [...new Set((memberRows ?? []).map((r: { group_id: string }) => r.group_id))];
  if (groupIds.length === 0) return [];

  const [{ data: groups }, { data: messages }, { data: countRows }] = await Promise.all([
    supabase
      .from(DB_TABLES.groupChats)
      .select("id, title, description, created_by, created_at")
      .in("id", groupIds),
    supabase
      .from(DB_TABLES.groupChatMessages)
      .select("group_id, content, created_at")
      .in("group_id", groupIds)
      .order("created_at", { ascending: false }),
    supabase
      .from(DB_TABLES.groupChatMembers)
      .select("group_id")
      .in("group_id", groupIds),
  ]);

  const lastByGroup = new Map<string, { content: string; created_at: string }>();
  for (const row of (messages ?? []) as Array<{ group_id: string; content: string; created_at: string }>) {
    if (!lastByGroup.has(row.group_id)) {
      lastByGroup.set(row.group_id, { content: row.content, created_at: row.created_at });
    }
  }

  const counts = new Map<string, number>();
  for (const row of (countRows ?? []) as Array<{ group_id: string }>) {
    counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
  }

  const list = ((groups ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    created_by: string;
    created_at: string;
  }>).map((g) => {
    const last = lastByGroup.get(g.id);
    return {
      id: g.id,
      title: g.title,
      description: g.description ?? null,
      created_by: g.created_by,
      lastMessage: last?.content ?? "Grupo creado",
      lastAt: last?.created_at ?? g.created_at,
      membersCount: counts.get(g.id) ?? 1,
    } satisfies GroupPreview;
  });

  list.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  return list;
}

export async function createGroupChat(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  description: string,
  memberIds: string[],
  matchId?: string | null
): Promise<{ ok: boolean; groupId?: string; message?: string }> {
  const cleanTitle = title.trim();
  if (!cleanTitle) return { ok: false, message: "El título es obligatorio." };

  const uniqueMembers = [...new Set(memberIds.filter((id) => id && id !== userId))];
  const { data: group, error: gErr } = await supabase
    .from(DB_TABLES.groupChats)
    .insert({
      title: cleanTitle,
      description: description.trim() || null,
      created_by: userId,
      match_id: matchId ?? null,
    })
    .select("id")
    .single();

  if (gErr || !group) return { ok: false, message: gErr?.message ?? "No se pudo crear el grupo." };

  const rows = [
    { group_id: group.id, user_id: userId, role: "admin" },
    ...uniqueMembers.map((id) => ({ group_id: group.id, user_id: id, role: "member" })),
  ];
  const { error: mErr } = await supabase.from(DB_TABLES.groupChatMembers).insert(rows);
  if (mErr) return { ok: false, message: mErr.message };

  return { ok: true, groupId: group.id };
}

export async function addMemberToGroup(
  supabase: SupabaseClient,
  groupId: string,
  userId: string
): Promise<{ ok: boolean; message?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };

  const { data: group } = await supabase
    .from(DB_TABLES.groupChats)
    .select("created_by")
    .eq("id", groupId)
    .maybeSingle();

  if (!group || (group as { created_by?: string }).created_by !== user.id) {
    return { ok: false, message: "Solo el admin puede agregar miembros." };
  }

  const { error } = await supabase
    .from(DB_TABLES.groupChatMembers)
    .insert({ group_id: groupId, user_id: userId, role: "member" });
  if (error && error.code !== "23505") return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchGroupMessages(
  supabase: SupabaseClient,
  groupId: string
): Promise<GroupMessageRow[]> {
  const { data: messages } = await supabase
    .from(DB_TABLES.groupChatMessages)
    .select("id, group_id, sender_id, content, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  const typed = (messages ?? []) as GroupMessageRow[];
  const senderIds = [...new Set(typed.map((m) => m.sender_id))];
  if (senderIds.length === 0) return typed;

  const { data: profiles } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url")
    .in("user_id", senderIds);
  const profileMap = new Map(
    (profiles ?? []).map((p: { user_id: string; name: string | null; avatar_url: string | null }) => [
      p.user_id,
      { name: p.name, avatar_url: p.avatar_url },
    ])
  );

  return typed.map((m) => ({ ...m, profiles: profileMap.get(m.sender_id) ?? null }));
}

export async function sendGroupMessage(
  supabase: SupabaseClient,
  groupId: string,
  senderId: string,
  content: string
): Promise<{ ok: boolean; row?: GroupMessageRow; message?: string }> {
  const text = content.trim();
  if (!text) return { ok: false, message: "Mensaje vacío." };

  const { data: membership } = await supabase
    .from(DB_TABLES.groupChatMembers)
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", senderId)
    .maybeSingle();
  if (!membership) return { ok: false, message: "No pertenecés a este grupo." };

  const { data, error } = await supabase
    .from(DB_TABLES.groupChatMessages)
    .insert({ group_id: groupId, sender_id: senderId, content: text })
    .select("id, group_id, sender_id, content, created_at")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "No se pudo enviar." };
  return { ok: true, row: data as GroupMessageRow };
}
