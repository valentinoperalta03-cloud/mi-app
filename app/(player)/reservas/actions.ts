"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkCancellationLimit } from "@/lib/cancellation-guard";
import { DB_TABLES } from "@/lib/db-tables";
import { notifyClubOwner } from "@/lib/club-notify";
import { getPaymentRefundClient } from "@/lib/mercadopago";
import { createNotification, NOTIFICATION_TEMPLATES } from "@/lib/notifications";
import { createClient } from "@/utils/supabase/server";

function matchStartMs(scheduledDate: string, scheduledTime: string): number {
  const t = scheduledTime.trim().slice(0, 5);
  return new Date(`${scheduledDate}T${t}:00`).getTime();
}

async function isLocalDevHost(): Promise<boolean> {
  if (process.env.NODE_ENV !== "development") return false;
  const h = await headers();
  const host = (h.get("host") ?? "").toLowerCase();
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

async function notifyClubReservationReleased(
  supabase: SupabaseClient,
  courtId: string,
  scheduledDate: string,
  scheduledTime: string
) {
  const { data: court } = await supabase
    .from(DB_TABLES.courts)
    .select("club_id,name")
    .eq("id", courtId)
    .maybeSingle();
  const clubId = String((court as { club_id?: string | null } | null)?.club_id ?? "").trim();
  if (!clubId) return;
  const courtName = String((court as { name?: string | null } | null)?.name ?? "Cancha").trim() || "Cancha";
  const t = scheduledTime.trim().slice(0, 5);
  await notifyClubOwner(supabase, clubId, {
    title: "❌ Reserva cancelada",
    body: `${courtName} el ${scheduledDate} a las ${t} quedó libre.`,
  });
}

export async function confirmFixedSlotAttendance(formData: FormData) {
  const matchId = String(formData.get("match_id") ?? "").trim();
  if (!matchId) redirect("/reservas");

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: participation } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("attendance_status")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();
  if (!participation) redirect("/reservas");

  await supabase
    .from(DB_TABLES.matchParticipants)
    .update({ attendance_status: "confirmed" })
    .eq("match_id", matchId)
    .eq("player_id", user.id);

  revalidatePath("/reservas");
  redirect("/reservas");
}

export async function declineFixedSlotAttendance(formData: FormData) {
  const matchId = String(formData.get("match_id") ?? "").trim();
  if (!matchId) redirect("/reservas");

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: participation } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("attendance_status")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();
  if (!participation) redirect("/reservas");

  await supabase
    .from(DB_TABLES.matchParticipants)
    .update({ attendance_status: "declined" })
    .eq("match_id", matchId)
    .eq("player_id", user.id);

  const { data: matchRow } = await supabase
    .from(DB_TABLES.matches)
    .select("scheduled_date, scheduled_time, court_id")
    .eq("id", matchId)
    .maybeSingle();

  const typed = matchRow as {
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    court_id?: string | null;
  } | null;
  const scheduledDate = String(typed?.scheduled_date ?? "");
  const scheduledTime = String(typed?.scheduled_time ?? "").slice(0, 5);
  const courtId = String(typed?.court_id ?? "");

  await supabase.from(DB_TABLES.matches).update({ match_status: "cancelled" }).eq("id", matchId);

  const { data: profileRow } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();
  const playerName =
    String((profileRow as { name?: string | null } | null)?.name ?? "").trim() || "Un jugador";

  if (courtId) {
    const { data: courtRow } = await supabase
      .from(DB_TABLES.courts)
      .select("club_id, name")
      .eq("id", courtId)
      .maybeSingle();
    const clubId = String((courtRow as { club_id?: string | null } | null)?.club_id ?? "").trim();
    const courtName =
      String((courtRow as { name?: string | null } | null)?.name ?? "Cancha").trim() || "Cancha";
    if (clubId) {
      await notifyClubOwner(supabase, clubId, {
        title: "Turno fijo cancelado",
        body: `${playerName} no puede asistir el ${scheduledDate} a las ${scheduledTime} en ${courtName}. El turno quedó libre.`,
        match_id: matchId,
      });
    }
  }

  const { data: otherParticipants } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", matchId)
    .neq("player_id", user.id);

  for (const p of (otherParticipants ?? []) as Array<{ player_id: string }>) {
    await createNotification(supabase, {
      user_id: p.player_id,
      type: "reservation_cancelled",
      title: "Turno fijo cancelado",
      body: `${playerName} no puede asistir el ${scheduledDate} a las ${scheduledTime}. El turno fue cancelado.`,
      match_id: matchId,
    });
  }

  revalidatePath("/reservas");
  redirect("/reservas");
}

export async function simulatePaymentApproved(formData: FormData) {
  const matchId = String(formData.get("match_id") ?? "").trim();
  if (!matchId || !(await isLocalDevHost())) {
    redirect("/reservas/confirmacion?error=sim");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: match, error: mErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id, owner_id, total_price")
    .eq("id", matchId)
    .maybeSingle();

  if (mErr || !match || (match as { owner_id: string }).owner_id !== user.id) {
    redirect("/reservas/confirmacion?error=sim");
  }

  const total = Number((match as { total_price: number | null }).total_price ?? 0);
  const amount = total;

  const { data: payRow } = await supabase
    .from(DB_TABLES.payments)
    .select("id")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (payRow) {
    await supabase
      .from(DB_TABLES.payments)
      .update({
        status: "approved",
        mp_payment_id: "dev_simulated",
        updated_at: new Date().toISOString(),
      })
      .eq("match_id", matchId)
      .eq("user_id", user.id);
  } else {
    await supabase.from(DB_TABLES.payments).insert({
      match_id: matchId,
      user_id: user.id,
      status: "approved",
      mp_payment_id: "dev_simulated",
      amount,
      payment_method: "mercadopago",
    });
  }

  await supabase
    .from(DB_TABLES.matches)
    .update({
      payment_status: "paid",
      match_status: "reserved",
      amount_paid: total,
      amount_pending: 0,
      financial_status: "fully_paid",
    })
    .eq("id", matchId);
  const tplApproved = NOTIFICATION_TEMPLATES.payment_approved(String(Math.round(total)));
  await createNotification(supabase, {
    user_id: user.id,
    type: "payment_approved",
    title: tplApproved.title,
    body: tplApproved.body,
    match_id: matchId,
  });

  revalidatePath("/reservas");
  revalidatePath("/reservas/confirmacion");
  redirect(
    `/reservas/confirmacion?id=${encodeURIComponent(matchId)}&status=approved&collection_status=approved`
  );
}

export async function cancelReservation(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/reservas?error=cancel");
  }

  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: match, error: fetchErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id, owner_id, court_id, scheduled_date, scheduled_time, payment_status, total_price")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !match || (match as { owner_id: string }).owner_id !== user.id) {
    redirect("/reservas?error=cancel");
  }

  const cancellationGuard = await checkCancellationLimit(supabase, user.id);
  if (!cancellationGuard.allowed) {
    redirect(`/reservas?error=${encodeURIComponent(cancellationGuard.message)}`);
  }

  const totalPrice = Number((match as { total_price: number | null }).total_price ?? 0);
  const payStatus = String((match as { payment_status: string | null }).payment_status ?? "").toLowerCase();
  const scheduledDate = String((match as { scheduled_date: string | null }).scheduled_date ?? "");
  const scheduledTime = String((match as { scheduled_time: string | null }).scheduled_time ?? "");
  const courtId = String((match as { court_id?: string | null }).court_id ?? "");
  const { data: courtRow } = courtId
    ? await supabase.from(DB_TABLES.courts).select("name").eq("id", courtId).maybeSingle()
    : { data: null };
  const courtName = (courtRow as { name?: string | null } | null)?.name?.trim() || "Cancha";
  const { data: participantRows } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", id);
  const participantIds = ((participantRows ?? []) as Array<{ player_id: string }>).map((p) => p.player_id);

  if (payStatus === "paid" && scheduledDate && scheduledTime) {
    const { data: payment } = await supabase
      .from(DB_TABLES.payments)
      .select("mp_payment_id")
      .eq("match_id", id)
      .eq("status", "approved")
      .maybeSingle();

    const mpId = String((payment as { mp_payment_id: string | null } | null)?.mp_payment_id ?? "").trim();
    if (mpId) {
      const start = matchStartMs(scheduledDate, scheduledTime);
      const minutesUntil = (start - Date.now()) / 60_000;
      if (minutesUntil < 60) {
        const { error: cancelNoRefundErr } = await supabase
          .from(DB_TABLES.matches)
          .update({ match_status: "cancelled" })
          .eq("id", id);
        if (cancelNoRefundErr) {
          console.error("[cancelReservation]", cancelNoRefundErr);
          redirect("/reservas?error=cancel");
        }
        const tplNoRefund = NOTIFICATION_TEMPLATES.reservation_cancelled(courtName);
        for (const uid of participantIds.length ? participantIds : [user.id]) {
          await createNotification(supabase, {
            user_id: uid,
            type: "reservation_cancelled",
            title: tplNoRefund.title,
            body: tplNoRefund.body,
            match_id: id,
          });
        }
        if (courtId) {
          await notifyClubReservationReleased(supabase, courtId, scheduledDate, scheduledTime);
        }
        revalidatePath("/reservas");
        redirect("/reservas?info=sin_reembolso");
      }
      if (mpId !== "dev_simulated") {
        try {
          await getPaymentRefundClient().total({ payment_id: mpId });
        } catch (e) {
          console.error("[mp] refund", e);
          redirect("/reservas?error=mp_reembolso");
        }
      }
      await supabase
        .from(DB_TABLES.payments)
        .update({ status: "refunded", updated_at: new Date().toISOString() })
        .eq("match_id", id)
        .eq("user_id", user.id);
      const { error: cancelRefundErr } = await supabase
        .from(DB_TABLES.matches)
        .update({
          match_status: "cancelled",
          payment_status: "refunded",
          financial_status: "unpaid",
          amount_paid: 0,
          amount_pending: totalPrice,
        })
        .eq("id", id);
      if (cancelRefundErr) {
        console.error("[cancelReservation]", cancelRefundErr);
        redirect("/reservas?error=cancel");
      }
      const tplRefund = NOTIFICATION_TEMPLATES.reservation_cancelled(courtName);
      for (const uid of participantIds.length ? participantIds : [user.id]) {
        await createNotification(supabase, {
          user_id: uid,
          type: "reservation_cancelled",
          title: tplRefund.title,
          body: tplRefund.body,
          match_id: id,
        });
      }
      if (courtId) {
        await notifyClubReservationReleased(supabase, courtId, scheduledDate, scheduledTime);
      }
      revalidatePath("/reservas");
      redirect("/reservas");
    }
  }

  await supabase
    .from(DB_TABLES.payments)
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("match_id", id)
    .eq("user_id", user.id)
    .eq("status", "pending");

  const { error } = await supabase
    .from(DB_TABLES.matches)
    .update({ match_status: "cancelled", payment_status: "cancelled" })
    .eq("id", id);

  if (error) {
    console.error("[cancelReservation]", error);
    redirect("/reservas?error=cancel");
  }

  const tpl = NOTIFICATION_TEMPLATES.reservation_cancelled(courtName);
  for (const uid of participantIds.length ? participantIds : [user.id]) {
    await createNotification(supabase, {
      user_id: uid,
      type: "reservation_cancelled",
      title: tpl.title,
      body: tpl.body,
      match_id: id,
    });
  }

  if (courtId) {
    await notifyClubReservationReleased(supabase, courtId, scheduledDate, scheduledTime);
  }

  revalidatePath("/reservas");
  redirect("/reservas");
}
