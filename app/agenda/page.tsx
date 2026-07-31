import Image from "next/image";
import type { Metadata } from "next";
import AgendaForm from "@/components/agenda/agenda-form";

export const metadata: Metadata = {
  title: "Agendá tu reunión | PadeLibre",
};

export default function AgendaPage() {
  return (
    <main className="min-h-screen bg-[#031733] px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="PadeLibre" width={32} height={32} className="rounded-xl" />
          <span className="text-base font-bold text-white">PadeLibre</span>
        </div>

        <h1 className="mt-8 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
          Agendá tu videollamada con el equipo de PadeLibre
        </h1>
        <p className="mt-3 text-base text-white/70">
          Contanos sobre tu club y elegí el horario que mejor te quede. Te enviamos el link de la reunión por
          email.
        </p>

        <div className="mt-8 w-full">
          <AgendaForm />
        </div>
      </div>
    </main>
  );
}
