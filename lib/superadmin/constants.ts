/** Emails con acceso al panel superadmin (debe coincidir con filas en `superadmins`). */
export const SUPERADMIN_EMAILS = new Set(
  ["valentinoperalta03@gmail.com", "soporte.padelibre@gmail.com"].map((e) => e.toLowerCase())
);

/** Nunca loguear ni exponer este valor. Debe estar seteado en env (local y Vercel). */
export const SUPERADMIN_PIN = process.env.SUPERADMIN_PIN ?? "";

export const SUPERADMIN_COOKIE = "padelibre_superadmin";
