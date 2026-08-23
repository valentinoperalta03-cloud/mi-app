"use client";

import { useTransition } from "react";

/** Botón para acciones irreversibles: pide confirmación con window.confirm antes de llamar la server action. */
export function ConfirmActionButton({
  action,
  confirmText,
  label,
  pendingLabel = "Procesando…",
  className,
}: {
  action: () => Promise<void>;
  confirmText: string;
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(confirmText)) return;
    startTransition(() => {
      void action();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={className}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
