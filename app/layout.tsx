import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import CapacitorNativeAuthCallback from "@/components/capacitor-native-auth-callback";
import CapacitorOfflineBanner from "@/components/capacitor-offline-banner";
import CapacitorSplashHide from "@/components/capacitor-splash";
import CapacitorStatusBarInit from "@/components/capacitor-status-bar";
import CapacitorExternalLinks from "@/components/capacitor-external-links";
import CapacitorSupabaseRefresh from "@/components/capacitor-supabase-refresh";

import { ThemeProvider } from "@/components/theme-provider";
import { STATUS_BAR_COLOR } from "@/lib/status-bar-color";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: “PadeLibre - Reserva canchas y arma partidos de padel”,
  description:
    “Reserva canchas, arma partidos y encontra jugadores de padel cerca tuyo. La app de padel argentina.”,
  keywords:
    “padel, reservar cancha de padel, padel Argentina, jugadores de padel, torneos de padel”,
  alternates: {
    canonical: “https://www.padelibre.online”,
  },
  manifest: “/manifest.json”,
  appleWebApp: {
    capable: true,
    title: “PadeLibre”,
    statusBarStyle: “black-translucent”,
  },
  openGraph: {
    title: “PadeLibre - Reserva canchas y arma partidos de padel”,
    description: “Reserva canchas, arma partidos y encontra jugadores de padel cerca tuyo.”,
    url: “https://www.padelibre.online”,
    siteName: “PadeLibre”,
    locale: “es_AR”,
    type: “website”,
    images: [
      {
        url: “https://www.padelibre.online/og-image.png”,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: “summary_large_image”,
    title: “PadeLibre - Reserva canchas y arma partidos de padel”,
    description: “Reserva canchas, arma partidos y encontra jugadores de padel cerca tuyo.”,
    images: [“https://www.padelibre.online/og-image.png”],
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
  interactiveWidget: "resizes-content",
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
      className={`${inter.variable} h-full w-full max-w-full antialiased`}
    >
      <head>
        <link rel="canonical" href="https://www.padelibre.online" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var ua=navigator.userAgent||"";if(/Capacitor|cordova|ionic/i.test(ua)||location.protocol==="capacitor:"||location.protocol==="ionic:"){document.documentElement.classList.add("capacitor-native")}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full w-full max-w-full [overflow-x:clip]">
        <CapacitorStatusBarInit />
        <CapacitorNativeAuthCallback />
        <CapacitorOfflineBanner />
        <CapacitorSplashHide />
        <CapacitorExternalLinks />
        <CapacitorSupabaseRefresh />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

