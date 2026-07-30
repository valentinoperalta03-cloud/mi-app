"use client";

import { deleteClubAction } from "@/app/superadmin/actions";

type Props = {
  clubId: string;
  clubName: string;
  returnTo?: string;
  variant?: "detail" | "inline";
};

export default function DeleteClubForm({ clubId, clubName, returnTo, variant = "detail" }: Props) {
  const label = variant === "inline" ? "Eliminar" : "Eliminar club permanentemente";

  return (
    <form
      action={deleteClubAction}
      onSubmit={(e) => {
        const step1 = window.confirm(
          `¿Estás seguro que querés eliminar "${clubName}"? Esta acción es irreversible.\n\nSe borrarán canchas, reservas, partidos, torneos y datos asociados.`
        );
        if (!step1) {
          e.preventDefault();
          return;
        }
        const typed = window.prompt(`Escribí el nombre del club para confirmar: ${clubName}`);
        if (typed !== clubName) {
          window.alert("El nombre no coincide. Se canceló la eliminación.");
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="club_id" value={clubId} />
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      <button
        type="submit"
        className={
          variant === "inline"
            ? "rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
            : "rounded-xl border border-rose-500/50 bg-rose-950/50 px-4 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/20"
        }
      >
        {label}
      </button>
    </form>
  );
}
