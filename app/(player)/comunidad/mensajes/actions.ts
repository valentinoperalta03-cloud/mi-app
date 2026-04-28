"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { addMemberToGroup, createGroupChat, sendGroupMessage } from "@/lib/group-chats";
import { canOpenChatWithPeer } from "@/lib/chat-partners";
import { createClient } from "@/utils/supabase/server";

export type SendMessageState = { ok: boolean; message: string; row?: ChatMessageRow };

export type ChatMessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

export type GroupChatMessageRow = {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export async function sendChatMessage(
  peerId: string,
  content: string
): Promise<SendMessageState> {
  const text = content.trim();
  if (!text) {
    return { ok: false, message: "El mensaje está vacío." };
  }
  if (text.length > 2000) {
    return { ok: false, message: "El mensaje es demasiado largo." };
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Iniciá sesión." };
  }

  const allowed = await canOpenChatWithPeer(supabase, user.id, peerId);
  if (!allowed) {
    return { ok: false, message: "No podés iniciar chat con este usuario." };
  }

  const { data, error } = await supabase
    .from(DB_TABLES.messages)
    .insert({
      sender_id: user.id,
      receiver_id: peerId,
      content: text,
    })
    .select("id, sender_id, receiver_id, content, created_at")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "No se pudo enviar." };
  }

  const row = data as ChatMessageRow;
  revalidatePath("/comunidad/mensajes");
  revalidatePath(`/comunidad/mensajes/${peerId}`);
  return { ok: true, message: "", row };
}

export async function createGroupChatAction(params: {
  title: string;
  description: string;
  memberIds: string[];
}): Promise<{ ok: boolean; message: string; groupId?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };

  const res = await createGroupChat(
    supabase,
    user.id,
    params.title,
    params.description,
    params.memberIds
  );
  if (!res.ok) return { ok: false, message: res.message ?? "No se pudo crear el grupo." };

  revalidatePath("/comunidad/mensajes");
  return { ok: true, message: "Grupo creado", groupId: res.groupId };
}

export async function sendGroupChatMessageAction(
  groupId: string,
  content: string
): Promise<{ ok: boolean; message: string; row?: GroupChatMessageRow }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Iniciá sesión." };

  const res = await sendGroupMessage(supabase, groupId, user.id, content);
  if (!res.ok || !res.row) return { ok: false, message: res.message ?? "No se pudo enviar." };
  revalidatePath(`/comunidad/mensajes/grupo/${groupId}`);
  revalidatePath("/comunidad/mensajes");
  return { ok: true, message: "", row: res.row as GroupChatMessageRow };
}

export async function addGroupMemberAction(
  groupId: string,
  memberId: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const res = await addMemberToGroup(supabase, groupId, memberId);
  if (!res.ok) return { ok: false, message: res.message ?? "No se pudo agregar." };
  revalidatePath(`/comunidad/mensajes/grupo/${groupId}`);
  return { ok: true, message: "Miembro agregado." };
}
