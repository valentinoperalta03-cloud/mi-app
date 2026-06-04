import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import MotionPage from "@/components/motion-page";
import { PlayerStackHeader } from "@/components/player-back-button";
import { DB_TABLES } from "@/lib/db-tables";
import { PRACTICE_MODALITY_OPTIONS } from "@/lib/practice-constants";
import { practiceTotalPrice } from "@/lib/practice-pricing";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClasesPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from(DB_TABLES.practiceSessions)
    .select(
      "id, session_date, start_time, practices!inner(id, title, modality, max_spots, price_base, level_min, level_max, status, clubs(name, logo_url))"
    )
    .eq("status", "open")
    .eq("practices.status", "open")
    .gte("session_date", today)
    .order("session_date", { ascending: true });

  const list = ((rows ?? []) as unknown as Array<{
    id: string;
    session_date: string;
    start_time: string;
    practices: {
      id: string;
      title: string;
      modality: string;
      max_spots: number;
      price_base: number;
      status?: string;
      clubs: { name: string | null; logo_url: string | null } | { name: string | null; logo_url: string | null }[] | null;
    };
  }>);

  const sessionIds = list.map((r) => r.id);
  const { data: counts } = sessionIds.length
    ? await supabase
        .from(DB_TABLES.practiceRegistrations)
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("payment_status", "approved")
    : { data: [] };
  const countMap = new Map<string, number>();
  for (const c of (counts ?? []) as { session_id: string }[]) {
    countMap.set(c.session_id, (countMap.get(c.session_id) ?? 0) + 1);
  }

  return (
    <MotionPage className="mx-auto min-h-screen w-full min-w-0 max-w-md overflow-x-hidden bg-[var(--bg-app)] px-4 pb-28 pt-6">
      <PlayerStackHeader
        backHref="/home"
        backLabel="Volver al inicio"
        title="Clases"
        subtitle="Entrenamientos y prácticas en clubes."
      />

      <ul className="min-w-0 space-y-4">
        {list.length === 0 ? (
          <li className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-10 text-center text-sm text-[var(--text-tertiary)]">
            No hay clases publicadas por ahora.
          </li>
        ) : null}
        {list.map((row) => {
          const p = row.practices!;
          const clubPack = p.clubs;
          const club = Array.isArray(clubPack) ? clubPack[0] : clubPack;
          const dt = parseISO(`${row.session_date}T${String(row.start_time).slice(0, 5)}:00`);
          const approved = countMap.get(row.id) ?? 0;
          const full = approved >= p.max_spots;
          const modality = PRACTICE_MODALITY_OPTIONS.find((o) => o.value === p.modality)?.label ?? p.modality;
          const total = practiceTotalPrice(Number(p.price_base));

          return (
            <li key={row.id}>
              <Link
                href={`/clases/${row.id}`}
                className="block min-w-0 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-sm transition active:scale-[0.99]"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  {club?.name ?? "Club"}
                </p>
                <h2 className="mt-1 break-words text-lg font-bold text-[var(--text-primary)]">{p.title}</h2>
                <p className="mt-2 text-sm capitalize text-[var(--text-secondary)]">
                  {format(dt, "EEEE d MMM · HH:mm", { locale: es })}
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {modality} · {approved}/{p.max_spots} cupos · ${total.toLocaleString("es-AR")}
                  {full ? " · Completa" : ""}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </MotionPage>
  );
}
