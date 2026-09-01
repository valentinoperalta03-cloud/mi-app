"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { SUPERADMIN_COOKIE, SUPERADMIN_PIN } from "@/lib/superadmin/constants";
import { requireSuperadminAction, requireSuperadminUser } from "@/lib/superadmin/guards";
import { signSuperadminSession } from "@/lib/superadmin/session-cookie";

export async function unlockSuperadminPinAction(formData: FormData) {
  const pin = String(formData.get("pin") ?? "").trim();
  const user = await requireSuperadminUser();
  if (!SUPERADMIN_PIN || pin !== SUPERADMIN_PIN) {
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
  // Baja/alta manual del superadmin: siempre marca deactivation_reason='manual'
  // para que un pago de MP no la revierta solo (ver subscription-webhook-handler.ts).
  const { error } = await s
    .from(DB_TABLES.clubs)
    .update({ is_active: active, deactivation_reason: active ? null : "manual" })
    .eq("id", clubId);
  revalidatePath("/superadmin/clubes");
  revalidatePath(`/superadmin/clubes/${clubId}`);
  const base = returnTo.startsWith("/superadmin/") ? returnTo : "/superadmin/clubes";
  if (error) {
    log.error({ event: "superadmin.toggle_club_active.failed", clubId, err: error });
    redirect(`${base}${base.includes("?") ? "&" : "?"}active_error=1`);
  }
  redirect(base);
}

export async function deactivateClubAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");
  const s = await svc();
  const { error } = await s
    .from(DB_TABLES.clubs)
    .update({ is_active: false, deactivation_reason: "manual" })
    .eq("id", clubId);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clubes");
  revalidatePath(`/superadmin/clubes/${clubId}`);
  if (error) {
    log.error({ event: "superadmin.deactivate_club.failed", clubId, err: error });
    redirect(`/superadmin/clubes/${clubId}?active_error=1`);
  }
  redirect(`/superadmin/clubes/${clubId}?active=0`);
}

export async function reactivateClubAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");
  const s = await svc();
  const { error } = await s
    .from(DB_TABLES.clubs)
    .update({ is_active: true, deactivation_reason: null })
    .eq("id", clubId);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clubes");
  revalidatePath(`/superadmin/clubes/${clubId}`);
  if (error) {
    log.error({ event: "superadmin.reactivate_club.failed", clubId, err: error });
    redirect(`/superadmin/clubes/${clubId}?active_error=1`);
  }
  redirect(`/superadmin/clubes/${clubId}?active=1`);
}

/**
 * Acciones de suscripcion disparadas por el superadmin (a diferencia del
 * cron/webhook) son decisiones humanas explicitas: siempre pueden restaurar
 * la operacion del club (is_active=true), incluso si estaba inactivo por
 * causa comercial. Una baja MANUAL previa (deactivation_reason='manual') se
 * respeta: estas acciones tocan solo el estado comercial, no is_active.
 */
async function restoreOperationIfSubscriptionCaused(
  s: Awaited<ReturnType<typeof svc>>,
  clubId: string
): Promise<Record<string, unknown>> {
  const { data: row } = await s
    .from(DB_TABLES.clubs)
    .select("deactivation_reason")
    .eq("id", clubId)
    .maybeSingle();
  const reason = (row as { deactivation_reason?: string | null } | null)?.deactivation_reason;
  if (reason === "manual") return {};
  return { is_active: true, deactivation_reason: null };
}

export async function activateClubSubscriptionAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");
  const s = await svc();
  const nextBilling = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const restore = await restoreOperationIfSubscriptionCaused(s, clubId);
  const { error } = await s
    .from(DB_TABLES.clubs)
    .update({ subscription_status: "active", next_billing_date: nextBilling, ...restore })
    .eq("id", clubId);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clubes");
  revalidatePath(`/superadmin/clubes/${clubId}`);
  revalidatePath("/superadmin/finanzas");
  if (error) {
    log.error({ event: "superadmin.activate_subscription.failed", clubId, err: error });
    redirect(`/superadmin/clubes/${clubId}?sub_error=db`);
  }
  redirect(`/superadmin/clubes/${clubId}?sub=activated`);
}

export async function activateClubTrialAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");
  const s = await svc();
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 15 * 24 * 3600 * 1000).toISOString();
  const restore = await restoreOperationIfSubscriptionCaused(s, clubId);
  const { error } = await s
    .from(DB_TABLES.clubs)
    .update({
      subscription_status: "trial",
      trial_start_date: now.toISOString(),
      trial_end_date: trialEnd,
      next_billing_date: null,
      ...restore,
    })
    .eq("id", clubId);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clubes");
  revalidatePath(`/superadmin/clubes/${clubId}`);
  revalidatePath("/superadmin/finanzas");
  if (error) {
    log.error({ event: "superadmin.activate_trial.failed", clubId, err: error });
    redirect(`/superadmin/clubes/${clubId}?sub_error=db`);
  }
  redirect(`/superadmin/clubes/${clubId}?sub=trial_activated`);
}

export async function extendClubTrialAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  const days = Number.parseInt(String(formData.get("days") ?? "").trim(), 10);
  if (!clubId) redirect("/superadmin/clubes");
  if (!Number.isFinite(days) || days <= 0) {
    redirect(`/superadmin/clubes/${clubId}?sub_error=dias`);
  }
  const s = await svc();
  const { data: row } = await s
    .from(DB_TABLES.clubs)
    .select("trial_end_date, subscription_status, deactivation_reason")
    .eq("id", clubId)
    .maybeSingle();
  const current = row as {
    trial_end_date?: string | null;
    subscription_status?: string | null;
    deactivation_reason?: string | null;
  } | null;
  // Extender un trial vencido debe partir de "ahora", no de la fecha vieja
  // (si no, sumarle dias a un trial vencido hace tiempo puede seguir dando
  // una fecha en el pasado).
  const base = Math.max(Date.now(), current?.trial_end_date ? new Date(current.trial_end_date).getTime() : 0);
  const nextEnd = new Date(base + days * 24 * 3600 * 1000).toISOString();
  const wasExpired = current?.subscription_status === "trial_expired";
  const restore = wasExpired && current?.deactivation_reason !== "manual" ? { is_active: true, deactivation_reason: null } : {};
  const { error } = await s
    .from(DB_TABLES.clubs)
    .update({
      trial_end_date: nextEnd,
      // Extender un trial vencido lo revive: no puede quedar trial_expired
      // con una fecha de vencimiento futura (estado imposible).
      ...(wasExpired ? { subscription_status: "trial" } : {}),
      ...restore,
    })
    .eq("id", clubId);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clubes");
  revalidatePath(`/superadmin/clubes/${clubId}`);
  if (error) {
    log.error({ event: "superadmin.extend_trial.failed", clubId, err: error });
    redirect(`/superadmin/clubes/${clubId}?sub_error=db`);
  }
  redirect(`/superadmin/clubes/${clubId}?sub=extended`);
}

export async function markClubPastDueAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");
  const s = await svc();
  const { error } = await s.from(DB_TABLES.clubs).update({ subscription_status: "past_due" }).eq("id", clubId);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clubes");
  revalidatePath(`/superadmin/clubes/${clubId}`);
  revalidatePath("/superadmin/finanzas");
  if (error) {
    log.error({ event: "superadmin.mark_past_due.failed", clubId, err: error });
    redirect(`/superadmin/clubes/${clubId}?sub_error=db`);
  }
  redirect(`/superadmin/clubes/${clubId}?sub=past_due`);
}

export async function pauseClubSubscriptionAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");
  const s = await svc();
  const { error } = await s.from(DB_TABLES.clubs).update({ subscription_status: "paused" }).eq("id", clubId);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clubes");
  revalidatePath(`/superadmin/clubes/${clubId}`);
  revalidatePath("/superadmin/finanzas");
  if (error) {
    log.error({ event: "superadmin.pause_subscription.failed", clubId, err: error });
    redirect(`/superadmin/clubes/${clubId}?sub_error=db`);
  }
  redirect(`/superadmin/clubes/${clubId}?sub=paused`);
}

export async function resetClubToPendingAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");
  const s = await svc();
  const restore = await restoreOperationIfSubscriptionCaused(s, clubId);
  const { error } = await s
    .from(DB_TABLES.clubs)
    .update({
      subscription_status: "pending",
      mp_subscription_id: null,
      next_billing_date: null,
      last_webhook_request_id: null,
      ...restore,
    })
    .eq("id", clubId);
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/clubes");
  revalidatePath(`/superadmin/clubes/${clubId}`);
  revalidatePath("/superadmin/finanzas");
  if (error) {
    log.error({ event: "superadmin.reset_pending.failed", clubId, err: error });
    redirect(`/superadmin/clubes/${clubId}?sub_error=db`);
  }
  redirect(`/superadmin/clubes/${clubId}?sub=reset`);
}

export async function notifyClubOwnerAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");
  if (!message) redirect(`/superadmin/clubes/${clubId}?notif_error=1`);
  const s = await svc();
  const { data: row } = await s.from(DB_TABLES.clubs).select("owner_id").eq("id", clubId).maybeSingle();
  const ownerId = String((row as { owner_id?: string | null } | null)?.owner_id ?? "").trim();
  if (ownerId) {
    try {
      await createNotification(s, {
        user_id: ownerId,
        type: "club_agenda",
        title: "Mensaje de PadeLibre",
        body: message,
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

const AVAILABILITY_WEEKDAYS = [1, 2, 3, 4, 5] as const;

export async function saveAvailabilityAction(formData: FormData) {
  const s = await svc();

  for (const day of AVAILABILITY_WEEKDAYS) {
    await s.from(DB_TABLES.meetingAvailability).delete().eq("day_of_week", day);

    const enabled = formData.get(`enabled_${day}`) === "on";
    if (!enabled) continue;

    const startTime = String(formData.get(`start_${day}`) ?? "").trim();
    const endTime = String(formData.get(`end_${day}`) ?? "").trim();
    const duration = Number.parseInt(String(formData.get(`duration_${day}`) ?? "").trim(), 10);
    if (!startTime || !endTime || !Number.isFinite(duration) || duration <= 0) continue;

    await s.from(DB_TABLES.meetingAvailability).insert({
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      slot_duration_minutes: duration,
      is_active: true,
    });
  }

  revalidatePath("/superadmin/reuniones");
  redirect("/superadmin/reuniones?availability=saved");
}

export async function deleteClubAction(formData: FormData) {
  const clubId = String(formData.get("club_id") ?? "").trim();
  const returnTo = String(formData.get("return_to") ?? "").trim();
  if (!clubId) redirect("/superadmin/clubes");

  const s = await svc();
  const target = returnTo.startsWith("/superadmin/clubes/") ? returnTo : `/superadmin/clubes/${clubId}`;

  const { data: courts } = await s.from(DB_TABLES.courts).select("id").eq("club_id", clubId);
  const courtIds = (courts ?? []).map((row) => (row as { id: string }).id);
  if (courtIds.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await s
      .from(DB_TABLES.matches)
      .select("id", { count: "exact", head: true })
      .eq("match_type", "reservation")
      .neq("match_status", "cancelled")
      .gte("scheduled_date", today)
      .in("court_id", courtIds);
    if ((count ?? 0) > 0) {
      redirect(`${target}?delete_error=reservas`);
    }
  }

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
