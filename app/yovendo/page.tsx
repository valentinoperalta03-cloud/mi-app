import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import YoVendoClient from "./yovendo-client";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Vendé PadeLibre — Ganá $100.000 por club",
  description:
    "Programa de vendedores de PadeLibre. Sin límite de clubes. 100% a comisión. Unite al equipo.",
  openGraph: {
    title: "Vendé PadeLibre — Ganá $100.000 por club",
    description: "Sin límite de clubes. 100% a resultados.",
  },
};

export default function YoVendoPage() {
  return (
    <div className={spaceGrotesk.variable}>
      <YoVendoClient />
    </div>
  );
}
