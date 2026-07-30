"use client";

import { useState } from "react";
import {
  deactivateClubAction,
  notifyClubOwnerAction,
  reactivateClubAction,
} from "@/app/superadmin/actions";
import DeleteClubForm from "@/components/superadmin/delete-club-form";

export default function ClubManagementActionsForm({
  clubId,
  clubName,
  isActive,
}: {
  clubId: string;
  clubName: string;
  isActive: boolean;
}) {
  const [message, setMessage] = useState("");
  const toggleAction = isActive ? deactivateClubAction : reactivateClubAction;
  const toggleLabel = isActive ? "Bajar club" : "Reactivar club";
  const toggleConfirm = isActive
    ? "¿Bajar este club? Se oculta de la app del jugador, pero no se borra ningún dato."
    : "¿Reactivar este club? Vuelve a estar visible en la app del jugador.";

  return (
    <div className="flex flex-col gap-4">
      <form
        action={notifyClubOwnerAction}
        onSubmit={(e) => {
          if (!message.trim()) {
            e.preventDefault();
            window.alert("Escribí un mensaje antes de enviarlo.");
          }
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="club_id" value={clubId} />
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Mensaje
          <textarea
            name="message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="Escribí el mensaje para el dueño del club"
          />
        </label>
        <button
          type="submit"
          className="w-fit rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-100 hover:bg-sky-500/20"
        >
          Notificar dueño
        </button>
      </form>

      <form
        action={toggleAction}
        onSubmit={(e) => {
          if (!window.confirm(toggleConfirm)) e.preventDefault();
        }}
      >
        <input type="hidden" name="club_id" value={clubId} />
        <button
          type="submit"
          className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
        >
          {toggleLabel}
        </button>
      </form>

      <div className="border-t border-white/10 pt-4">
        <p className="mb-3 text-xs text-slate-500">
          Eliminar borra de forma permanente canchas, reservas, partidos, torneos y chats asociados. No se puede deshacer.
        </p>
        <DeleteClubForm clubId={clubId} clubName={clubName} returnTo={`/superadmin/clubes/${clubId}`} />
      </div>
    </div>
  );
}
