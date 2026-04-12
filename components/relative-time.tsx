"use client";

import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useState } from "react";

/**
 * Evita hydration mismatch: el texto relativo solo se calcula en el cliente (useEffect),
 * no en el primer render del servidor vs cliente.
 */
export function RelativeTime({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(
      formatDistanceToNow(parseISO(iso), {
        addSuffix: true,
        locale: es,
      })
    );
  }, [iso]);

  return (
    <span className={className} suppressHydrationWarning>
      {label ?? "\u00a0"}
    </span>
  );
}
