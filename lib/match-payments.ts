import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { createMPPreference, getPublicBaseUrl } from "@/lib/mp-preference";
import { createClient, createServiceClient } from "@/utils/supabase/server";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function loadMatchForMercadoPago(
  supabase: SupabaseServer,
  matchId: string
): Promise<{ totalPrice: number; scheduledDate: string; clubName: string; courtName: string } | null> {
  const { data: row, error } = await supabase
    .from(DB_TABLES.matches)
    .select("total_price,scheduled_date,date,courts(name,clubs(name))")
    .eq("id", matchId)
    .maybeSingle();
  if (error || !row) return null;
  const m = row as {
    total_price: number | null;
    scheduled_date: string | null;
    date: string;
    courts:
      | {
          name: string | null;
          clubs: { name: string | null } | { name: string | null }[] | null;
        }
      | {
          name: string | null;
          clubs: { name: string | null } | { name: string | null }[] | null;
        }[]
      | null;
  };
  const courtRel = Array.isArray(m.courts) ? m.courts[0] ?? null : m.courts;
  const clubRel = courtRel?.clubs;
  const clubObj = Array.isArray(clubRel) ? clubRel[0] ?? null : clubRel;
  const totalPrice = Number(m.total_price ?? 0);
  let scheduledDate = String(m.scheduled_date ?? "").trim();
  if (!scheduledDate && m.date) {
    scheduledDate = m.date.slice(0, 10);
  }
  const courtName = courtRel?.name ?? "Cancha";
  const clubName = clubObj?.name ?? "Club";
  return { totalPrice, scheduledDate, clubName, courtName };
}

async function getPayerIdentityForMp(payerUserId: string): Promise<{
  email: string;
  firstName: string;
  lastName: string;
}> {
  const service = createServiceClient();
  const { data: profile } = await service
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", payerUserId)
    .maybeSingle();
  const name = String((profile as { name?: string | null } | null)?.name ?? "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  let email = "";
  try {
    const { data: authUser, error } = await service.auth.admin.getUserById(payerUserId);
    if (!error && authUser?.user?.email) {
      email = authUser.user.email;
    }
  } catch {
    /* sin admin o usuario inexistente */
  }
  return {
    email,
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") ?? "",
  };
}

export async function createParticipantMercadoPagoPreference(params: {
  supabase: SupabaseServer;
  matchId: string;
  payerUserId: string;
  requestedTeam?: 1 | 2 | null;
}): Promise<
  | { ok: true; initPoint: string; prefId: string; total: number; marketplaceFee: number }
  | { ok: false; message: string }
> {
  const meta = await loadMatchForMercadoPago(params.supabase, params.matchId);
  if (!meta || !meta.scheduledDate) {
    return { ok: false, message: "No se pudo cargar el partido." };
  }
  const perPlayerBase = Math.round(meta.totalPrice / 4);
  if (!Number.isFinite(perPlayerBase) || perPlayerBase <= 0) {
    return { ok: false, message: "Precio del partido inválido." };
  }
  const payer = await getPayerIdentityForMp(params.payerUserId);
  const base = getPublicBaseUrl();
  const backUrls = base
    ? {
        success: `${base}/partidos/${params.matchId}/pago`,
        failure: `${base}/partidos/${params.matchId}/pago`,
        pending: `${base}/partidos/${params.matchId}/pago`,
      }
    : undefined;
  const mp = await createMPPreference({
    matchId: params.matchId,
    amount: perPlayerBase,
    clubName: meta.clubName,
    courtName: meta.courtName,
    date: meta.scheduledDate,
    userId: params.payerUserId,
    externalReference: `${params.matchId}__${params.payerUserId}`,
    payerEmail: payer.email,
    payerFirstName: payer.firstName,
    payerLastName: payer.lastName,
    backUrls,
  });
  if ("error" in mp) {
    return { ok: false, message: mp.error };
  }
  return { ok: true, initPoint: mp.initPoint, prefId: mp.prefId, total: mp.total, marketplaceFee: mp.marketplaceFee };
}

export async function createParticipantMercadoPagoCheckout(params: {
  supabase: SupabaseServer;
  matchId: string;
  payerUserId: string;
  requestedTeam?: 1 | 2 | null;
}): Promise<
  | { ok: true; initPoint: string; prefId: string; total: number; marketplaceFee: number }
  | { ok: false; message: string }
> {
  const mp = await createParticipantMercadoPagoPreference(params);
  if (!mp.ok) {
    return mp;
  }
  const { error: payErr } = await params.supabase.from(DB_TABLES.payments).insert({
    match_id: params.matchId,
    user_id: params.payerUserId,
    mp_preference_id: mp.prefId,
    status: "pending",
    amount: mp.total,
    marketplace_fee: mp.marketplaceFee,
    team_preference:
      params.requestedTeam === 1 || params.requestedTeam === 2 ? params.requestedTeam : null,
  });
  if (payErr) {
    log.error({
      event: "payment.insert_failed",
      matchId: params.matchId,
      userId: params.payerUserId,
      err: payErr,
    });
    return { ok: false, message: "No se pudo registrar el pago." };
  }
  return { ok: true, initPoint: mp.initPoint, prefId: mp.prefId, total: mp.total, marketplaceFee: mp.marketplaceFee };
}

/** Regenera preferencia MP para un pago de jugador (link vencido / estado expired). */
export async function regenerateParticipantMercadoPagoLink(params: {
  supabase: SupabaseServer;
  paymentId: string;
  payerUserId: string;
}): Promise<{ ok: true; initPoint: string } | { ok: false; message: string }> {
  const { data: row, error } = await params.supabase
    .from(DB_TABLES.payments)
    .select("id,match_id,user_id,status")
    .eq("id", params.paymentId)
    .maybeSingle();
  if (error || !row) {
    return { ok: false, message: "No encontramos el pago." };
  }
  const typed = row as { match_id: string; user_id: string; status: string | null };
  if (typed.user_id !== params.payerUserId) {
    return { ok: false, message: "No tenés permiso para este pago." };
  }
  const st = String(typed.status ?? "").toLowerCase();
  if (st === "approved") {
    return { ok: false, message: "Este pago ya está confirmado." };
  }
  if (!["pending", "expired", "invited", "rejected"].includes(st)) {
    return { ok: false, message: "No podemos regenerar este link en este momento." };
  }

  const mp = await createParticipantMercadoPagoPreference({
    supabase: params.supabase,
    matchId: typed.match_id,
    payerUserId: params.payerUserId,
  });
  if (!mp.ok) {
    return { ok: false, message: mp.message };
  }

  const { error: updErr } = await params.supabase
    .from(DB_TABLES.payments)
    .update({
      mp_preference_id: mp.prefId,
      status: "pending",
      amount: mp.total,
      marketplace_fee: mp.marketplaceFee,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.paymentId);

  if (updErr) {
    log.error({ event: "payment.regenerate_update_failed", paymentId: params.paymentId, err: updErr });
    return { ok: false, message: "No se pudo guardar el nuevo link." };
  }

  return { ok: true, initPoint: mp.initPoint };
}
