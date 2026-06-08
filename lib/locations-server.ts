import { DB_TABLES } from "@/lib/db-tables";
import { DEFAULT_USER_LOCATION, type LocationSelection } from "@/lib/location-data";
import { DEFAULT_CITY, normalizeCity } from "@/lib/locations";
import { createClient } from "@/utils/supabase/server";

export async function getUserCityServer(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return DEFAULT_CITY;

  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("city")
    .eq("user_id", user.id)
    .maybeSingle();

  const city = (profile as { city?: string | null } | null)?.city;
  return city?.trim() ? normalizeCity(city) : DEFAULT_CITY;
}

export async function getUserLocationServer(): Promise<LocationSelection> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return DEFAULT_USER_LOCATION;

  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("country, province, city")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = profile as { country?: string | null; province?: string | null; city?: string | null } | null;
  if (!row?.city?.trim()) return DEFAULT_USER_LOCATION;

  return {
    country: row.country?.trim() || DEFAULT_USER_LOCATION.country,
    province: row.province?.trim() || DEFAULT_USER_LOCATION.province,
    city: normalizeCity(row.city),
  };
}
