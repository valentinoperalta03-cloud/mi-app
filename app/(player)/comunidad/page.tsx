import MotionPage from "@/components/motion-page";
import { ComunidadAnimatedHub } from "@/components/comunidad-animated-hub";

export default function ComunidadPage() {
  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-8 bg-slate-50 px-4 pb-24 pt-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-sky-600">Comunidad</p>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">Tu espacio social</h1>
        <p className="text-sm text-slate-500">
          Todo lo que necesitás para conectar con otros jugadores.
        </p>
      </header>

      <ComunidadAnimatedHub />
    </MotionPage>
  );
}
