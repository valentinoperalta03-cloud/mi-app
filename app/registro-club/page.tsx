import Image from "next/image";
import Link from "next/link";
import CapacitorShellReady from "@/components/capacitor-shell-ready";
import RegistroClubForm from "./registro-club-form";

export default function RegistroClubPage() {
  return (
    <main
      className="relative isolate flex min-h-dvh flex-col overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #0C1829 0%, #0A2540 100%)" }}
    >
      <CapacitorShellReady />
      <div className="h-0.5 w-full shrink-0 bg-[#CCFF00]" />
      <div className="flex flex-1 flex-col justify-center px-4 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-[480px] px-4">
          <div className="flex flex-col items-center">
            <Image src="/logo.png" alt="PadeLibre" width={40} height={40} className="rounded-xl" priority />
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">PadeLibre</p>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_25px_70px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-10">
            <div className="mb-8 flex flex-col items-center text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white">Registrá tu club</h1>
              <p className="mt-2 text-sm font-medium text-white/55">15 días gratis, sin tarjeta hasta que la actives</p>
            </div>

            <RegistroClubForm />

            <p className="mt-6 text-center text-sm text-white/50">
              <Link href="/login" className="font-semibold text-[#0085FC] hover:underline">
                Volver al inicio de sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
