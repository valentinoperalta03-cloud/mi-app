"use server";

import { revalidatePath } from "next/cache";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";
import { createClient } from "@/utils/supabase/server";

export type FriendRequestState = {
  ok: boolean;
  message: string;
  status: "none" | "pending_sent" | "pending_received" | "friends";
};

export async function sendFriendRequest(targetUserId: string): Promise<FriendRequestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Iniciá sesión.", status: "none" };
  }
  if (targetUserId === user.id) {
    return { ok: false, message: "No podés agregarte a vos mismo.", status: "none" };
  }

  const { data: existing } = await supabase
    .from(DB_TABLES.userFavorites)
    .select("id")
    .eq("user_id", user.id)
    .eq("favorite_user_id", targetUserId)
    .maybeSingle();

  if (existing) return { ok: false, message: "Ya son amigos.", status: "friends" };

  const { data: existingReq } = await supabase
    .from(DB_TABLES.friendRequests)
    .select("id, status, sender_id")
    .or(
      `and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`
    )
    .maybeSingle();

  if (existingReq) {
    const req = existingReq as { sender_id?: string | null } | null;
    if (req?.sender_id === user.id) {
      return { ok: false, message: "Ya existe una solicitud pendiente.", status: "pending_sent" };
    }
    return { ok: false, message: "Tenés una solicitud pendiente de esta persona.", status: "pending_received" };
  }

  const { error } = await supabase.from(DB_TABLES.friendRequests).insert({
    sender_id: user.id,
    receiver_id: targetUserId,
    status: "pending",
  });

  if (error) return { ok: false, message: error.message, status: "none" };

  const { data: senderProfile } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  const senderName = (senderProfile as { name?: string | null } | null)?.name ?? "Alguien";
  await createNotification(supabase, {
    user_id: targetUserId,
    type: "join_request",
    title: "Nueva solicitud de amistad",
    body: `${senderName} quiere agregarte como amigo.`,
    actor_id: user.id,
  });

  revalidatePath(`/jugador/${targetUserId}`);
  return { ok: true, message: "Solicitud enviada.", status: "pending_sent" };
}

export async function acceptFriendRequest(
  requestId: string,
  senderId: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "No autenticado." };

  await supabase
    .from(DB_TABLES.friendRequests)
    .update({ status: "accepted" })
    .eq("id", requestId)
    .eq("receiver_id", user.id);

  await supabase.from(DB_TABLES.userFavorites).insert([
    { user_id: user.id, favorite_user_id: senderId },
    { user_id: senderId, favorite_user_id: user.id },
  ]);

  const { data: receiverProfile } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  const receiverName = (receiverProfile as { name?: string | null } | null)?.name ?? "Alguien";
  await createNotification(supabase, {
    user_id: senderId,
    type: "join_approved",
    title: "¡Solicitud aceptada!",
    body: `${receiverName} aceptó tu solicitud de amistad.`,
  });

  revalidatePath("/comunidad/para-ti");
  revalidatePath("/comunidad");
  revalidatePath("/home");
  return { ok: true, message: "¡Ahora son amigos!" };
}

export async function rejectFriendRequest(requestId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "No autenticado." };

  await supabase
    .from(DB_TABLES.friendRequests)
    .update({ status: "rejected" })
    .eq("id", requestId)
    .eq("receiver_id", user.id);

  revalidatePath("/comunidad/para-ti");
  revalidatePath("/comunidad");
  return { ok: true, message: "Solicitud rechazada." };
}

export async function removeFriend(targetUserId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "No autenticado." };

  await supabase
    .from(DB_TABLES.userFavorites)
    .delete()
    .eq("user_id", user.id)
    .eq("favorite_user_id", targetUserId);

  await supabase
    .from(DB_TABLES.userFavorites)
    .delete()
    .eq("user_id", targetUserId)
    .eq("favorite_user_id", user.id);

  revalidatePath(`/jugador/${targetUserId}`);
  return { ok: true, message: "Amigo eliminado." };
}

export async function followUser(targetUserId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "No autenticado." };
  if (targetUserId === user.id) return { ok: false, message: "No podés seguirte a vos mismo." };

  const { error } = await supabase.from(DB_TABLES.userFavorites).insert({
    user_id: user.id,
    favorite_user_id: targetUserId,
  });

  if (error && error.code !== "23505") return { ok: false, message: error.message };

  const { data: senderProfile } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();
  const senderName = (senderProfile as { name?: string | null } | null)?.name ?? "Alguien";
  await createNotification(supabase, {
    user_id: targetUserId,
    type: "new_follower",
    title: "Nuevo seguidor",
    body: `${senderName} empezó a seguirte.`,
    actor_id: user.id,
  });

  const { data: reverseFollow } = await supabase
    .from(DB_TABLES.userFavorites)
    .select("id")
    .eq("user_id", targetUserId)
    .eq("favorite_user_id", user.id)
    .maybeSingle();

  if (reverseFollow) {
    await createNotification(supabase, {
      user_id: targetUserId,
      type: "now_friends",
      title: "¡Son amigos!",
      body: `${senderName} y vos se siguen mutuamente.`,
      actor_id: user.id,
    });

    const { data: targetProfile } = await supabase
      .from(DB_TABLES.profiles)
      .select("name")
      .eq("user_id", targetUserId)
      .maybeSingle();
    const targetName = (targetProfile as { name?: string | null } | null)?.name ?? "Esta persona";

    await createNotification(supabase, {
      user_id: user.id,
      type: "now_friends",
      title: "¡Son amigos!",
      body: `${targetName} y vos se siguen mutuamente.`,
    });
  }

  revalidatePath(`/jugador/${targetUserId}`);
  return { ok: true, message: "Ahora seguís a este jugador." };
}

export async function unfollowUser(targetUserId: string): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "No autenticado." };

  const { error } = await supabase
    .from(DB_TABLES.userFavorites)
    .delete()
    .eq("user_id", user.id)
    .eq("favorite_user_id", targetUserId);

  if (error) return { ok: false, message: error.message };
  revalidatePath(`/jugador/${targetUserId}`);
  return { ok: true, message: "Dejaste de seguir a este jugador." };
}

// Deprecated: kept for backward compatibility in existing call sites.
export async function setUserFavorite(favoriteUserId: string, shouldFavorite: boolean) {
  if (shouldFavorite) return followUser(favoriteUserId);
  return unfollowUser(favoriteUserId);
}
