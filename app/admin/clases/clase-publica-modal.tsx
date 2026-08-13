"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { adminCTAPrimary } from "@/components/admin/admin-premium";
import ClaseForm from "./clase-form";

type Court = { id: string; name: string };
type Coach = { id: string; name: string };

function ClasePublicaDialog({
  clubId,
  courts,
  coaches,
  onClose,
}: {
  clubId: string;
  courts: Court[];
  coaches: Coach[];
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-50 backdrop-blur-sm"
        style={{ background: "rgba(0,0,0,0.60)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed max-h-[90vh] overflow-y-auto shadow-2xl"
        style={{
          zIndex: 51,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(580px, 90vw)",
          background: "var(--bg-card)",
          borderRadius: 16,
          padding: 24,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clase-publica-title"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="clase-publica-title" className="font-admin-display text-lg font-bold text-[var(--text-primary)]">
            Nueva clase pública
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 cursor-pointer rounded-lg p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        <ClaseForm clubId={clubId} courts={courts} coaches={coaches} onSuccess={onClose} />
      </div>
    </>
  );
}

export default function ClasePublicaModal({
  clubId,
  courts,
  coaches,
}: {
  clubId: string;
  courts: Court[];
  coaches: Coach[];
}) {
  const [open, setOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDialogKey((k) => k + 1);
          setOpen(true);
        }}
        className={`inline-flex shrink-0 items-center gap-1.5 ${adminCTAPrimary}`}
      >
        <Plus size={16} />
        Publicar clase
      </button>

      {open ? (
        <ClasePublicaDialog key={dialogKey} clubId={clubId} courts={courts} coaches={coaches} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
