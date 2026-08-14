"use client";

import { useState } from "react";

export default function DashboardClubLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const publicUrl = `padelibre.online/${slug}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`https://${publicUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // portapapeles no disponible, sin acción
    }
  }

  return (
    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
      <span>🔗 Tu link: {publicUrl}</span>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="font-semibold text-[#0085FC] hover:underline"
      >
        {copied ? "¡Copiado!" : "Copiar"}
      </button>
    </p>
  );
}
