"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { EditMatchFormProps } from "./edit-match-form";

const EditMatchForm = dynamic(() => import("./edit-match-form").then((m) => m.default), {
  loading: () => (
    <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
      Cargando editor…
    </p>
  ),
  ssr: false,
});

type PartidoEditSectionProps = {
  isOwner: boolean;
  canEdit: boolean;
  blockedMessage: string;
  formProps: Omit<EditMatchFormProps, "onCancel">;
};

export default function PartidoEditSection({
  isOwner,
  canEdit,
  blockedMessage,
  formProps,
}: PartidoEditSectionProps) {
  const [open, setOpen] = useState(false);

  if (!isOwner) {
    return null;
  }

  if (!canEdit) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        {blockedMessage}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
      >
        {open ? "Cerrar edición" : "Editar partido"}
      </button>
      {open ? <EditMatchForm {...formProps} onCancel={() => setOpen(false)} /> : null}
    </div>
  );
}
