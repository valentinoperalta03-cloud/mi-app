import Link from "next/link";

export default function RootPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Padelibre</h1>
      <p className="text-lg text-muted-foreground">
        Reservá canchas de pádel, creá partidos y conectá con jugadores
      </p>
      <nav className="flex flex-col gap-3 text-base">
        <Link href="/login" className="underline underline-offset-4">
          Ir a login
        </Link>
        <Link href="/como-funciona" className="underline underline-offset-4">
          Cómo funciona
        </Link>
        <Link href="/legal/privacidad" className="underline underline-offset-4">
          Privacidad
        </Link>
      </nav>
    </main>
  );
}