import { DB_TABLES } from "@/lib/db-tables";
import {
  DEFAULT_USER_LOCATION,
  type LocationSelection,
} from "@/lib/location-data";
import { createClient as createBrowserClient } from "@/utils/supabase/client";

export type { LocationSelection } from "@/lib/location-data";
export { DEFAULT_USER_LOCATION } from "@/lib/location-data";

export const DEFAULT_CITY = DEFAULT_USER_LOCATION.city;

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

export function formatCityLabel(city: string | null | undefined): string {
  const raw = (city ?? "").trim();
  if (!raw) return "Rosario";
  return raw
    .split(/[\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildLocationLabel(location: Pick<LocationSelection, "city" | "province" | "country">): string {
  return `${formatCityLabel(location.city)}, ${location.province}, ${location.country}`;
}

/** Cliente: guardar ubicación del usuario autenticado. */
export async function saveUserLocationToProfile(location: LocationSelection) {
  const supabase = createBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuario no autenticado");

  const city = normalizeCity(location.city || DEFAULT_CITY);

  const { error } = await supabase
    .from(DB_TABLES.profiles)
    .update({
      country: location.country || DEFAULT_USER_LOCATION.country,
      province: location.province || DEFAULT_USER_LOCATION.province,
      city,
      location: buildLocationLabel({ ...location, city }),
    })
    .eq("user_id", user.id);

  if (error) throw error;
  return { success: true as const, city };
}

/** Cliente: obtener ciudad del perfil (con default Rosario). */
export async function getUserCity(): Promise<string> {
  const supabase = createBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return DEFAULT_CITY;

  const { data: profile, error } = await supabase
    .from(DB_TABLES.profiles)
    .select("city")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return DEFAULT_CITY;
  const city = (profile as { city?: string | null } | null)?.city;
  return city?.trim() ? normalizeCity(city) : DEFAULT_CITY;
}

export function buildClubLocationPayload(location: LocationSelection) {
  const city = normalizeCity(location.city);
  return {
    country: location.country || DEFAULT_USER_LOCATION.country,
    province: location.province || DEFAULT_USER_LOCATION.province,
    city,
    location: formatCityLabel(city),
  };
}
