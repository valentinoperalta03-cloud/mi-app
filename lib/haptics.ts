import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

function isNativePlatform(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

async function impact(style: ImpactStyle): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    await Haptics.impact({ style });
  } catch {
    // Haptics no disponible en este dispositivo o plataforma
  }
}

export async function lightTap(): Promise<void> {
  await impact(ImpactStyle.Light);
}

export async function mediumTap(): Promise<void> {
  await impact(ImpactStyle.Medium);
}

export async function heavyTap(): Promise<void> {
  await impact(ImpactStyle.Heavy);
}
