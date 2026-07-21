"use client";

import { useState } from "react";
import {
  activateClubSubscriptionAction,
  extendClubTrialAction,
  markClubPastDueAction,
  resetClubToPendingAction,
} from "@/app/superadmin/actions";

export default function SubscriptionActionsForm({ clubId }: { clubId: string }) {
  const [days, setDays] = useState("15");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <form
        action={activateClubSubscriptionAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              "¿Activar la suscripción manualmente? El club pasa a 'active' y el próximo cobro queda fijado a 30 días."
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="club_id" value={clubId} />
        <button
          type="submit"
          className="w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
        >
          Activar manualmente
        </button>
      </form>

      <form
        action={extendClubTrialAction}
        onSubmit={(e) => {
          if (!window.confirm(`¿Extender el trial ${days || 0} días?`)) {
            e.preventDefault();
          }
        }}
        className="flex gap-2"
      >
        <input type="hidden" name="club_id" value={clubId} />
        <input
          type="number"
          name="days"
          min={1}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-20 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <button
          type="submit"
          className="flex-1 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-500/20"
        >
          Extender trial
        </button>
      </form>

      <form
        action={markClubPastDueAction}
        onSubmit={(e) => {
          if (!window.confirm("¿Marcar el club como pago fallido (past_due)? Es para testing.")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="club_id" value={clubId} />
        <button
          type="submit"
          className="w-full rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/20"
        >
          Marcar como past_due
        </button>
      </form>

      <form
        action={resetClubToPendingAction}
        onSubmit={(e) => {
          if (
            !window.confirm(
              "¿Resetear a pending? El dueño va a tener que cargar la tarjeta de nuevo para reactivar el club."
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="club_id" value={clubId} />
        <button
          type="submit"
          className="w-full rounded-xl border border-slate-500/40 bg-slate-500/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-500/20"
        >
          Resetear a pending
        </button>
      </form>
    </div>
  );
}
