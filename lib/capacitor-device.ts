import { Capacitor } from "@capacitor/core";
import { isIosIpadUserAgent } from "@/lib/ios-ipad";

export { isIosIpadUserAgent };

export function isIosIpadBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIosIpadUserAgent(navigator.userAgent);
}

export function isCapacitorIosIpad(): boolean {
  if (typeof window === "undefined") return false;
  if (!Capacitor.isNativePlatform()) return false;
  if (Capacitor.getPlatform() !== "ios") return false;
  return isIosIpadBrowser();
}
