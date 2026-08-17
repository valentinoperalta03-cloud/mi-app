"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { adminCTAPrimary } from "@/components/admin/admin-premium";
import { updateClubServices } from "./actions";

export const SERVICES_CATALOG = [
  { key: "cancha_techada", emoji: "🏠", label: "Complejo techado" },
  { key: "filmacion", emoji: "🎥", label: "Filmación de partidos" },
  { key: "parrilla", emoji: "🔥", label: "Parrilla" },
  { key: "cobertura_medica", emoji: "🏥", label: "Cobertura médica" },
  { key: "estacionamiento", emoji: "🅿️", label: "Estacionamiento" },
  { key: "venta_pelotas", emoji: "🎾", label: "Venta de pelotas" },
  { key: "pelotas_prestadas", emoji: "🎾", label: "Pelotas prestadas" },
  { key: "paletas_prestadas", emoji: "🏓", label: "Paletas prestadas" },
  { key: "alquiler_paletas", emoji: "🏓", label: "Alquiler de paletas" },
  { key: "venta_grips", emoji: "🔧", label: "Venta de grips" },
  { key: "venta_indumentaria", emoji: "👕", label: "Venta de indumentaria" },
  { key: "vestuarios", emoji: "🚿", label: "Vestuarios con duchas" },
  { key: "wifi", emoji: "📶", label: "WiFi" },
  { key: "buffet", emoji: "🍔", label: "Bar / Buffet" },
  { key: "pro_shop", emoji: "🛍️", label: "Pro shop" },
  { key: "cumpleanos", emoji: "🎂", label: "Eventos y cumpleaños" },
  { key: "aire_acondicionado", emoji: "❄️", label: "Aire acondicionado" },
  { key: "acceso_discapacidad", emoji: "♿", label: "Acceso para discapacitados" },
  { key: "guardarropa", emoji: "👜", label: "Guardarropa" },
  { key: "gimnasio", emoji: "💪", label: "Gimnasio" },
] as const;

type Props = {
  clubId: string;
  defaultServices: string[];
};

export default function ServiciosForm({ clubId, defaultServices }: Props) {
  const [selected, setSelected] = useState<string[]>(defaultServices);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateClubServices(clubId, selected);
    setSaving(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.error ?? "Error al guardar");
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--text-tertiary)]">
        {selected.length} servicio{selected.length !== 1 ? "s" : ""} seleccionado{selected.length !== 1 ? "s" : ""}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SERVICES_CATALOG.map((service) => (
          <button
            key={service.key}
            type="button"
            onClick={() => toggle(service.key)}
            className={`relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
              selected.includes(service.key)
                ? "border-[var(--admin-accent-lima)] bg-[var(--admin-accent-lima-subtle)]"
                : "border-[var(--admin-card-border)] bg-[var(--admin-card-bg)] hover:border-[var(--admin-card-border-hover)]"
            }`}
          >
            <span className="text-2xl">{service.emoji}</span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{service.label}</span>
            {selected.includes(service.key) ? (
              <span className="absolute right-3 top-3">
                <Check size={14} className="text-[var(--admin-accent-lima)]" />
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p> : null}

      <button type="button" onClick={handleSave} disabled={saving} className={adminCTAPrimary}>
        {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar servicios"}
      </button>
    </div>
  );
}
