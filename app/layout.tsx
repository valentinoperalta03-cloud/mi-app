import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Padelibre — Reservá tu cancha de pádel",
  description:
    "La app para reservar canchas, crear partidos y encontrar jugadores de pádel en Argentina.",
  keywords: [
    "pádel",
    "padel argentina",
    "reservar cancha de pádel",
    "partidos de pádel",
    "Padelibre",
    "turnos de pádel",
  ],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Padelibre",
  },
  openGraph: {
    title: "Padelibre — La comunidad de pádel más grande de Argentina",
    description: "Reservá, jugá y conectá. Todo en un solo lugar.",
    url: "https://padelibre.app",
    siteName: "Padelibre",
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        alt: "Padelibre — Reservá, jugá y conectá",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Padelibre",
    description: "Digitalizando el pádel en Argentina.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
      { url: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/logo.png", type: "image/png" }],
    shortcut: ["/logo.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <body suppressHydrationWarning className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
