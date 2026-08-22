"use client";

import { X } from "lucide-react";
import { adminCard } from "@/components/admin/admin-premium";
import AddCoachForm from "./add-coach-form";
import ClaseForm from "./clase-form";

type Court = { id: string; name: string };
type Coach = { id: string; name: string };

export default function ClasePublicaInline({
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
    <div className={adminCard}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-admin-display text-lg font-bold text-[var(--text-primary)]">
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

      <AddCoachForm clubId={clubId} />
      <ClaseForm
        clubId={clubId}
        courts={courts}
        coaches={coaches}
        onSuccess={onClose}
      />
    </div>
  );
}
