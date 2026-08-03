import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import {
  adminBadgeError,
  adminBadgeLima,
  adminButtonSecondary,
  adminCTAPrimary,
  adminCard,
  adminEmptyState,
  adminKicker,
  adminSubtitle,
  adminTitle,
} from "@/components/admin/admin-premium";
import ClubDepositFields from "@/components/admin/club-deposit-fields";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { deleteCourt, updateClubDeposit, updateCourt } from "./actions";
import CourtImageUploader from "./court-image-uploader";
import NewCourtForm from "./new-court-form";

type CourtRow = {
  id: string;
  name: string | null;
  price: number | null;
  club_id: string;
  surface?: string | null;
  indoor?: boolean | null;
  image_url?: string | null;
};

export default async function AdminCanchasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  const sp = (await searchParams) ?? {};
  const errorParam = typeof sp.error === "string" ? sp.error : "";

  const { data: courtsRaw, error } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.courts)
          .select("id,name,price,club_id,surface,indoor,image_url")
          .in("id", ctx.courtIds)
          .order("name")
      : { data: [], error: null };

  const mainClubId = ctx.clubIds[0] ?? "";
  const { data: clubDepositRow } = mainClubId
    ? await supabase.from(DB_TABLES.clubs).select("deposit_type,deposit_value").eq("id", mainClubId).maybeSingle()
    : { data: null };
  const clubDepositType =
    (clubDepositRow as { deposit_type?: "percentage" | "fixed" | null } | null)?.deposit_type ?? null;
  const clubDepositValue = Number((clubDepositRow as { deposit_value?: number | null } | null)?.deposit_value ?? 0);

  const courts = (courtsRaw ?? []) as CourtRow[];
  const today = new Date().toISOString().slice(0, 10);

  const courtIds = courts.map((c) => c.id);
  const { data: blocksRaw } = courtIds.length
    ? await supabase
        .from(DB_TABLES.courtBlocks)
        .select("court_id,id")
        .in("court_id", courtIds)
        .eq("blocked_date", today)
    : { data: [] };
  const blockedCourtIds = new Set((blocksRaw ?? []).map((b: { court_id: string }) => b.court_id));

  const { data: schedulesRaw } = courtIds.length
    ? await supabase
        .from(DB_TABLES.courtSchedules)
        .select("court_id,start_time,price_override")
        .in("court_id", courtIds)
        .is("day_of_week", null)
        .not("start_time", "is", null)
        .not("price_override", "is", null)
        .order("start_time", { ascending: true })
    : { data: [] };
  const schedules = (schedulesRaw ?? []) as Array<{ court_id: string; start_time: string | null; price_override: number | null }>;
  const slotPricesByCourt = new Map<string, Array<{ time: string; price: number }>>();
  for (const row of schedules) {
    const time = String(row.start_time ?? "").slice(0, 5);
    if (!time || typeof row.price_override !== "number") continue;
    const list = slotPricesByCourt.get(row.court_id) ?? [];
    list.push({ time, price: row.price_override });
    slotPricesByCourt.set(row.court_id, list);
  }

  function getPriceSummary(courtId: string) {
    const slots = slotPricesByCourt.get(courtId);
    if (!slots || slots.length === 0) return "Sin precios por horario";
    return slots.map((s) => `${s.time}: $${new Intl.NumberFormat("es-AR").format(s.price)}`).join(" · ");
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={adminKicker}>Canchas</p>
        <h1 className={adminTitle}>Mis canchas</h1>
        <p className={adminSubtitle}>Gestioná precios y horarios de cada cancha.</p>
      </header>

      {error ? (
        <div className="rounded-xl border-l-[3px] border-[var(--admin-alert-error-border)] bg-[var(--admin-alert-error-bg)] p-5 text-sm font-medium text-[var(--text-error)]">
          {error.message}
        </div>
      ) : null}
      {errorParam ? (
        <div className="rounded-xl border-l-[3px] border-[var(--admin-alert-error-border)] bg-[var(--admin-alert-error-bg)] p-5 text-sm font-medium text-[var(--text-error)]">
          {errorParam}
        </div>
      ) : null}

      {mainClubId ? (
        <details className={`${adminCard} group`} open={clubDepositValue === 0}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-[#0461C4] marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2 rounded-2xl border border-[#0085FC]/20 bg-[#0085FC]/5 px-4 py-2 group-open:border-[#0085FC]/30">
              Configuración de seña {clubDepositValue > 0 ? "✓" : "⚠️ Sin configurar"}
            </span>
          </summary>
          <div className="mt-4 space-y-3 border-t border-[var(--border-subtle)] pt-4">
            <p className="text-sm text-[var(--text-tertiary)]">
              {clubDepositValue > 0
                ? "Esta seña aplica a todas las canchas de tu club."
                : "Todavía no configuraste la seña de tu club. Hasta que la configures, se cobra el 100% del turno por Mercado Pago al confirmar."}
            </p>
            <form action={updateClubDeposit} className="space-y-3">
              <input type="hidden" name="club_id" value={mainClubId} />
              <ClubDepositFields defaultDepositType={clubDepositType} defaultDepositValue={clubDepositValue} />
              <button type="submit" className={adminCTAPrimary}>
                Guardar
              </button>
            </form>
          </div>
        </details>
      ) : null}

      {ctx.clubs.length > 0 ? (
        <NewCourtForm clubs={ctx.clubs} ownerUserId={ctx.userId} />
      ) : (
        <p className={`${adminCard} text-sm font-medium text-amber-800`}>
          Necesitás un club asignado para crear canchas.
        </p>
      )}

      {courts.length === 0 ? (
        <p className={adminEmptyState}>
          Todavía no tenés canchas. Creá la primera con el formulario de arriba.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {courts.map((c) => (
            <li key={c.id} className={adminCard}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL pública storage
                    <img src={c.image_url} alt={c.name ?? "Cancha"} className="h-20 w-20 rounded-xl object-cover ring-1 ring-[var(--border-subtle)]" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-lg font-bold text-[var(--text-secondary)]">
                      {(c.name ?? "C").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-xl font-bold text-[var(--text-primary)]">{c.name ?? "Cancha"}</p>
                    <p className="text-base font-semibold text-[#0461C4]">${c.price ?? 0}/turno</p>
                    <p className="mt-1">
                      {blockedCourtIds.has(c.id) ? (
                        <span className={adminBadgeError}>🔴 Bloqueada hoy</span>
                      ) : (
                        <span className={adminBadgeLima}>🟢 Disponible</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                      {getPriceSummary(c.id)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--text-tertiary)]">
                    {c.surface ? c.surface : "Superficie no definida"} · {c.indoor ? "Techada" : "Descubierta"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link href={`/admin/canchas/${c.id}/horarios`} className={adminButtonSecondary}>
                    Precios
                  </Link>
                </div>
              </div>
              <details className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-transparent p-4">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className={adminButtonSecondary}>Editar</span>
                </summary>
                <form action={updateCourt} className="mt-3 space-y-3">
                  <input type="hidden" name="court_id" value={c.id} />
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={c.name ?? ""}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                  />
                  <input
                    name="price"
                    type="number"
                    min={0}
                    required
                    defaultValue={c.price ?? 0}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                  />
                  <select
                    name="surface"
                    defaultValue={c.surface ?? "cemento"}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-secondary)]"
                  >
                    <option value="cemento">Cemento</option>
                    <option value="cristal">Cristal</option>
                    <option value="cesped sintetico">Césped sintético</option>
                    <option value="moqueta">Moqueta</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                    <input type="checkbox" name="indoor" defaultChecked={Boolean(c.indoor)} className="h-4 w-4 rounded border-[var(--border-subtle)]" />
                    Techada
                  </label>
                  <CourtImageUploader courtId={c.id} initialUrl={c.image_url ?? ""} label="Imagen de cancha" />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className={adminCTAPrimary}>
                      Guardar cambios
                    </button>
                    <button
                      type="submit"
                      formAction={deleteCourt}
                      name="court_id"
                      value={c.id}
                      className="rounded-xl border border-rose-300 bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                    >
                      Eliminar
                    </button>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
