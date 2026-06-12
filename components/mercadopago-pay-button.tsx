"use client";

import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

interface Props {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Botón que abre el checkout de Mercado Pago.
 * En nativo: Browser.open() (SFSafariViewController / Chrome Custom Tab).
 * En web: abre en nueva pestaña.
 * Cuando MP redirige al back_url de padelibre.online, el Universal Link
 * cierra el panel y vuelve a la app automáticamente.
 */
export function MercadoPagoPayButton({ href, className, style, children }: Props) {
  async function handleClick() {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: href });
    } else {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <button type="button" onClick={() => void handleClick()} className={className} style={style}>
      {children}
    </button>
  );
}
