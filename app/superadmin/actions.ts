"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createNotification } from "@/lib/notifications";
import { SUPERADMIN_COOKIE, SUPERADMIN_PIN } from "@/lib/superadmin/constants";
import { requireSuperadminAction, requireSuperadminUser } from "@/lib/superadmin/guards";
import { signSuperadminSession } from "@/lib/superadmin/session-cookie";
import { createServiceClient } from "@/utils/supabase/server";

export async function unlockSuperadminPinAction(formData: FormData) {
  const pin = String(formData.get("pin") ?? "").trim();
  const user = await requireSuperadminUser();
  if (pin !== SUPERADMIN_PIN) {
    redirect("/superadmin/pin?error=1");
  }
  const jar = await cookies();
  jar.set(SUPERADMIN_COOKIE, signSuperadminSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
  redirect("/superadmin");
}

async function svc() {
  return (await requireSuperadminAction()).svc;
}

export async function toggleClubActiveAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  const next = String(formData.get("next_active") ?? "").trim();
  const returnTo = String(formData.get("return_to") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");
  const active = next === "1";
  const s = await svc();
  await s.from(DB_TABLES.clubs).update({ is_active: active }).eq("id", clubId);
  revalidatePath("/superadmin/clubes");
  revalidatePath(`/superadmin/clubes/${clubId}`);
  if (returnTo.startsWith("/superadmin/")) {
    redirect(returnTo);
  }
  redirect("/superadmin/clubes");
}

export async function markClubDebtsPaidAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");
  const s = await svc();
  const returnTo = String(formData.get("return_to") ?? "").trim();
  const now = new Date().toISOString();
  await s.from(DB_TABLES.clubDebts).update({ status: "paid", paid_at: now }).eq("club_id", clubId).eq("status", "pending");
  revalidatePath("/superadmin/clubes");
  revalidatePath(`/superadmin/clubes/${clubId}`);
  revalidatePath("/superadmin/finanzas");
  if (returnTo.startsWith("/superadmin/")) {
    redirect(returnTo);
  }
  redirect(`/superadmin/clubes/${clubId}`);
}

export async function notifyClubOwnerAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  const title = String(formData.get("title") ?? "Mensaje de PadeLibre").trim() || "Mensaje de PadeLibre";
  const body = String(formData.get("body") ?? "").trim() || "Tenés novedades en tu club.";
  if (!clubId) redirect("/superadmin/clubes");
  const s = await svc();
  const { data: row } = await s.from(DB_TABLES.clubs).select("owner_id").eq("id", clubId).maybeSingle();
  const ownerId = String((row as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
  if (ownerId) {
    try {
      await createNotification(s, {
        user_id: ownerId,
        type: "club_agenda",
        title,
        body,
      });
    } catch {
      /* notifications table puede no existir en algunos entornos */
    }
  }
  revalidatePath(`/superadmin/clubes/${clubId}`);
  redirect(`/superadmin/clubes/${clubId}?notif=1`);
}

export async function toggleUserGlobalBlockAction(formData: FormData) {
  const userId = String(formData.get("user_id") ?? "").trim();
  const next = String(formData.get("next_blocked") ?? "").trim();
  if (!userId) redirect("/superadmin/usuarios");
  const blocked = next === "1";
  const s = await svc();
  await s.from(DB_TABLES.profiles).update({ is_globally_blocked: blocked }).eq("user_id", userId);
  revalidatePath("/superadmin/usuarios");
  redirect("/superadmin/usuarios");
}

export async function createClubAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const ownerEmail = String(formData.get("owner_email") ?? "").trim().toLowerCase();
  const description = String(formData.get("description") ?? "").trim() || null;
  const isActive = formData.get("is_active") === "1";

  if (!name || !location || !ownerEmail) {
    redirect("/superadmin/clubes?error=datos");
  }

  const s = await svc();
  const { data: ownerLookup, error: ownerErr } = await s.auth.admin.listUsers({ perPage: 1000 });
  if (ownerErr) redirect("/superadmin/clubes?error=owner");

  const owner = (ownerLookup?.users ?? []).find(
    (u) => String(u.email ?? "").toLowerCase() === ownerEmail
  );
  if (!owner?.id) {
    redirect(`/superadmin/clubes?error=owner&email=${encodeURIComponent(ownerEmail)}`);
  }
  const ownerId = owner.id;

  const { data: created, error } = await s
    .from(DB_TABLES.clubs)
    .insert({
      name,
      location,
      description,
      owner_id: ownerId,
      is_active: isActive,
      onboarding_completed: false,
    })
    .select("id")
    .single();

  if (error || !created) {
    redirect("/superadmin/clubes?error=create");
  }

  const clubId = String((created as { id: string }).id);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clubes");
  redirect(`/superadmin/clubes/${clubId}?created=1`);
}

export async function deleteClubAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  const returnTo = String(formData.get("return_to") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");

  const s = await svc();
  const { error } = await s.rpc("superadmin_delete_club", { p_club_id: clubId });

  if (error) {
    console.error("[superadmin] deleteClub", error.message);
    if (returnTo.startsWith("/superadmin/clubes/")) {
      redirect(`${returnTo}?delete_error=1`);
    }
    redirect("/superadmin/clubes?delete_error=1");
  }

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clubes");
  revalidatePath("/superadmin/finanzas");
  redirect("/superadmin/clubes?deleted=1");
}

export async function sendDebtReminderAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  if (!clubId) redirect("/superadmin/finanzas");
  const s = await svc();
  const { data: row } = await s.from(DB_TABLES.clubs).select("owner_id,name").eq("id", clubId).maybeSingle();
  const ownerId = String((row as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
  const name = String((row as { name?: string | null } | null)?.name ?? "Club").trim();
  if (ownerId) {
    try {
      await createNotification(s, {
        user_id: ownerId,
        type: "club_agenda",
        title: "Recordatorio de deuda PadeLibre",
        body: `Hola ${name}: tenés deuda pendiente con PadeLibre por comisiones de reservas en efectivo/transferencia. Revisá Finanzas en tu panel.`,
      });
    } catch {
      /* */
    }
  }
  revalidatePath("/superadmin/finanzas");
  redirect("/superadmin/finanzas?reminder=1");
}
