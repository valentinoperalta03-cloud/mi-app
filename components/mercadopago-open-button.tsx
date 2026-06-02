"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

export function MercadoPagoOpenButton() {
  async function handleOpen() {
    const url = "https://www.mercadopago.com.ar";
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
      className="mt-3 inline-flex w-full justify-center rounded-2xl bg-[#009EE3] px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
    >
      Abrir Mercado Pago
    </button>
  );
}
