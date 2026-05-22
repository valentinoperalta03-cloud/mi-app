import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import CapacitorSplashHide from "@/components/capacitor-splash";
import CapacitorStatusBarInit from "@/components/capacitor-status-bar";
import { ThemeProvider } from "@/components/theme-provider";
import { STATUS_BAR_COLOR } from "@/lib/status-bar-color";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PadeLibre — Que organizar no sea un problema.",
  description:
    "Reservá canchas, armá partidos y encontrá jugadores de pádel cerca tuyo. La app de pádel argentina.",
  keywords:
    "pádel, reservar cancha de pádel, pádel Argentina, jugadores de pádel, torneos de pádel",
  alternates: {
    canonical: "https://www.padelibre.online",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Padelibre",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "PadeLibre — Que organizar no sea un problema.",
    description: "Reservá canchas, armá partidos y encontrá jugadores de pádel cerca tuyo.",
    url: "https://www.padelibre.online",
    siteName: "PadeLibre",
    locale: "es_AR",
    type: "website",
    images: [
      {
        url: "https://www.padelibre.online/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PadeLibre — Que organizar no sea un problema.",
    description: "Reservá canchas, armá partidos y encontrá jugadores de pádel cerca tuyo.",
    images: ["https://www.padelibre.online/og-image.png"],
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
    { media: "(prefers-color-scheme: light)", color: STATUS_BAR_COLOR },
    { media: "(prefers-color-scheme: dark)", color: STATUS_BAR_COLOR },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
      <head>
        <link rel="canonical" href="https://www.padelibre.online" />
      </head>
      <body suppressHydrationWarning className="min-h-full">
        <CapacitorStatusBarInit />
        <CapacitorSplashHide />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
