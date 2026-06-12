import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

/**
 * Abre una URL externa en el in-app browser (SFSafariViewController / Chrome Custom Tab)
 * en nativo, o navega en la misma pestaña en web.
 * Usar para flujos de pago (Mercado Pago) donde se espera volver a la app vía Universal Link.
 */
export async function nativeOpenUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
  } else {
    window.location.href = url;
  }
}
