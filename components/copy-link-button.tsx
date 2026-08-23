"use client";

import { useState } from "react";

export function CopyLinkButton({
  url,
  label = "🔗 Copiar link del torneo",
  className,
}: {
  url: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {copied ? "✓ ¡Link copiado!" : label}
    </button>
  );
}
