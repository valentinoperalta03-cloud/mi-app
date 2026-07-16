"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { adminAccentBar, adminCTAPrimary, adminCard, adminKicker } from "@/components/admin/admin-premium";

type Court = { id: string; name: string };
type Match = {
  id: string;
  court_id: string;
  scheduled_time: string;
  duration_minutes: number;
  payment_status: string;
  owner_name: string;
  players: Array<{ name: string; player_id: string }>;
};
type Block = { court_id: string; start_time: string };

function timeSlots() {
  return Array.from({ length: 16 }, (_, i) => `${String(i + 8).padStart(2, "0")}:00`);
}

export default function AgendaScheduler({
  date,
  courts,
  matches,
  blocks,
}: {
  date: string;
  courts: Court[];
  matches: Match[];
  blocks: Block[];
}) {
  const hours = useMemo(() => timeSlots(), []);
  const [selected, setSelected] = useState<Match | null>(null);

  const matchKey = new Map(matches.map((m) => [`${m.court_id}__${m.scheduled_time}`, m]));
  const blockKey = new Set(blocks.map((b) => `${b.court_id}__${b.start_time}`));

  return (
    <>
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-sm">
        <div className="border-b border-[var(--border-subtle)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)]">
          Fecha: {date}
        </div>
        <div className="overflow-auto">
          <div className="min-w-[920px]">
            <div
              className="grid border-b border-[var(--border-subtle)] bg-[var(--bg-app)]"
              style={{ gridTemplateColumns: `88px repeat(${courts.length}, minmax(160px, 1fr))` }}
            >
              <div className={`px-3 py-3 ${adminKicker}`}>Hora</div>
              {courts.map((court) => (
                <div key={court.id} className="border-l border-[var(--border-subtle)] px-3 py-3 text-sm font-semibold text-[var(--text-secondary)]">
                  {court.name}
                </div>
              ))}
            </div>

            {hours.map((hour) => (
              <div
                key={hour}
                className="grid border-b border-[var(--border-subtle)]"
                style={{ gridTemplateColumns: `88px repeat(${courts.length}, minmax(160px, 1fr))` }}
              >
                <div className="px-3 py-3 text-xs font-semibold text-[var(--text-tertiary)]">{hour}</div>
                {courts.map((court) => {
                  const key = `${court.id}__${hour}`;
                  const match = matchKey.get(key) ?? null;
                  const isBlocked = blockKey.has(key);
                  if (match) {
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelected(match)}
                        className="m-1 rounded-xl border border-blue-500/20 bg-blue-100/70 px-3 py-2 text-left transition hover:shadow-md dark:border-blue-400/30 dark:bg-blue-900/30"
                      >
                        <p className="truncate text-xs font-semibold text-blue-700 dark:text-blue-300">{match.owner_name}</p>
                        <div className="mt-1">
                          <Badge variant={String(match.payment_status).toLowerCase() === "paid" ? "success" : "warning"}>
                            {String(match.payment_status).toLowerCase() === "paid" ? "Pagado" : "Pendiente"}
                          </Badge>
                        </div>
                      </button>
                    );
                  }
                  if (isBlocked) {
                    return (
                      <div
                        key={key}
                        className="m-1 rounded-xl border border-amber-300/60 bg-amber-100/70 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      >
                        Bloqueada
                      </div>
                    );
                  }
                  return (
                    <div
                      key={key}
                      className="m-1 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 py-2 text-xs font-medium text-[var(--text-tertiary)]"
                    >
                      Disponible
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className={`w-full max-w-md ${adminCard} ${adminAccentBar}`}>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Detalle de reserva</h3>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">{selected.scheduled_time}</p>
            <div className="mt-3">
              <Badge variant={String(selected.payment_status).toLowerCase() === "paid" ? "success" : "warning"}>
                {String(selected.payment_status).toLowerCase() === "paid" ? "Pago confirmado" : "Pago pendiente"}
              </Badge>
            </div>
            <p className="mt-4 text-sm font-semibold text-[var(--text-secondary)]">Jugadores</p>
            <ul className="mt-2 space-y-2">
              {selected.players.length === 0 ? (
                <li className="text-sm text-[var(--text-tertiary)]">Sin jugadores cargados.</li>
              ) : (
                selected.players.map((p) => (
                  <li key={p.player_id} className="rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                    {p.name}
                  </li>
                ))
              )}
            </ul>
            <button type="button" onClick={() => setSelected(null)} className={`mt-4 w-full ${adminCTAPrimary}`}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

