"use client";

import { Share2 } from "lucide-react";

type WhatsappShareButtonProps = {
  fallbackPath: string;
  sharePath: string;
  shareText: string;
};

export default function WhatsappShareButton({ fallbackPath, sharePath, shareText }: WhatsappShareButtonProps) {
  void sharePath;

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

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-brand-mid)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-95 active:scale-[0.98] sm:w-auto"
    >
      <Share2 size={16} strokeWidth={2.1} aria-hidden />
      Compartir por WhatsApp
    </button>
  );
}
