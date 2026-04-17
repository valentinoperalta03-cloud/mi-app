"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { getPaymentRefundClient } from "@/lib/mercadopago";
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
  const feeRate = Number.parseFloat(process.env.MP_MARKETPLACE_FEE ?? "0.05");
  const safeRate = Number.isFinite(feeRate) && feeRate >= 0 ? feeRate : 0.05;
  const marketplaceFee = Math.round(total * safeRate * 100) / 100;
  const amount = Math.round((total + marketplaceFee) * 100) / 100;

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
      marketplace_fee: marketplaceFee,
    });
  }

  await supabase.from(DB_TABLES.matches).update({ payment_status: "paid" }).eq("id", matchId);

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
    .select("id, owner_id, scheduled_date, scheduled_time, payment_status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !match || (match as { owner_id: string }).owner_id !== user.id) {
    redirect("/reservas?error=cancel");
  }

  const payStatus = String((match as { payment_status: string | null }).payment_status ?? "").toLowerCase();
  const scheduledDate = String((match as { scheduled_date: string | null }).scheduled_date ?? "");
  const scheduledTime = String((match as { scheduled_time: string | null }).scheduled_time ?? "");

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
        await supabase
          .from(DB_TABLES.matches)
          .update({ match_status: "cancelled" })
          .eq("id", id)
          .eq("owner_id", user.id);
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
      await supabase
        .from(DB_TABLES.matches)
        .update({
          match_status: "cancelled",
          payment_status: "refunded",
        })
        .eq("id", id)
        .eq("owner_id", user.id);
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
    .update({ match_status: "cancelled" })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    redirect("/reservas?error=cancel");
  }

  revalidatePath("/reservas");
  redirect("/reservas");
}
