import { ARGENTINA_PROVINCES } from "@/lib/argentina-provinces";

export type LocationSelection = {
  country: string;
  province: string;
  city: string;
};

export type LatamCountry = {
  code: string;
  name: string;
  provinces: {
    code: string;
    name: string;
    cities: readonly string[] | string[];
  }[];
};

export const LOCATION_DATA = {
  countries: [
    {
      code: "AR",
      name: "Argentina",
      provinces: ARGENTINA_PROVINCES,
    },
  ],
} as const;

/** Alias usado por los selectores de ubicación. */
export const LATAM_COUNTRIES: LatamCountry[] = LOCATION_DATA.countries.map((country) => ({
  code: country.code,
  name: country.name,
  provinces: country.provinces.map((province) => ({
    code: province.code,
    name: province.name,
    cities: [...province.cities],
  })),
}));

export const DEFAULT_USER_LOCATION: LocationSelection = {
  country: "Argentina",
  province: "Santa Fe",
  city: "rosario",
};

export function findCountryByName(name: string) {
  return LATAM_COUNTRIES.find((c) => c.name === name) ?? null;
}

export function findProvinceByName(countryName: string, provinceName: string) {
  const country = findCountryByName(countryName);
  return country?.provinces.find((p) => p.name === provinceName) ?? null;
}

/** Intenta inferir país/provincia desde un texto de ciudad guardado en BD. */
export function inferLocationFromCity(cityRaw: string | null | undefined): LocationSelection | null {
  const cityNorm = (cityRaw ?? "").trim().toLowerCase();
  if (!cityNorm) return null;

  for (const country of LATAM_COUNTRIES) {
    for (const province of country.provinces) {
      const match = province.cities.find((c) => c.toLowerCase() === cityNorm);
      if (match) {
        return {
          country: country.name,
          province: province.name,
          city: match.toLowerCase(),
        };
      }
    }
  }

  return {
    country: "Argentina",
    province: "Santa Fe",
    city: cityNorm,
  };
}
