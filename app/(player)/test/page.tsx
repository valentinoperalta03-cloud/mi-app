import Link from "next/link";

export default function TestPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 px-4 py-6">
      <h1 className="text-xl font-semibold text-slate-900">Pagina de prueba</h1>
      <p className="text-sm text-slate-600">
        Esta ruta confirma que el boton de Ver detalles navega correctamente.
      </p>
      <Link
        href="/"
        className="inline-block rounded-2xl bg-[#0085FC]/50 px-4 py-2 text-sm font-semibold text-white"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
