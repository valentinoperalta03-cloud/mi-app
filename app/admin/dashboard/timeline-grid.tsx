import { minutesToClock } from "@/lib/court-slots";
import NowLine from "./now-line";

const BASE_UNIT_PX = 40;
const COLUMN_MIN_WIDTH = 104;
const TIME_AXIS_WIDTH = 46;
const CLOSED_COLOR = "#B91C1C";

export type TimelineEventKind = "reserva" | "turno_fijo" | "entrenamiento" | "partido_abierto";

export type TimelineEvent = {
  id: string;
  courtId: string;
  startMin: number;
  durationMin: number;
  kind: TimelineEventKind;
  label: string;
};

export type TimelineOpenRange = { startMin: number; endMin: number };

export type TimelineCourt = { id: string; name: string };

// verde = turno fijo, azul = reserva, morado = entrenamiento, lima = partido
// abierto, rojo = cerrado (línea fina, ver closedGapsForCourt).
const KIND_STYLE: Record<TimelineEventKind, { bg: string; border: string; color: string }> = {
  turno_fijo: { bg: "rgba(34,197,94,0.15)", border: "#22C55E", color: "#15803D" },
  reserva: { bg: "rgba(0,133,252,0.15)", border: "#0085FC", color: "#0461C4" },
  entrenamiento: { bg: "rgba(139,92,246,0.15)", border: "#8B5CF6", color: "#6D28D9" },
  partido_abierto: { bg: "rgba(204,255,0,0.15)", border: "#CCFF00", color: "#5A6B00" },
};

// Prioridad de renderizado cuando dos eventos coinciden en el mismo horario:
// reserva/partido abierto > turno fijo > entrenamiento (se dibujan en ese
// orden para que la reserva quede arriba visualmente, sin necesitar z-index
// explícito).
const KIND_PRIORITY: Record<TimelineEventKind, number> = {
  entrenamiento: 0,
  turno_fijo: 1,
  reserva: 2,
  partido_abierto: 2,
};

export function TimelineLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-[var(--text-secondary)]">
      <LegendSwatch bg={KIND_STYLE.turno_fijo.bg} border={KIND_STYLE.turno_fijo.border} label="Turno fijo" />
      <LegendSwatch bg={KIND_STYLE.reserva.bg} border={KIND_STYLE.reserva.border} label="Reserva" />
      <LegendSwatch bg={KIND_STYLE.entrenamiento.bg} border={KIND_STYLE.entrenamiento.border} label="Entrenamiento" />
      <LegendSwatch bg={KIND_STYLE.partido_abierto.bg} border={KIND_STYLE.partido_abierto.border} label="Partido abierto" />
      <LegendSwatch bg="transparent" border={CLOSED_COLOR} label="Cerrado" />
    </div>
  );
}

function closedGapsForCourt(
  ranges: TimelineOpenRange[],
  gridStartMin: number,
  gridEndMin: number
): TimelineOpenRange[] {
  const sorted = ranges.slice().sort((a, b) => a.startMin - b.startMin);
  const gaps: TimelineOpenRange[] = [];
  let cursor = gridStartMin;
  for (const r of sorted) {
    const s = Math.max(r.startMin, gridStartMin);
    const e = Math.min(r.endMin, gridEndMin);
    if (s > cursor) gaps.push({ startMin: cursor, endMin: Math.min(s, gridEndMin) });
    cursor = Math.max(cursor, e);
  }
  if (cursor < gridEndMin) gaps.push({ startMin: cursor, endMin: gridEndMin });
  return gaps;
}

function LegendSwatch({ bg, border, label }: { bg: string; border: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className="h-3 w-3 shrink-0 rounded-[3px] border"
        style={{ background: bg, borderColor: border, borderWidth: bg === "transparent" ? 1 : 0, borderLeftWidth: 3 }}
      />
      <span>{label}</span>
    </div>
  );
}

export default function TimelineGrid({
  courts,
  openRangesByCourtId,
  events,
}: {
  courts: TimelineCourt[];
  openRangesByCourtId: Record<string, TimelineOpenRange[]>;
  events: TimelineEvent[];
}) {
  if (courts.length === 0) {
    return <p className="text-sm text-[var(--text-tertiary)]">Todavía no tenés canchas configuradas.</p>;
  }

  const allRanges = courts.flatMap((c) => openRangesByCourtId[c.id] ?? []);
  const minOpen = allRanges.length ? Math.min(...allRanges.map((r) => r.startMin)) : 9 * 60;
  const maxClose = allRanges.length ? Math.max(...allRanges.map((r) => r.endMin)) : 22 * 60 + 30;
  const gridStartMin = Math.floor(minOpen / 60) * 60;
  // Sin buffer extra: el grid termina exactamente en el cierre más tardío
  // (redondeado hacia arriba a la hora), nunca más allá. Un buffer de +90min
  // acá era lo que antes empujaba el cierre a la madrugada del día siguiente
  // cuando algún club cierra a "23:59"/medianoche (se normaliza a 1440min).
  const gridEndMin = Math.max(Math.ceil(maxClose / 60) * 60, gridStartMin + 60);
  const totalHeightPx = ((gridEndMin - gridStartMin) / 60) * BASE_UNIT_PX;

  const hourTicks: number[] = [];
  for (let t = gridStartMin; t <= gridEndMin; t += 60) hourTicks.push(t);

  const pxFor = (min: number) => ((min - gridStartMin) / 60) * BASE_UNIT_PX;

  return (
    <div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: TIME_AXIS_WIDTH + courts.length * COLUMN_MIN_WIDTH }}>
          <div className="flex">
            <div style={{ width: TIME_AXIS_WIDTH }} className="shrink-0" />
            {courts.map((c) => (
              <div
                key={c.id}
                className="min-w-0 flex-1 truncate px-1 pb-2 text-center text-xs font-semibold text-[var(--text-primary)]"
                style={{ minWidth: COLUMN_MIN_WIDTH }}
                title={c.name}
              >
                {c.name}
              </div>
            ))}
          </div>

          <div className="relative flex">
            <NowLine gridStartMin={gridStartMin} gridEndMin={gridEndMin} pxPerHour={BASE_UNIT_PX} axisWidth={TIME_AXIS_WIDTH} />

            <div className="relative shrink-0" style={{ width: TIME_AXIS_WIDTH, height: totalHeightPx }}>
              {hourTicks.map((t) => (
                <div
                  key={t}
                  className="absolute right-1.5 -translate-y-1/2 text-[10px] font-medium text-[var(--text-tertiary)]"
                  style={{ top: pxFor(t) }}
                >
                  {minutesToClock(t)}
                </div>
              ))}
            </div>

            {courts.map((c) => {
              const ranges = openRangesByCourtId[c.id] ?? [];
              const gaps = closedGapsForCourt(ranges, gridStartMin, gridEndMin);
              const courtEvents = events
                .filter((e) => e.courtId === c.id)
                .slice()
                .sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind]);

              return (
                <div
                  key={c.id}
                  className="relative min-w-0 flex-1 border-l border-[var(--border-subtle)]"
                  style={{ minWidth: COLUMN_MIN_WIDTH, height: totalHeightPx }}
                >
                  {/* Fondo "disponible": capa base visible en toda la columna. Los
                     bloques de cerrado y los eventos se dibujan encima y la tapan
                     donde corresponda — sin esto, un rango abierto sin eventos se
                     veía indistinguible de una cancha rota/sin datos. */}
                  <div className="absolute inset-0" style={{ background: "rgba(255,255,255,0.02)" }} />

                  {hourTicks.map((t) => (
                    <div
                      key={t}
                      className="absolute inset-x-0 border-t border-[var(--border-subtle)]/50"
                      style={{ top: pxFor(t) }}
                    />
                  ))}

                  {/* Cerrado: línea fina en el borde izquierdo en vez de un
                     bloque sólido — marca la franja sin dominar visualmente
                     la grilla compacta. */}
                  {gaps.map((g, i) => {
                    const heightPx = Math.max(pxFor(g.endMin) - pxFor(g.startMin) - 1, 0);
                    if (heightPx <= 0) return null;
                    return (
                      <div
                        key={`gap-${i}`}
                        className="absolute inset-x-0 flex items-center overflow-hidden pl-1.5 text-[9px] font-semibold"
                        style={{
                          top: pxFor(g.startMin),
                          height: heightPx,
                          borderLeft: `2px solid ${CLOSED_COLOR}`,
                          color: CLOSED_COLOR,
                          opacity: 0.75,
                        }}
                      >
                        {heightPx >= 16 ? "Cerrado" : ""}
                      </div>
                    );
                  })}

                  {courtEvents.map((ev) => {
                    const style = KIND_STYLE[ev.kind];
                    const heightPx = Math.max(pxFor(ev.startMin + ev.durationMin) - pxFor(ev.startMin) - 1, 12);
                    return (
                      <div
                        key={ev.id}
                        className="absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-0.5 text-[9px] font-semibold leading-tight"
                        style={{
                          top: pxFor(ev.startMin),
                          height: heightPx,
                          background: style.bg,
                          borderLeft: `3px solid ${style.border}`,
                          color: style.color,
                        }}
                        title={ev.label}
                      >
                        {ev.label}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
