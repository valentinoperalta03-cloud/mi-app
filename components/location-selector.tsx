"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LATAM_COUNTRIES,
  type LocationSelection,
  findCountryByName,
  findProvinceByName,
  inferLocationFromCity,
} from "@/lib/location-data";
import { normalizeCity } from "@/lib/locations";

type LocationSelectorProps = {
  onLocationSelect: (location: LocationSelection) => void;
  initial?: Partial<LocationSelection> | null;
  variant?: "default" | "onboarding";
  showSummary?: boolean;
};

const selectDefault =
  "w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-white [&_option]:bg-white [&_option]:dark:bg-slate-950";

const selectOnboarding =
  "w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-medium text-white backdrop-blur-md transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-50 [&_option]:bg-slate-900 [&_option]:text-white";

const labelDefault = "mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200";
const labelOnboarding = "mb-2 block text-sm font-semibold text-white/80";

export function LocationSelector({
  onLocationSelect,
  initial,
  variant = "default",
  showSummary = true,
}: LocationSelectorProps) {
  const inferred = useMemo(() => inferLocationFromCity(initial?.city), [initial?.city]);

  const [country, setCountry] = useState(initial?.country ?? inferred?.country ?? "");
  const [province, setProvince] = useState(initial?.province ?? inferred?.province ?? "");
  const [city, setCity] = useState(initial?.city ?? inferred?.city ?? "");

  const isOnboarding = variant === "onboarding";
  const selectClass = isOnboarding ? selectOnboarding : selectDefault;
  const labelClass = isOnboarding ? labelOnboarding : labelDefault;

  const provinces = useMemo(() => findCountryByName(country)?.provinces ?? [], [country]);
  const cities = useMemo(() => findProvinceByName(country, province)?.cities ?? [], [country, province]);

  useEffect(() => {
    if (!country || !province || !city) return;
    onLocationSelect({
      country,
      province,
      city: normalizeCity(city),
    });
  }, [country, province, city, onLocationSelect]);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={labelClass}>País</span>
        <select
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setProvince("");
            setCity("");
          }}
          className={selectClass}
        >
          <option value="">Seleccioná un país</option>
          {LATAM_COUNTRIES.map((c) => (
            <option key={c.code} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>Provincia / estado</span>
        <select
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            setCity("");
          }}
          disabled={!country}
          className={selectClass}
        >
          <option value="">Seleccioná una provincia</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>Ciudad</span>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          disabled={!province}
          className={selectClass}
        >
          <option value="">Seleccioná una ciudad</option>
          {cities.map((c) => (
            <option key={c} value={c.toLowerCase()}>
              {c}
            </option>
          ))}
        </select>
      </label>

      {showSummary && country && province && city ? (
        <div
          className={
            isOnboarding
              ? "mt-2 rounded-xl border border-sky-400/30 bg-sky-500/10 p-4"
              : "mt-2 rounded-lg border-l-4 border-sky-500 bg-sky-50 p-4 dark:border-sky-400 dark:bg-sky-900/20"
          }
        >
          <p className={isOnboarding ? "text-sm text-white/70" : "text-sm text-slate-600 dark:text-slate-300"}>
            Vas a ver clubes y partidos en{" "}
            <span className={isOnboarding ? "font-semibold text-white" : "font-semibold text-slate-900 dark:text-white"}>
              {city}, {province}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
