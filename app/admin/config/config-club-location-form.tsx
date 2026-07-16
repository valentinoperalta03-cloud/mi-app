"use client";

import { useMemo, useState } from "react";
import { adminCTAPrimary } from "@/components/admin/admin-premium";
import { saveClubLocation } from "../club/actions";
import { LocationSelector } from "@/components/location-selector";
import { inferLocationFromCity, type LocationSelection } from "@/lib/location-data";
import { formatCityLabel } from "@/lib/locations";

type Props = {
  initial: {
    location: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
  };
};

export default function ConfigClubLocationForm({ initial }: Props) {
  const initialLocation = useMemo(
    () =>
      inferLocationFromCity(initial.city ?? initial.location) ?? {
        country: initial.country ?? "Argentina",
        province: initial.province ?? "",
        city: initial.city ?? "",
      },
    [initial.city, initial.country, initial.location, initial.province]
  );
  const [clubLocation, setClubLocation] = useState<LocationSelection | null>(initialLocation);

  return (
    <form action={saveClubLocation} className="space-y-4">
      <LocationSelector initial={initialLocation} onLocationSelect={setClubLocation} />
      <input type="hidden" name="country" value={clubLocation?.country ?? ""} />
      <input type="hidden" name="province" value={clubLocation?.province ?? ""} />
      <input type="hidden" name="city" value={clubLocation?.city ?? ""} />
      <input
        type="hidden"
        name="location"
        value={clubLocation?.city ? formatCityLabel(clubLocation.city) : initial.location ?? ""}
      />
      <button type="submit" className={adminCTAPrimary}>
        Guardar ubicación
      </button>
    </form>
  );
}
