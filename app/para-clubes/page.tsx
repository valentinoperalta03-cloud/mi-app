import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import ParaClubesClient from "./para-clubes-client";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "PadeLibre para clubes — Gestioná tu club de pádel",
  description:
    "Reservas, torneos, entrenamientos, jugadores y finanzas desde una sola plataforma. Empezá con 15 días de prueba gratis.",
  alternates: {
    canonical: "https://www.padelibre.online/para-clubes",
  },
  openGraph: {
    title: "PadeLibre para clubes",
    description: "Organizá tu club de pádel desde un solo lugar y dedicate a hacerlo crecer.",
    url: "https://www.padelibre.online/para-clubes",
  },
};

export default function ParaClubesPage() {
  return (
    <div className={spaceGrotesk.variable}>
      <ParaClubesClient />
    </div>
  );
}
