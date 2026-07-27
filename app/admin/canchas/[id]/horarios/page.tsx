import { notFound, redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminAccentBar, adminCTAPrimary, adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { minutesToClock, parseClockToMinutes } from "@/lib/court-slots";
import { createClient } from "@/utils/supabase/server";
import { saveCourtHourlyPrices } from "../precios/actions";

const SLOT_DURATION = 90;

function buildCourtTurns(openTime: string) {
  const rawOpen = parseClockToMinutes(openTime || "09:00");
  const turns: { start: string; end: string }[] = [];
  for (let t = rawOpen; t < 24 * 60; t += SLOT_DURATION) {
    turns.push({ start: minutesToClock(t), end: minutesToClock(t + SLOT_DURATION) });
  }
  return turns;
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ price_error?: string; price_saved?: string }>;
};

function decodeErr(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

export default async function AdminCanchaHorariosPage({ params, searchParams }: PageProps) {
  const { id: courtId } = await params;
  const sp = searchParams ? await searchParams : {};
  const preciosError = sp.price_error?.trim() ?? "";
  const preciosSaved = sp.price_saved === "1";

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.courtIds.includes(courtId)) notFound();

  const { data: court } = await supabase
    .from(DB_TABLES.courts)
    .select("id,name,price,club_id")
    .eq("id", courtId)
    .maybeSingle();
  if (!court) notFound();

  const clubIdForCourt = String((court as { club_id?: string | null }).club_id ?? "").trim();
  const { data: clubHours } = clubIdForCourt
    ? await supabase.from(DB_TABLES.clubs).select("open_time,close_time").eq("id", clubIdForCourt).maybeSingle()
    : { data: null };
  const clubOpen = String((clubHours as { open_time?: string | null } | null)?.open_time ?? "").trim().slice(0, 5);
  const clubClose = String((clubHours as { close_time?: string | null } | null)?.close_time ?? "").trim().slice(0, 5);

  const { data: slotRows } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("start_time,price_override")
    .eq("court_id", courtId)
    .is("day_of_week", null)
    .not("start_time", "is", null);
  const byTurnStart = new Map(
    ((slotRows ?? []) as Array<{ start_time: string | null; price_override: number | null }>)
      .filter((r) => r.start_time)
      .map((r) => [String(r.start_time).slice(0, 5), Number(r.price_override ?? 0)])
  );
  const basePrice = Number((court as { price: number | null }).price ?? 0);
  const turns = buildCourtTurns(clubOpen || "09:00");

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/canchas" />

      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0085FC]`}>Precios</p>
        <h1 className={adminTitle}>{(court as { name?: string | null }).name ?? "Cancha"}</h1>
        <p className={adminSubtitle}>Configurá el precio de cada turno de 90 min.</p>
      </header>

      {clubOpen && clubClose ? (
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
          <span className="font-semibold">Horario del club:</span> abre {clubOpen} hs · último turno 22:30 → 00:00 · turnos de 90 min.{" "}
          <a href="/admin/config" className="underline underline-offset-2 opacity-70 hover:opacity-100">
            Cambiar en Configuración
          </a>
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
          Todavía no configuraste el horario del club.{" "}
          <a href="/admin/config" className="font-semibold underline underline-offset-2">
            Ir a Configuración
          </a>
        </div>
      )}

      <section className={`${adminCard} ${adminAccentBar} space-y-5`}>
        <div>
          <h2 className="font-admin-display text-lg font-bold text-[var(--text-primary)]">Precios por turno</h2>
          <p className="text-sm text-[var(--text-tertiary)]">Configurá el precio de cada turno de la cancha.</p>
        </div>
        {preciosSaved ? (
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-emerald-800">
            Precios guardados correctamente.
          </div>
        ) : null}
        {preciosError ? (
          <div className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-800">
            {decodeErr(preciosError)}
          </div>
        ) : null}

        {turns.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">
            No hay turnos disponibles con el horario actual del club. Revisá la configuración de horarios.
          </p>
        ) : (
          <form action={saveCourtHourlyPrices} className="space-y-4">
            <input type="hidden" name="court_id" value={courtId} />
            <input type="hidden" name="slot_duration_minutes" value={SLOT_DURATION} />
            {turns.map((turn) => (
              <label key={`${turn.start}-${turn.end}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/70 px-4 py-3">
                <span className="text-sm font-semibold text-[var(--text-secondary)]">
                  {turn.start} - {turn.end}
                </span>
                <input
                  type="number"
                  min={0}
                  step="1"
                  name={`price_${turn.start}`}
                  defaultValue={byTurnStart.get(turn.start) ?? basePrice}
                  className="w-36 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-right text-sm font-medium text-[var(--text-secondary)] outline-none focus:border-[#0085FC]/30 focus:ring-2 focus:ring-[#0085FC]/20"
                />
              </label>
            ))}
            <button type="submit" className={`w-full ${adminCTAPrimary}`}>
              Guardar precios
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
