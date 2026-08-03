"use client";

import {
  addExceptionToFixedSlot,
  deleteFixedSlot,
  markFixedSlotAttendanceToday,
} from "@/app/admin/turnos-fijos/actions";
import { adminBadgeDanger, adminBadgeSuccess, adminBadgeWarning, adminCard } from "@/components/admin/admin-premium";

export type TodayFixedSlotCard = {
  id: string;
  title: string;
  courtName: string;
  time: string;
  matchId: string | null;
  players: Array<{ playerId: string; name: string }>;
  allConfirmed: boolean;
  excepted: boolean;
  todayYmd: string;
};

export default function FixedSlotTodayCard({ card }: { card: TodayFixedSlotCard }) {
  return (
    <div className={`${adminCard} ${card.excepted ? "opacity-50" : card.allConfirmed ? "border-emerald-400/60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold text-[var(--text-primary)]">{card.title}</p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {card.courtName} · {card.time}hs
          </p>
          {card.players.length > 0 ? (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{card.players.map((p) => p.name).join(", ")}</p>
          ) : (
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Sin jugadores asignados</p>
          )}
        </div>

        {card.excepted ? (
          <span className="text-xs font-semibold text-[var(--text-tertiary)]">Liberado hoy</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <form action={markFixedSlotAttendanceToday}>
              <input type="hidden" name="match_id" value={card.matchId ?? ""} />
              <button
                type="submit"
                disabled={!card.matchId || card.allConfirmed}
                className={`${adminBadgeSuccess} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                ✓ Vinieron
              </button>
            </form>
            <form
              action={addExceptionToFixedSlot}
              onSubmit={(e) => {
                if (!confirm("¿No vienen hoy? Se libera la cancha por hoy.")) e.preventDefault();
              }}
            >
              <input type="hidden" name="fixed_slot_id" value={card.id} />
              <input type="hidden" name="exception_date" value={card.todayYmd} />
              <button type="submit" className={adminBadgeWarning}>
                ✗ No vienen hoy
              </button>
            </form>
            <form
              action={deleteFixedSlot}
              onSubmit={(e) => {
                if (!confirm("¿Dar de baja este turno fijo? Se cancelan todos los partidos futuros.")) e.preventDefault();
              }}
            >
              <input type="hidden" name="fixed_slot_id" value={card.id} />
              <button type="submit" className={adminBadgeDanger}>
                Dar de baja
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
