"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import MotionPage from "@/components/motion-page";

const clubs = [
  { id: "1", name: "Top Padel Sports", address: "Av. Libertador 890", price: "$7.500/h", courts: "8 canchas", rating: "4.9" },
  { id: "2", name: "Padel Club Centro", address: "Av. Corrientes 1234", price: "$5.000/h", courts: "6 canchas", rating: "4.8" },
  { id: "3", name: "Arena Padel", address: "Calle Mitre 567", price: "$4.500/h", courts: "4 canchas", rating: "4.5" },
];

export default function ReservasPage() {
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
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">Reservar pista</h1>
      <p className="text-sm font-light text-slate-500">Encontra la cancha ideal cerca tuyo</p>

      <p className="text-sm font-light text-slate-500">{clubs.length} clubes encontrados</p>

      <motion.section variants={listVariants} initial="hidden" animate="show" className="space-y-3">
        {clubs.map((club) => (
          <motion.article
            key={club.name}
            variants={itemVariants}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-sky-200 hover:shadow-lg"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <Image
                  src="/club-thumb.svg"
                  alt="Club"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-950">{club.name}</h2>
                  <p className="text-sm font-light text-slate-500">{club.address}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-amber-500">{club.rating}</p>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight text-slate-950">{club.price}</p>
                <p className="text-sm font-light text-slate-500">{club.courts}</p>
              </div>
              <Link
                href={`/clubes/${club.id}`}
                className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-sky-500 active:scale-95"
              >
                Reservar
              </Link>
            </div>
          </motion.article>
        ))}
      </motion.section>
    </MotionPage>
  );
}
