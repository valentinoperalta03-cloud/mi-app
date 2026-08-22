import { notFound, redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import AdminGuideBox from "@/components/admin/admin-guide-box";
import { adminAccentBar, adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import CourtPricesClient, { type CourtPriceRow } from "./court-prices-client";
import CourtTimeRangesClient, { type CourtTimeRange } from "./court-time-ranges-client";

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

  const { data: timeRangesRaw } = await supabase
    .from(DB_TABLES.courtTimeRanges)
    .select("id,day_of_week,open_time,close_time")
    .eq("court_id", courtId);
  const timeRanges = (timeRangesRaw ?? []) as CourtTimeRange[];

  // Rama precios de court_schedules: incluye filas con day_of_week de un día
  // específico y filas legacy con day_of_week IS NULL (fallback global previo
  // a precios por día).
  const { data: priceRowsRaw } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("day_of_week,start_time,price_override")
    .eq("court_id", courtId)
    .not("start_time", "is", null);
  const priceRows: CourtPriceRow[] = (
    (priceRowsRaw ?? []) as Array<{ day_of_week: number | null; start_time: string | null; price_override: number | null }>
  )
    .filter((r) => r.start_time)
    .map((r) => ({
      dayOfWeek: r.day_of_week,
      startTime: String(r.start_time).slice(0, 5),
      price: Number(r.price_override ?? 0),
    }));
  const basePrice = Number((court as { price: number | null }).price ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/canchas" />

      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0085FC]`}>Horarios y precios</p>
        <h1 className={adminTitle}>{(court as { name?: string | null }).name ?? "Cancha"}</h1>
        <p className={adminSubtitle}>Configurá franjas horarias y el precio de cada turno de 90 min.</p>
      </header>

      <AdminGuideBox title="¿Cómo configurar horarios y precios?">
        <ol className="list-decimal space-y-1.5 pl-4 text-[var(--text-secondary)]">
          <li>
            Primero configurá las franjas horarias de cada día — los horarios en que la cancha está disponible
            para reservar.
          </li>
          <li>Podés tener hasta 4 franjas por día (ej: mañana 07:00-13:00 y tarde 16:00-22:00).</li>
          <li>
            Usá <strong>&quot;Aplicar a todos los días&quot;</strong> para copiar la misma franja a toda la
            semana de una vez.
          </li>
          <li>
            Después configurá el precio por turno (90 min) para cada franja. Podés tener precios distintos por
            día y horario.
          </li>
          <li>Si no configurás franjas propias, se usa el horario general del club.</li>
        </ol>
      </AdminGuideBox>

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
          <h2 className="font-admin-display text-lg font-bold text-[var(--text-primary)]">Franjas horarias</h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            Por defecto la cancha usa el horario del club. Personalizá franjas propias por día si necesitás abrir en otro horario (podés cargar más de una franja por día).
          </p>
        </div>
        <CourtTimeRangesClient courtId={courtId} clubOpen={clubOpen} clubClose={clubClose} initialRanges={timeRanges} />
      </section>

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

        <CourtPricesClient
          courtId={courtId}
          clubOpen={clubOpen}
          basePrice={basePrice}
          timeRanges={timeRanges}
          priceRows={priceRows}
        />
      </section>
    </div>
  );
}
