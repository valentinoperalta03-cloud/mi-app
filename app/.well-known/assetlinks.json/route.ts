export const dynamic = "force-static";

// SHA-256 obtenido de: Google Play Console → tu app → Release → Setup →
// App signing → "App signing key certificate" → SHA-256 certificate fingerprint.
// Reemplazá el valor de abajo con el tuyo y hacé un nuevo deploy.
const ANDROID_SHA256 = "REEMPLAZAR_CON_TU_SHA256_DE_GOOGLE_PLAY_CONSOLE";

export function GET() {
  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.padelibre.app",
        sha256_cert_fingerprints: [ANDROID_SHA256],
      },
    },
  ];

  return Response.json(assetlinks, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
