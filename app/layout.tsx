import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Padel App",
  description: "Reserva canchas y gestiona tus partidos de padel",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "FaltaUno",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}
