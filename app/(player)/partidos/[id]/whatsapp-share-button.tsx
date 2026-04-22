"use client";

import { Share2 } from "lucide-react";

type WhatsappShareButtonProps = {
  fallbackPath: string;
  shareText: string;
};

export default function WhatsappShareButton({ fallbackPath, shareText }: WhatsappShareButtonProps) {
  function handleShare() {
    const pageUrl =
      typeof window !== "undefined" && window.location?.href
        ? window.location.href
        : fallbackPath;
    const message = `${shareText} ${pageUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    if (typeof window !== "undefined") {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-brand-mid)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-95 active:scale-[0.98]"
    >
      <Share2 size={16} strokeWidth={2.1} aria-hidden />
      Compartir por WhatsApp
    </button>
  );
}
