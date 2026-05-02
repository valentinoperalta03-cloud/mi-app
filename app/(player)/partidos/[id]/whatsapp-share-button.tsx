"use client";

import { Copy, Share2 } from "lucide-react";
import { useState } from "react";

type WhatsappShareButtonProps = {
  fallbackPath: string;
  sharePath: string;
  shareText: string;
};

export default function WhatsappShareButton({ fallbackPath, sharePath, shareText }: WhatsappShareButtonProps) {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    const pageUrl =
      typeof window !== "undefined" && window.location?.href
        ? window.location.href
        : fallbackPath;
    const hasUrlInText = /https?:\/\/\S+/.test(shareText);
    const message = hasUrlInText ? shareText : `${shareText} ${pageUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    if (typeof window !== "undefined") {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sharePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-brand-mid)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-95 active:scale-[0.98]"
      >
        <Share2 size={16} strokeWidth={2.1} aria-hidden />
        Compartir por WhatsApp
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#0585FC] bg-transparent px-4 py-2.5 text-sm font-semibold text-[#0585FC] transition-all duration-200 hover:bg-[#0585FC]/5 active:scale-[0.98]"
      >
        <Copy size={16} strokeWidth={2.1} aria-hidden />
        {copied ? "¡Copiado!" : "Copiar enlace"}
      </button>
    </div>
  );
}
