"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

type Props = {
  clubWhatsapp: string;
  message: string;
};

export function ConfirmTransferWhatsappButton({ clubWhatsapp, message }: Props) {
  async function handleOpen() {
    const url = `https://wa.me/${clubWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleOpen()}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
    >
      Confirmar transferencia al club
    </button>
  );
}
