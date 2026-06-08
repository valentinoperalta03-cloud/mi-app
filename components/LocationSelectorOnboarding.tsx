"use client";

import { motion } from "framer-motion";
import { LocationSelector } from "@/components/location-selector";
import type { LocationSelection } from "@/lib/location-data";

export function LocationSelectorOnboarding({
  onLocationSelect,
}: {
  onLocationSelect: (location: LocationSelection) => void;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center px-6 pb-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div
          className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-sky-400"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Tu zona
        </div>
        <h2
          className="mb-3 text-[26px] font-extrabold leading-tight tracking-tight text-white"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          ¿Dónde jugás
          <br />
          pádel?
        </h2>
        <p className="mb-6 text-[15px] leading-relaxed text-white/55">
          Elegí tu ciudad para ver clubes y partidos disponibles cerca tuyo.
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
        <LocationSelector variant="onboarding" onLocationSelect={onLocationSelect} />
      </motion.div>
    </div>
  );
}
