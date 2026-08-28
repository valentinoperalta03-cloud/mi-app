import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { log } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";

const WARNING_MINUTES = 10;
const EXPIRE_MINUTES = 15;

type MatchRow = {
  id: string;
  owner_id: string | null;
  created_at: string;
  deposit_reminder_sent: boolean | null;
  courts: { name: string | null } | { name: string | null }[] | null;
};

function courtName(row: MatchRow): string {
  const rel = Array.isArray(row.courts) ? row.courts[0] ?? null : row.courts;
  return String(rel?.name ?? "la cancha").trim() || "la cancha";
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

  const now = Date.now();
  const warningThresholdIso = new Date(now - WARNING_MINUTES * 60 * 1000).toISOString();

  // Solo senas/pagos de organizador todavia sin acreditar. Pagos en efectivo/
  // transferencia (cash_pending/transfer_pending) se cobran en el club, no
  // via MP, asi que no expiran por este cron.
  const { data: matches, error: fetchErr } = await supabase
    .from(DB_TABLES.matches)
    .select("id,owner_id,created_at,deposit_reminder_sent,courts(name)")
    .eq("financial_status", "unpaid")
    .eq("payment_status", "pending")
    .in("match_status", ["pending", "scheduled", "reserved"])
    .in("match_type", ["reservation", "amistoso", "competitivo"])
    .or("es_turno_fijo.is.null,es_turno_fijo.eq.false")
    .lt("created_at", warningThresholdIso);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  let cancelled = 0;
  let warned = 0;

  for (const match of (matches ?? []) as MatchRow[]) {
    const ageMinutes = (now - new Date(match.created_at).getTime()) / 60_000;
    const name = courtName(match);

    if (ageMinutes >= EXPIRE_MINUTES) {
      const { error: updateMatchErr } = await supabase
        .from(DB_TABLES.matches)
        .update({ match_status: "cancelled", payment_status: "expired" })
        .eq("id", match.id)
        .in("match_status", ["pending", "scheduled", "reserved"]);
      if (updateMatchErr) {
        log.warn({ event: "cron.expire_unpaid.match_update_skipped", matchId: match.id, err: updateMatchErr });
        continue;
      }

      await supabase
        .from(DB_TABLES.payments)
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("match_id", match.id);

      if (match.owner_id) {
        await createNotification(supabase, {
          user_id: match.owner_id,
          type: "reservation_cancelled",
          title: "Reserva expirada",
          body: `Tu reserva en ${name} expiró porque no se completó el pago. Podés volver a intentarlo.`,
          match_id: match.id,
        });
      }
      cancelled++;
      continue;
    }

    if (ageMinutes >= WARNING_MINUTES && !match.deposit_reminder_sent) {
      const { error: flagErr } = await supabase
        .from(DB_TABLES.matches)
        .update({ deposit_reminder_sent: true })
        .eq("id", match.id);
      if (flagErr) {
        log.warn({ event: "cron.expire_unpaid.reminder_flag_failed", matchId: match.id, err: flagErr });
        continue;
      }

      if (match.owner_id) {
        await createNotification(supabase, {
          user_id: match.owner_id,
          type: "match_reminder",
          title: "Tu reserva está por expirar",
          body: `Te quedan 5 minutos para completar el pago de la seña en ${name} antes de que se libere el turno.`,
          match_id: match.id,
        });
      }
      warned++;
    }
  }

  return NextResponse.json({ cancelled, warned });
}
