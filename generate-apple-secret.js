/**
 * Genera el Secret Key (JWT) para Sign in with Apple en Supabase.
 *
 * Uso:
 *   node generate-apple-secret.js ./AuthKey_HQ68N33264.p8
 *
 * Pegá el JWT en Supabase → Authentication → Providers → Apple → Secret Key.
 * Apple permite un máximo de 6 meses de validez; regeneralo antes de que expire.
 */

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const TEAM_ID = "4M247SD7H6";
const KEY_ID = "HQ68N33264";
const CLIENT_ID = "com.padelibre.app.signin";
const APPLE_AUDIENCE = "https://appleid.apple.com";
/** ~6 meses (máximo permitido por Apple). */
const EXPIRATION_SECONDS = 15777000;

const p8Arg = process.argv[2];

if (!p8Arg) {
  console.error("Uso: node generate-apple-secret.js ./AuthKey_HQ68N33264.p8");
  process.exit(1);
}

const p8Path = path.resolve(process.cwd(), p8Arg);

if (!fs.existsSync(p8Path)) {
  console.error(`No se encontró el archivo: ${p8Path}`);
  process.exit(1);
}

const privateKey = fs.readFileSync(p8Path, "utf8");

if (!privateKey.includes("BEGIN PRIVATE KEY")) {
  console.error("El archivo no parece una clave .p8 válida.");
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);

const token = jwt.sign(
  {
    iss: TEAM_ID,
    iat: now,
    exp: now + EXPIRATION_SECONDS,
    aud: APPLE_AUDIENCE,
    sub: CLIENT_ID,
  },
  privateKey,
  {
    algorithm: "ES256",
    keyid: KEY_ID,
  }
);

console.log("\n--- Apple Secret Key (JWT) ---\n");
console.log(token);
console.log("\n--- Fin ---");
console.log(`Válido hasta: ${new Date((now + EXPIRATION_SECONDS) * 1000).toISOString()}`);
console.log("No subas el archivo .p8 al repositorio.\n");
