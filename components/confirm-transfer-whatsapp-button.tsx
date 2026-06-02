"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

type Props = {
  clubWhatsapp: string;
  message: string;
};

function formatArgentineWhatsapp(raw: string): string {
  // Limpiar todo excepto dígitos
  const digits = raw.replace(/\D/g, "");
  // Si ya tiene código de país (54...), usarlo directo
  if (digits.startsWith("54")) return digits;
  // Si empieza con 0 (ej: 0341...), sacar el 0 y agregar 549
  if (digits.startsWith("0")) return `549${digits.slice(1)}`;
  // Si es número local (ej: 3412591953), agregar 549
  return `549${digits}`;
}

export function ConfirmTransferWhatsappButton({ clubWhatsapp, message }: Props) {
  async function handleOpen() {
    const url = `https://wa.me/${formatArgentineWhatsapp(clubWhatsapp)}?text=${encodeURIComponent(message)}`;
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
