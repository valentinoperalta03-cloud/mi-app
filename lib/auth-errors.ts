/** Mensajes claros en español para errores típicos de Supabase Auth. */
export function formatAuthErrorMessage(raw: string): string {
  const m = raw.toLowerCase();

  if (
    m.includes("invalid login credentials") ||
    m.includes("invalid_credentials")
  ) {
    return "Credenciales inválidas. Revisá tu email y contraseña.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirmá tu email antes de iniciar sesión. Revisá tu bandeja (y spam) o pedí un código nuevo.";
  }
  if (m.includes("user already registered")) {
    return "Ese email ya está registrado. Iniciá sesión o pedí un código nuevo abajo.";
  }
  if (m.includes("password should be at least")) {
    return "La contraseña no cumple los requisitos de seguridad.";
  }
  if (m.includes("signup requires a valid password")) {
    return "La contraseña no es válida.";
  }
  if (m.includes("invalid email")) {
    return "El formato del email no es válido.";
  }
  if (m.includes("rate limit") || m.includes("too many requests")) {
    return "Demasiados intentos. Esperá unos minutos y volvé a intentar.";
  }
  if (m.includes("otp_expired") || m.includes("expired")) {
    return "El código expiró. Pedí uno nuevo con «Reenviar código».";
  }
  if (m.includes("otp") && (m.includes("invalid") || m.includes("incorrect"))) {
    return "Código incorrecto. Revisá los 6 dígitos o pedí uno nuevo.";
  }
  if (m.includes("redirect_uri_mismatch") || m.includes("redirect uri")) {
    return "Error de configuración OAuth (redirect). Contactá soporte si persiste.";
  }
  if (
    m.includes("disallowed_useragent") ||
    m.includes("doesn't comply with google") ||
    m.includes("secure browsers")
  ) {
    return "Google no permite iniciar sesión en este navegador integrado. Usá email y contraseña o actualizá la app.";
  }
  if (m.includes("access_denied") || m.includes("user_cancelled")) {
    return "Inicio con Google cancelado.";
  }
  if (m.includes("code challenge") || m.includes("code verifier") || m.includes("pkce")) {
    return "La sesión de login expiró. Cerrá la app, volvé a abrirla e intentá de nuevo.";
  }
  if (m.includes("error sending confirmation email") || m.includes("smtp")) {
    return "No pudimos enviar el email. Intentá de nuevo en unos minutos o contactá soporte.";
  }
  if (m.includes("signup disabled")) {
    return "El registro está deshabilitado temporalmente.";
  }

  return raw;
}
