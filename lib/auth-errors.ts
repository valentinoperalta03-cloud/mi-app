/** Mensajes claros en español para errores típicos de Supabase Auth. */
export function formatAuthErrorMessage(raw: string): string {
  const m = raw.toLowerCase();

  if (
    m.includes("invalid login credentials") ||
    m.includes("invalid_credentials")
  ) {
    return "Credenciales invalidas. Revisa tu email y contrasena.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirma tu email antes de iniciar sesion (revisa la bandeja de entrada).";
  }
  if (m.includes("user already registered")) {
    return "Ese email ya esta registrado. Inicia sesion o usa otro correo.";
  }
  if (m.includes("password should be at least")) {
    return "La contrasena no cumple los requisitos de seguridad.";
  }
  if (m.includes("signup requires a valid password")) {
    return "La contrasena no es valida.";
  }
  if (m.includes("invalid email")) {
    return "El formato del email no es valido.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
  }

  return raw;
}
