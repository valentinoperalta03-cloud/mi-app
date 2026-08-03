import Image from "next/image";
import Link from "next/link";
import CapacitorShellReady from "@/components/capacitor-shell-ready";
import RegistroClubForm from "./registro-club-form";

export default function RegistroClubPage() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col justify-center overflow-y-auto bg-[#F2F2F7] px-4 py-10 dark:bg-black sm:py-14">
      <CapacitorShellReady />
      <div className="mx-auto w-full px-4 md:max-w-2xl">
        <div className="rounded-3xl border border-[var(--border-subtle)] bg-white p-8 shadow-[var(--shadow-card)] sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <Image src="/logo.png" alt="PadeLibre" width={56} height={56} className="rounded-2xl" />
            <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
              Registrá tu club
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              15 días gratis, sin tarjeta hasta que la actives
            </p>
          </div>

          <RegistroClubForm />

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            <Link href="/login" className="font-semibold text-[#0085FC] hover:underline dark:text-sky-400">
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
