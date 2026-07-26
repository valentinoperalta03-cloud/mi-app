"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getOwnerAdminContext, type OwnerAdminContext } from "@/lib/admin/owner-context";
import { isClubMercadoPagoConnected } from "@/lib/club-mp";
import { DB_TABLES } from "@/lib/db-tables";
import { refundMercadoPagoPayment } from "@/lib/mercadopago";
import { createNotification } from "@/lib/notifications";
import { isClubSubscriptionBlocked } from "@/lib/subscription-check";
import { createClient, createServiceClient } from "@/utils/supabase/server";

type PenaRow = {
  id: string;
  club_id: string;
  name: string;
  status: string;
  max_players: number;
  price_per_player: number;
  accepts_mp: boolean;
  accepts_cash: boolean;
  accepts_transfer: boolean;
};

async function assertPenaOwner(
  supabase: SupabaseClient,
  penaId: string
): Promise<{ ok: true; ctx: OwnerAdminContext; row: PenaRow } | { ok: false; error: string }> {
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "Sesión requerida." };
  const { data: p } = await supabase
    .from(DB_TABLES.penas)
    .select("id, club_id, name, status, max_players, price_per_player, accepts_mp, accepts_cash, accepts_transfer")
    .eq("id", penaId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Peña no encontrada." };
  const row = p as PenaRow;
  if (!ctx.clubIds.includes(row.club_id)) return { ok: false, error: "No autorizado." };
  return { ok: true, ctx, row };
}

function parseWhatIncludes(formData: FormData): string[] {
  const many = formData.getAll("what_includes").map((v) => String(v).trim()).filter(Boolean);
  if (many.length > 0) return many;
  const single = String(formData.get("what_includes") ?? "").trim();
  if (!single) return [];
  return single
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readPenaFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const whatIncludes = parseWhatIncludes(formData);
  const date = String(formData.get("date") ?? "").trim();
  const startTimeRaw = String(formData.get("start_time") ?? "").trim();
  const startTime = startTimeRaw.length === 5 ? `${startTimeRaw}:00` : startTimeRaw;
  const durationMinutes = Number(formData.get("duration_minutes") ?? 90);
  const level = String(formData.get("level") ?? "").trim();
  const gameFormat = String(formData.get("game_format") ?? "").trim() || null;
  const maxPlayers = Number(formData.get("max_players") ?? 0);
  const pricePerPlayer = Number(formData.get("price_per_player") ?? 0);
  const acceptsMp = formData.get("accepts_mp") === "true";
  const acceptsCash = formData.get("accepts_cash") === "true";
  const acceptsTransfer = formData.get("accepts_transfer") === "true";
  const transferAlias = String(formData.get("transfer_alias") ?? "").trim() || null;
  const cancellationHoursRaw = formData.get("cancellation_hours");
  const cancellationHours = cancellationHoursRaw == null ? 24 : Number(cancellationHoursRaw);

  return {
    name,
    description,
    whatIncludes,
    date,
    startTime,
    durationMinutes,
    level,
    gameFormat,
    maxPlayers,
    pricePerPlayer,
    acceptsMp,
    acceptsCash,
    acceptsTransfer,
    transferAlias,
    cancellationHours,
  };
}

function validatePenaFields(f: ReturnType<typeof readPenaFields>): string | null {
  if (!f.name) return "Nombre obligatorio.";
  if (!f.date) return "Fecha obligatoria.";
  if (!f.startTime) return "Hora de inicio obligatoria.";
  if (!f.level) return "Nivel obligatorio.";
  if (!Number.isFinite(f.maxPlayers) || f.maxPlayers <= 0 || f.maxPlayers % 2 !== 0) {
    return "El máximo de jugadores debe ser un número par mayor a 0.";
  }
  if (!Number.isFinite(f.pricePerPlayer) || f.pricePerPlayer < 0) return "Precio inválido.";
  if (!f.acceptsMp && !f.acceptsCash && !f.acceptsTransfer) {
    return "Elegí al menos un método de pago.";
  }
  if (f.acceptsTransfer && !f.transferAlias) return "Cargá el alias de transferencia.";
  if (!Number.isFinite(f.durationMinutes) || f.durationMinutes <= 0) return "Duración inválida.";
  if (!Number.isFinite(f.cancellationHours) || f.cancellationHours < 0) return "Horas de cancelación inválidas.";
  return null;
}

export async function createPenaAction(formData: FormData): Promise<{ ok: boolean; penaId?: string; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "Sesión requerida." };
  if (ctx.clubIds.length === 0) return { ok: false, error: "Primero configurá tu club." };

  const clubId = String(formData.get("club_id") ?? ctx.clubIds[0]).trim();
  if (!ctx.clubIds.includes(clubId)) return { ok: false, error: "Club inválido." };
  if (await isClubSubscriptionBlocked(clubId)) return { ok: false, error: "Este club no puede crear peñas en este momento." };

  const f = readPenaFields(formData);
  const invalid = validatePenaFields(f);
  if (invalid) return { ok: false, error: invalid };

  const { data: inserted, error } = await supabase
    .from(DB_TABLES.penas)
    .insert({
      club_id: clubId,
      name: f.name,
      description: f.description,
      what_includes: f.whatIncludes,
      date: f.date,
      start_time: f.startTime,
      duration_minutes: Math.floor(f.durationMinutes),
      level: f.level,
      game_format: f.gameFormat,
      max_players: Math.floor(f.maxPlayers),
      price_per_player: f.pricePerPlayer,
      accepts_mp: f.acceptsMp,
      accepts_cash: f.acceptsCash,
      accepts_transfer: f.acceptsTransfer,
      transfer_alias: f.transferAlias,
      cancellation_hours: Math.floor(f.cancellationHours),
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !inserted) return { ok: false, error: error?.message ?? "No se pudo crear la peña." };

  revalidatePath("/admin/penas");
  return { ok: true, penaId: (inserted as { id: string }).id };
}

export async function updatePenaAction(penaId: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertPenaOwner(supabase, penaId);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (gate.row.status !== "draft") return { ok: false, error: "Solo se puede editar una peña en borrador." };

  const f = readPenaFields(formData);
  const invalid = validatePenaFields(f);
  if (invalid) return { ok: false, error: invalid };

  const { error } = await supabase
    .from(DB_TABLES.penas)
    .update({
      name: f.name,
      description: f.description,
      what_includes: f.whatIncludes,
      date: f.date,
      start_time: f.startTime,
      duration_minutes: Math.floor(f.durationMinutes),
      level: f.level,
      game_format: f.gameFormat,
      max_players: Math.floor(f.maxPlayers),
      price_per_player: f.pricePerPlayer,
      accepts_mp: f.acceptsMp,
      accepts_cash: f.acceptsCash,
      accepts_transfer: f.acceptsTransfer,
      transfer_alias: f.transferAlias,
      cancellation_hours: Math.floor(f.cancellationHours),
      updated_at: new Date().toISOString(),
    })
    .eq("id", penaId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/penas");
  revalidatePath(`/admin/penas/${penaId}`);
  return { ok: true };
}

export async function publishPenaAction(penaId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertPenaOwner(supabase, penaId);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (gate.row.status !== "draft") return { ok: false, error: "Solo se puede publicar una peña en borrador." };

  const hasCourt = gate.ctx.courts.some((c) => c.club_id === gate.row.club_id);
  if (!hasCourt) return { ok: false, error: "El club no tiene canchas cargadas." };

  if (gate.row.accepts_mp) {
    const service = createServiceClient();
    const { data: club } = await service
      .from(DB_TABLES.clubs)
      .select("mp_access_token, mp_user_id")
      .eq("id", gate.row.club_id)
      .maybeSingle();
    if (!isClubMercadoPagoConnected(club as { mp_access_token?: string | null; mp_user_id?: string | null } | null)) {
      return { ok: false, error: "El club no tiene Mercado Pago conectado. Desactivá el pago con MP o conectá la cuenta." };
    }
  }

  const { error } = await supabase.from(DB_TABLES.penas).update({ status: "published" }).eq("id", penaId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/penas");
  revalidatePath(`/admin/penas/${penaId}`);
  return { ok: true };
}

export async function cancelPenaAction(penaId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertPenaOwner(supabase, penaId);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (gate.row.status === "finished" || gate.row.status === "cancelled") {
    return { ok: false, error: "Esta peña ya está finalizada o cancelada." };
  }

  const service = createServiceClient();
  const { data: regs } = await service
    .from(DB_TABLES.penaRegistrations)
    .select("id, player_id, status, payment_status, payment_method, mp_payment_id")
    .eq("pena_id", penaId)
    .neq("status", "cancelled");

  const rows = (regs ?? []) as Array<{
    id: string;
    player_id: string;
    status: string;
    payment_status: string;
    payment_method: string | null;
    mp_payment_id: string | null;
  }>;

  let refundFailures = 0;
  for (const r of rows) {
    if (r.payment_status === "confirmed" && r.payment_method === "mercadopago" && r.mp_payment_id) {
      const result = await refundMercadoPagoPayment(r.mp_payment_id);
      if (result.ok) {
        await service.from(DB_TABLES.penaRegistrations).update({ payment_status: "refunded" }).eq("id", r.id);
      } else {
        refundFailures++;
      }
    }
  }

  await service.from(DB_TABLES.penaRegistrations).update({ status: "cancelled" }).eq("pena_id", penaId).neq("status", "cancelled");
  await service.from(DB_TABLES.penas).update({ status: "cancelled" }).eq("id", penaId);

  const penaName = gate.row.name;
  const playerIds = [...new Set(rows.map((r) => r.player_id))];
  for (const uid of playerIds) {
    await createNotification(service, {
      user_id: uid,
      type: "reservation_cancelled",
      title: "Peña cancelada",
      body: `La peña "${penaName}" fue cancelada por el club.`,
    });
  }

  revalidatePath("/admin/penas");
  revalidatePath(`/admin/penas/${penaId}`);

  if (refundFailures > 0) {
    return { ok: true, error: `Peña cancelada. No se pudo reembolsar a ${refundFailures} jugador(es); hacelo manualmente desde Mercado Pago.` };
  }
  return { ok: true };
}

export async function confirmPenaOfflinePaymentAction(registrationId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "Sesión requerida." };

  const service = createServiceClient();
  const { data: reg } = await service
    .from(DB_TABLES.penaRegistrations)
    .select("id, player_id, status, payment_status, payment_method, pena_id, penas!inner(id, club_id, name)")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return { ok: false, error: "Inscripción no encontrada." };

  const raw = reg as Record<string, unknown>;
  const penaPack = raw.penas;
  const pena = (Array.isArray(penaPack) ? penaPack[0] : penaPack) as { id: string; club_id: string; name: string } | null;
  if (!pena || !ctx.clubIds.includes(pena.club_id)) return { ok: false, error: "No autorizado." };

  if (String(raw.payment_status) !== "pending") return { ok: false, error: "Este cobro ya no está pendiente." };
  if (raw.payment_method !== "cash" && raw.payment_method !== "transfer") {
    return { ok: false, error: "Este cobro no es offline." };
  }

  const { error } = await service.from(DB_TABLES.penaRegistrations).update({ payment_status: "confirmed" }).eq("id", registrationId);
  if (error) return { ok: false, error: error.message };

  await createNotification(service, {
    user_id: String(raw.player_id),
    type: "payment_approved",
    title: "Tu pago fue confirmado ✓",
    body: `El club confirmó tu pago para la peña "${pena.name}".`,
  });

  revalidatePath("/admin/penas");
  revalidatePath(`/admin/penas/${pena.id}`);
  return { ok: true };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function generatePenaFirstRoundAction(penaId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertPenaOwner(supabase, penaId);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (gate.row.status !== "in_progress") return { ok: false, error: "La peña debe estar en curso para generar la ronda." };

  const service = createServiceClient();
  const { count } = await service
    .from(DB_TABLES.penaRoundMatches)
    .select("id", { count: "exact", head: true })
    .eq("pena_id", penaId);
  if ((count ?? 0) > 0) return { ok: false, error: "Ya existe una ronda generada para esta peña." };

  const { data: regs } = await service
    .from(DB_TABLES.penaRegistrations)
    .select("player_id")
    .eq("pena_id", penaId)
    .eq("status", "registered");
  const playerIds = ((regs ?? []) as Array<{ player_id: string }>).map((r) => r.player_id);
  if (playerIds.length < 4) return { ok: false, error: "Se necesitan al menos 4 jugadores inscriptos." };

  const shuffled = shuffle(playerIds);
  const courts = gate.ctx.courts.filter((c) => c.club_id === gate.row.club_id);

  const rows: Array<{
    pena_id: string;
    pair1_player1_id: string;
    pair1_player2_id: string;
    pair2_player1_id: string;
    pair2_player2_id: string;
    court_id: string | null;
    match_order: number;
  }> = [];

  let matchOrder = 0;
  for (let i = 0; i + 3 < shuffled.length; i += 4) {
    rows.push({
      pena_id: penaId,
      pair1_player1_id: shuffled[i],
      pair1_player2_id: shuffled[i + 1],
      pair2_player1_id: shuffled[i + 2],
      pair2_player2_id: shuffled[i + 3],
      court_id: courts[matchOrder]?.id ?? null,
      match_order: matchOrder + 1,
    });
    matchOrder++;
  }

  if (rows.length === 0) return { ok: false, error: "No se pudo armar ningún partido con los jugadores inscriptos." };

  const { error } = await service.from(DB_TABLES.penaRoundMatches).insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/penas/${penaId}`);
  return { ok: true };
}

export async function updatePenaRoundMatchAction(
  matchId: string,
  data: {
    pair1_player1_id?: string | null;
    pair1_player2_id?: string | null;
    pair2_player1_id?: string | null;
    pair2_player2_id?: string | null;
    court_id?: string | null;
    match_order?: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, error: "Sesión requerida." };

  const { data: match } = await supabase
    .from(DB_TABLES.penaRoundMatches)
    .select("id, pena_id, penas!inner(id, club_id)")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { ok: false, error: "Partido no encontrado." };

  const raw = match as Record<string, unknown>;
  const penaPack = raw.penas;
  const pena = (Array.isArray(penaPack) ? penaPack[0] : penaPack) as { id: string; club_id: string } | null;
  if (!pena || !ctx.clubIds.includes(pena.club_id)) return { ok: false, error: "No autorizado." };

  const update: Record<string, unknown> = {};
  if (data.pair1_player1_id !== undefined) update.pair1_player1_id = data.pair1_player1_id;
  if (data.pair1_player2_id !== undefined) update.pair1_player2_id = data.pair1_player2_id;
  if (data.pair2_player1_id !== undefined) update.pair2_player1_id = data.pair2_player1_id;
  if (data.pair2_player2_id !== undefined) update.pair2_player2_id = data.pair2_player2_id;
  if (data.court_id !== undefined) update.court_id = data.court_id;
  if (data.match_order !== undefined) update.match_order = data.match_order;

  const service = createServiceClient();
  const { error } = await service.from(DB_TABLES.penaRoundMatches).update(update).eq("id", matchId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/penas/${pena.id}`);
  return { ok: true };
}

export async function startPenaAction(penaId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertPenaOwner(supabase, penaId);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (gate.row.status !== "published") return { ok: false, error: "Solo se puede iniciar una peña publicada." };

  const service = createServiceClient();
  const { count } = await service
    .from(DB_TABLES.penaRegistrations)
    .select("id", { count: "exact", head: true })
    .eq("pena_id", penaId)
    .eq("status", "registered");
  if ((count ?? 0) < 4) return { ok: false, error: "Se necesitan al menos 4 inscriptos para iniciar la peña." };

  const { error } = await service.from(DB_TABLES.penas).update({ status: "in_progress" }).eq("id", penaId);
  if (error) return { ok: false, error: error.message };

  const firstRound = await generatePenaFirstRoundAction(penaId);
  if (!firstRound.ok) {
    revalidatePath(`/admin/penas/${penaId}`);
    return { ok: true, error: `Peña iniciada, pero no se pudo generar la ronda: ${firstRound.error}` };
  }

  revalidatePath("/admin/penas");
  revalidatePath(`/admin/penas/${penaId}`);
  return { ok: true };
}

export async function finishPenaAction(penaId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient({ allowCookieWrites: true });
  const gate = await assertPenaOwner(supabase, penaId);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (gate.row.status !== "in_progress") return { ok: false, error: "Solo se puede finalizar una peña en curso." };

  const { error } = await supabase.from(DB_TABLES.penas).update({ status: "finished" }).eq("id", penaId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/penas");
  revalidatePath(`/admin/penas/${penaId}`);
  return { ok: true };
}
