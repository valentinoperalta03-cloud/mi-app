import Link from "next/link";

export default function LandingPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
    >
      <div className="w-full max-w-md text-center space-y-8">
        {/* Logo */}
        <div className="space-y-3">
          <div className="flex justify-center">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="30" fill="none" stroke="white" strokeWidth="3" />
              <path d="M10 24 Q32 20 54 24" stroke="white" strokeWidth="2.5" fill="none" />
              <path d="M10 32 Q32 28 54 32" stroke="white" strokeWidth="2.5" fill="none" />
              <path d="M10 40 Q32 36 54 40" stroke="white" strokeWidth="2.5" fill="none" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Padelibre</h1>
          <p className="text-white/80 text-lg">La app de pádel de Argentina</p>
        </div>

        {/* Description */}
        <div className="bg-white/10 rounded-3xl p-6 space-y-4 text-left">
          <p className="text-white font-semibold text-lg">¿Qué es Padelibre?</p>
          <p className="text-white/80 text-sm leading-relaxed">
            Padelibre es una aplicación móvil y web para reservar canchas de pádel, crear partidos,
            encontrar jugadores de tu nivel y conectarte con la comunidad de pádel en Argentina.
          </p>
          <ul className="space-y-2 text-sm text-white/80">
            <li>🎾 Reservá canchas en segundos</li>
            <li>👥 Creá y unite a partidos</li>
            <li>📊 Medí tu nivel de juego</li>
            <li>🏆 Competí y mejorá</li>
          </ul>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full rounded-2xl bg-white py-4 text-center text-base font-bold text-[#0585FC] shadow-lg transition hover:bg-white/90"
          >
            Ingresar a Padelibre
          </Link>
          <Link
            href="/como-funciona"
            className="block w-full rounded-2xl border border-white/30 py-4 text-center text-base font-semibold text-white transition hover:bg-white/10"
          >
            Cómo funciona
          </Link>
        </div>

        {/* Footer links */}
        <div className="flex justify-center gap-6 text-xs text-white/60">
          <Link href="/legal/privacidad" className="hover:text-white">
            Política de privacidad
          </Link>
          <Link href="/legal/terminos" className="hover:text-white">
            Términos de uso
          </Link>
        </div>
      </div>
    </main>
  );
}