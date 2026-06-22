import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyClubOwner } from "@/lib/club-notify";
import { utcMsForArgentinaWallClock, getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { getPaymentRefundClient } from "@/lib/mercadopago";
import { log } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";

type MatchRow = {
  id: string;
  owner_id: string | null;
  court_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  match_type: string | null;
  match_status: string | null;
  es_turno_fijo: boolean | null;
  incomplete_reminder_sent: boolean | null;
};

type PaymentRow = {
  id: string;
  user_id: string;
  mp_payment_id: string | null;
};

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase env vars" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const today = getTodayYmdInArgentina();
  const until = addDaysYmd(today, 3);

  const { data: matches, error: fetchErr } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id,owner_id,court_id,scheduled_date,scheduled_time,match_type,match_status,es_turno_fijo,incomplete_reminder_sent"
    )
    .gte("scheduled_date", today)
    .lte("scheduled_date", until)
    .neq("match_status", "cancelled");

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const list = (matches ?? []) as MatchRow[];
  const ids = list.map((m) => m.id);
  const { data: partRows } = ids.length
    ? await supabase.from(DB_TABLES.matchParticipants).select("match_id").in("match_id", ids)
    : { data: [] };

  const countBy = new Map<string, number>();
  for (const r of partRows ?? []) {
    const mid = String((r as { match_id: string }).match_id);
    countBy.set(mid, (countBy.get(mid) ?? 0) + 1);
  }

  let reminders = 0;
  let cancelled = 0;

  for (const m of list) {
    const mt = String(m.match_type ?? "").toLowerCase();
    const isTurnoFijo = Boolean(m.es_turno_fijo);
    // Procesar amistosos, competitivos, y turnos fijos (reservas con jugadores asignados)
    if (mt !== "amistoso" && mt !== "competitivo" && !(mt === "reservation" && isTurnoFijo)) continue;
    const ms = String(m.match_status ?? "").toLowerCase();
    if (ms === "cancelled") continue;

    const count = countBy.get(m.id) ?? 0;
    if (count >= 4) continue;

    const date = String(m.scheduled_date ?? "");
    const time = String(m.scheduled_time ?? "").trim().slice(0, 5);
    const startMs = utcMsForArgentinaWallClock(date, time);
    if (!Number.isFinite(startMs)) continue;
    const diffMin = (startMs - Date.now()) / 60_000;

    if (!m.incomplete_reminder_sent && diffMin <= 150 && diffMin >= 85) {
      const { error: upErr } = await supabase
        .from(DB_TABLES.matches)
        .update({ incomplete_reminder_sent: true })
        .eq("id", m.id);
      if (upErr) {
        log.warn({ event: "cron.incomplete_matches.reminder_flag", matchId: m.id, err: upErr });
        continue;
      }

      const free = Math.max(0, 4 - count);
      const body = `Tu partido de las ${time} tiene ${free} lugar${free === 1 ? "" : "es"} libre${free === 1 ? "" : "s"}. Invitá amigos o tu partido podría cancelarse.`;
      if (m.owner_id) {
        await createNotification(supabase, {
          user_id: m.owner_id,
          type: "match_reminder",
          title: "⚠️ Partido incompleto",
          body,
          match_id: m.id,
        });
      }

      const { data: courtRow } = await supabase
        .from(DB_TABLES.courts)
        .select("name,club_id")
        .eq("id", m.court_id)
        .maybeSingle();
      const c = courtRow as { name?: string | null; club_id?: string | null } | null;
      const clubId = String(c?.club_id ?? "").trim();
      if (clubId) {
        await notifyClubOwner(supabase, clubId, {
          title: "⚠️ Partido incompleto",
          body: `${String(c?.name ?? "Cancha")} a las ${time} tiene lugares libres.`,
          match_id: m.id,
        });
      }
      reminders++;
      continue;
    }

    if (diffMin <= 30 && diffMin >= -10) {
      const { data: fresh } = await supabase
        .from(DB_TABLES.matches)
        .select("match_status")
        .eq("id", m.id)
        .maybeSingle();
      if (String((fresh as { match_status?: string | null } | null)?.match_status ?? "").toLowerCase() === "cancelled") {
        continue;
      }

      const notified = new Set<string>();

      const { data: payments } = await supabase
        .from(DB_TABLES.payments)
        .select("id,user_id,mp_payment_id")
        .eq("match_id", m.id)
        .eq("status", "approved");

      for (const payment of (payments ?? []) as PaymentRow[]) {
        const mpId = payment.mp_payment_id?.trim();
        if (mpId && mpId !== "dev_simulated" && mpId !== "club_counter") {
          try {
            await getPaymentRefundClient().total({ payment_id: mpId });
          } catch (e) {
            log.error({ event: "cron.incomplete_matches.refund_failed", matchId: m.id, err: e });
          }
        }

        await supabase
          .from(DB_TABLES.payments)
          .update({ status: "refund_requested", updated_at: new Date().toISOString() })
          .eq("id", payment.id);

        notified.add(payment.user_id);
        await createNotification(supabase, {
          user_id: payment.user_id,
          type: "match_cancelled",
          title: "Partido cancelado",
          body: "Partido cancelado por falta de jugadores. Se solicitó el reembolso.",
          match_id: m.id,
        });
      }

      const { data: partList } = await supabase
        .from(DB_TABLES.matchParticipants)
        .select("player_id")
        .eq("match_id", m.id);
      for (const row of partList ?? []) {
        const uid = String((row as { player_id: string }).player_id);
        if (notified.has(uid)) continue;
        notified.add(uid);
        await createNotification(supabase, {
          user_id: uid,
          type: "match_cancelled",
          title: "Partido cancelado",
          body: "Partido cancelado por falta de jugadores.",
          match_id: m.id,
        });
      }

      const { data: upData, error: cancelErr } = await supabase
        .from(DB_TABLES.matches)
        .update({ match_status: "cancelled", payment_status: "refund_requested" })
        .eq("id", m.id)
        .in("match_status", ["scheduled", "full", "reserved", "pending"])
        .select("id");

      if (cancelErr || !upData?.length) {
        log.warn({ event: "cron.incomplete_matches.cancel_skipped", matchId: m.id, err: cancelErr });
        continue;
      }

      const { data: courtRow2 } = await supabase
        .from(DB_TABLES.courts)
        .select("name,club_id")
        .eq("id", m.court_id)
        .maybeSingle();
      const c2 = courtRow2 as { name?: string | null; club_id?: string | null } | null;
      const clubId2 = String(c2?.club_id ?? "").trim();
      if (clubId2) {
        await notifyClubOwner(supabase, clubId2, {
          title: "🚫 Partido cancelado",
          body: `${String(c2?.name ?? "Cancha")} a las ${time} fue cancelado. Cancha disponible.`,
          match_id: m.id,
        });
      }

      cancelled++;
    }
  }

  return NextResponse.json({ ok: true, reminders, cancelled });
}
