import BottomNav from "@/components/bottom-nav";
import { createClient } from "@/utils/supabase/server";

const profileActions = [
  "Mi Progresion",
  "Editar perfil",
  "Ver actividad",
  "Pagos",
  "Ajustes",
];

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "Invitado sin sesion";

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-slate-100 px-4 pb-24 pt-6">
      <section className="ui-card p-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-500 text-3xl font-bold text-white">
          {(email[0] ?? "U").toUpperCase()}
        </div>
        <h1 className="mt-4 text-4xl font-extrabold text-slate-900">Tu perfil</h1>
        <p className="mt-1 text-sm text-slate-500">{email}</p>
        <div className="mx-auto mt-3 w-fit rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-blue-600">
          7ma - Intermedio bajo
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-3">
        {[
          ["0", "Partidos"],
          ["-", "Racha"],
          ["0", "Rivales"],
        ].map(([value, label]) => (
          <article key={label} className="ui-card p-5 text-center">
            <p className="text-3xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500">{label}</p>
          </article>
        ))}
      </section>

      <section className="mt-4 space-y-3">
        {profileActions.map((item) => (
          <button
            key={item}
            type="button"
            className="ui-card ui-interactive flex w-full items-center justify-between p-5 text-left"
          >
            <span className="text-lg font-semibold text-slate-900">{item}</span>
            <span className="text-slate-400">›</span>
          </button>
        ))}
      </section>

      <BottomNav />
    </main>
  );
}
