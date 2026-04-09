"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import MotionPage from "@/components/motion-page";

const tournaments = [
  {
    title: "Torneo Primavera 2025",
    club: "Padel Club Centro",
    date: "Sab 12 Abr",
    level: "Intermedio",
    price: "$5.000",
    pairs: "12/16 parejas",
    status: "Inscripcion abierta",
  },
  {
    title: "Liga Nocturna",
    club: "Arena Padel",
    date: "Todos los viernes",
    level: "Todos",
    price: "$3.500",
    pairs: "8/8 parejas",
    status: "Completo",
  },
  {
    title: "Copa Principiantes",
    club: "Top Padel Sports",
    date: "Dom 20 Abr",
    level: "Principiante",
    price: "$4.000",
    pairs: "6/12 parejas",
    status: "Inscripcion abierta",
  },
];

export default function PartidosPage() {
  const listVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.24 } },
  };

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <p className="text-sm font-medium text-sky-500">Inicio</p>
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">Competir</h1>
      <p className="text-sm font-light text-slate-500">Torneos y competencias de padel</p>

      <motion.section variants={listVariants} initial="hidden" animate="show" className="space-y-3">
        {tournaments.map((item) => (
          <motion.article
            key={item.title}
            variants={itemVariants}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-sky-200 hover:shadow-lg"
          >
            <div className="flex items-center gap-4">
              <Image
                src="/club-thumb.svg"
                alt="Torneo"
                width={64}
                height={64}
                className="h-16 w-16 rounded-2xl object-cover"
              />
              <div className="flex-1">
                <h2 className="text-xl font-bold tracking-tight text-slate-950">{item.title}</h2>
                <p className="text-sm font-light text-slate-500">{item.club}</p>
              </div>
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                {item.status}
              </span>
            </div>
            <p className="mt-2 text-sm font-light text-slate-500">
              {item.date} - {item.level}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-3xl font-bold tracking-tight text-slate-950">{item.price}</p>
              <Link
                href="/reservas"
                className="rounded-2xl px-3 py-2 text-sm font-medium text-sky-600 transition-all duration-300 hover:opacity-95 active:scale-95"
              >
                Ver
              </Link>
            </div>
            <p className="mt-1 text-sm font-light text-slate-500">{item.pairs}</p>
          </motion.article>
        ))}
      </motion.section>
    </MotionPage>
  );
}
