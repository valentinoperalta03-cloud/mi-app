"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Share2 } from "lucide-react";

type WhatsappShareButtonProps = {
  fallbackPath: string;
  sharePath: string;
  shareText: string;
};

export default function WhatsappShareButton({ fallbackPath, sharePath, shareText }: WhatsappShareButtonProps) {
  void sharePath;

  async function handleShare() {
    const pageUrl =
      typeof window !== "undefined" && window.location?.href
        ? window.location.href
        : fallbackPath;
    const hasUrlInText = /https?:\/\/\S+/.test(shareText);
    const message = hasUrlInText ? shareText : `${shareText} ${pageUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: whatsappUrl });
    } else {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(5,133,252,0.3)] transition hover:brightness-95 active:scale-[0.98]"
      style={{ background: "var(--color-brand-gradient)" }}
    >
      <Share2 size={16} strokeWidth={2.1} aria-hidden />
      Compartir por WhatsApp
    </button>
  );
}
