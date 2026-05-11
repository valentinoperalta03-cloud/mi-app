import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { addExceptionToFixedSlot, deleteFixedSlot } from "./actions";
import TurnosFijosForm from "./turnos-form";

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

export default async function AdminTurnosFijosPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: slotsRaw } = ctx.clubIds.length
    ? await supabase
        .from(DB_TABLES.fixedSlots)
        .select("id,club_id,court_id,day_of_week,start_time,duration_minutes,is_active,created_at")
        .in("club_id", ctx.clubIds)
        .eq("is_active", true)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true })
    : { data: [] };
  const slots = (slotsRaw ?? []) as Array<{
    id: string;
    club_id: string;
    court_id: string;
    day_of_week: number;
    start_time: string;
    duration_minutes: number;
    is_active: boolean;
    created_at: string;
  }>;

  const slotIds = slots.map((s) => s.id);
  const { data: slotPlayersRaw } = slotIds.length
    ? await supabase
        .from(DB_TABLES.fixedSlotPlayers)
        .select("fixed_slot_id,player_id")
        .in("fixed_slot_id", slotIds)
    : { data: [] };
  const slotPlayers = (slotPlayersRaw ?? []) as Array<{
    fixed_slot_id: string;
    player_id: string;
  }>;

  const playerIds = Array.from(new Set(slotPlayers.map((p) => p.player_id)));
  const { data: profilesData } = playerIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", playerIds)
    : { data: [] };
  const profileNameById = new Map(
    (profilesData ?? []).map((p: { user_id: string; name: string | null }) => [p.user_id, p.name ?? "Jugador"])
  );

  const playersBySlot = new Map<string, Array<{ playerId: string; name: string }>>();
  for (const p of slotPlayers) {
    const list = playersBySlot.get(p.fixed_slot_id) ?? [];
    list.push({
      playerId: p.player_id,
      name: profileNameById.get(p.player_id) ?? "Jugador",
    });
    playersBySlot.set(p.fixed_slot_id, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0585FC]`}>Operacion semanal</p>
        <h1 className={adminTitle}>Turnos fijos</h1>
        <p className={adminSubtitle}>Configurá turnos semanales por cancha y asigná jugadores.</p>
      </header>

      <section className={adminCard}>
        <h2 className="mb-3 text-base font-bold text-slate-900">Agregar turno fijo</h2>
        <TurnosFijosForm courts={ctx.courts.map((c) => ({ id: c.id, name: c.name }))} />
      </section>

      <section className={adminCard}>
        <h2 className="mb-4 text-base font-bold text-slate-900">Turnos activos</h2>
        {slots.length === 0 ? (
          <p className="text-sm text-slate-500">Todavia no hay turnos fijos configurados.</p>
        ) : (
          <ul className="space-y-3">
            {slots.map((slot) => {
              const players = playersBySlot.get(slot.id) ?? [];
              const courtName = ctx.courts.find((c) => c.id === slot.court_id)?.name ?? "Cancha";
              return (
                <li key={slot.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {DAY_LABELS[slot.day_of_week] ?? "Dia"} · {String(slot.start_time).slice(0, 5)} · {slot.duration_minutes} min
                      </p>
                      <p className="text-xs text-slate-500">{courtName}</p>
                    </div>
                    <form action={deleteFixedSlot}>
                      <input type="hidden" name="fixed_slot_id" value={slot.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                      >
                        Desactivar
                      </button>
                    </form>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3">
                    <div className="space-y-2">
                      {Array.from({ length: 2 }, (_, i) => {
                        const player = players[i];
                        if (!player) {
                          return (
                            <div
                              key={`${slot.id}-left-empty-${i}`}
                              className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500"
                            >
                              Libre
                            </div>
                          );
                        }
                        return (
                          <div key={`${slot.id}-${player.playerId}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                            <span className="font-semibold text-slate-800">{player.name}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex h-full items-center justify-center pt-4">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold tracking-wide text-slate-500">
                        VS
                      </span>
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: 2 }, (_, i) => {
                        const player = players[i + 2];
                        if (!player) {
                          return (
                            <div
                              key={`${slot.id}-right-empty-${i}`}
                              className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500"
                            >
                              Libre
                            </div>
                          );
                        }
                        return (
                          <div key={`${slot.id}-${player.playerId}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                            <span className="font-semibold text-slate-800">{player.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <form action={addExceptionToFixedSlot} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="fixed_slot_id" value={slot.id} />
                    <label className="text-xs font-semibold text-slate-600">
                      Fecha excepción
                      <input name="exception_date" type="date" required className="mt-1 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Motivo
                      <input name="reason" placeholder="Opcional" className="mt-1 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                    </label>
                    <button type="submit" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                      Agregar excepción
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
