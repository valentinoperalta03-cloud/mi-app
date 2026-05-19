import { createClubAction } from "@/app/superadmin/actions";

export default function CreateClubForm() {
  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/40 to-slate-900/60 p-6">
      <h2 className="text-lg font-bold text-white">Alta de club</h2>
      <p className="mt-1 text-sm text-slate-400">
        Creá un club y asignalo al email del dueño (usuario registrado en la app).
      </p>
      <form action={createClubAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Nombre del club
          <input
            name="name"
            required
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="Ej. Padel Club Norte"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ciudad / ubicación
          <input
            name="location"
            required
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="Ej. Rosario, Santa Fe"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
          Email del dueño (owner)
          <input
            name="owner_email"
            type="email"
            required
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="dueño@email.com"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
          Descripción (opcional)
          <textarea
            name="description"
            rows={2}
            className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="Breve descripción del club"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            Dar de alta
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" name="is_active" value="1" defaultChecked className="rounded" />
            Club activo al crear
          </label>
        </div>
      </form>
    </section>
  );
}
