import type { ReactNode } from "react";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import AdminShell from "@/components/admin/admin-shell";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-ibm-plex-mono",
});

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
