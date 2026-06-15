import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";

export type ConversationPreview = {
  peerId: string;
  name: string;
  avatar_url: string | null;
  lastPreview: string;
  lastAt: string;
};

/**
 * Lista para la pantalla de mensajes: favoritos + interlocutores con historial,
 * ordenados por último mensaje (más reciente primero).
 */
export async function fetchConversationPreviews(
  supabase: SupabaseClient,
  userId: string
): Promise<ConversationPreview[]> {
  const [{ data: favs }, { data: msgs }] = await Promise.all([
    supabase
      .from(DB_TABLES.userFavorites)
      .select("favorite_user_id")
      .eq("user_id", userId),
    supabase
      .from(DB_TABLES.messages)
      .select("sender_id, receiver_id, content, created_at")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const favoriteIds = new Set(
    (favs ?? []).map((f: { favorite_user_id: string }) => f.favorite_user_id)
  );

  const lastByPeer = new Map<
    string,
    { preview: string; at: string }
  >();

  for (const m of msgs ?? []) {
    const row = m as {
      sender_id: string;
      receiver_id: string;
      content: string;
      created_at: string;
    };
    const peer =
      row.sender_id === userId ? row.receiver_id : row.sender_id;
    if (!lastByPeer.has(peer)) {
      lastByPeer.set(peer, {
        preview: row.content.slice(0, 120),
        at: row.created_at,
      });
    }
  }

  const peerIds = new Set<string>([...favoriteIds, ...lastByPeer.keys()]);
  peerIds.delete(userId);

  if (peerIds.size === 0) return [];

  const { data: profiles } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url")
    .in("user_id", [...peerIds]);

  const profileMap = new Map(
    (profiles ?? []).map((p: { user_id: string; name: string | null; avatar_url: string | null }) => [
      p.user_id,
      p,
    ])
  );

  const list: ConversationPreview[] = [...peerIds].map((peerId) => {
    const prof = profileMap.get(peerId);
    const last = lastByPeer.get(peerId);
    return {
      peerId,
      name: prof?.name?.trim() || "Jugador",
      avatar_url: prof?.avatar_url ?? null,
      lastPreview: last?.preview ?? (favoriteIds.has(peerId) ? "En tus favoritos" : ""),
      lastAt: last?.at ?? new Date(0).toISOString(),
    };
  });

  list.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

  return list;
}

export async function fetchThreadMessages(
  supabase: SupabaseClient,
  userId: string,
  peerId: string,
  limit = 50,
  before?: string
) {
  type Row = {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
  };

  let query = supabase
    .from(DB_TABLES.messages)
    .select("id, sender_id, receiver_id, content, created_at")
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${userId})`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data } = await query;
  return ((data ?? []) as Row[]).reverse();
}

export async function canOpenChatWithPeer(
  supabase: SupabaseClient,
  userId: string,
  peerId: string
): Promise<boolean> {
  if (!peerId || userId === peerId) return false;

  const [{ data: block1 }, { data: block2 }] = await Promise.all([
    supabase
      .from(DB_TABLES.blockedUsers)
      .select("user_id")
      .eq("user_id", userId)
      .eq("blocked_user_id", peerId)
      .maybeSingle(),
    supabase
      .from(DB_TABLES.blockedUsers)
      .select("user_id")
      .eq("user_id", peerId)
      .eq("blocked_user_id", userId)
      .maybeSingle(),
  ]);
  if (block1 || block2) return false;

  // Favorito O jugaron juntos → permitir chat
  const [{ data: fav }, { data: peerMatches }] = await Promise.all([
    supabase
      .from(DB_TABLES.userFavorites)
      .select("user_id")
      .eq("user_id", userId)
      .eq("favorite_user_id", peerId)
      .maybeSingle(),
    supabase
      .from(DB_TABLES.matchParticipants)
      .select("match_id")
      .eq("user_id", peerId)
      .limit(100),
  ]);

  if (fav) return true;

  const peerMatchIds = (peerMatches ?? [])
    .map((r: { match_id: string }) => r.match_id)
    .filter(Boolean);

  if (peerMatchIds.length === 0) return false;

  const { data: sharedMatch } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("user_id", userId)
    .in("match_id", peerMatchIds)
    .limit(1)
    .maybeSingle();

  return Boolean(sharedMatch);
}
