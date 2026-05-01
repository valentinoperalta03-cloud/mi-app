import Image from "next/image";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminCard, adminKicker, adminPressable, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type PageProps = {
  searchParams: Promise<{ status?: string; message?: string }>;
};

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function createClubOnboardingAction(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const nombre = getField(formData, "nombre");
  const direccion = getField(formData, "direccion");
  const ciudad = getField(formData, "ciudad");
  const descripcion = getField(formData, "descripcion");
  const telefono = getField(formData, "telefono");
  const horario = getField(formData, "horario");
  const fotoUrl = getField(formData, "foto_url");

  if (!nombre || !direccion || !ciudad || !descripcion || !telefono || !horario || !fotoUrl) {
    redirect(
      "/admin/gestion/onboarding?status=error&message=Completa%20todos%20los%20campos%20requeridos."
    );
  }

  const location = `${direccion}, ${ciudad}`;
  const payload = {
    name: nombre,
    location,
    owner_id: user.id,
    description: descripcion,
    contact_phone: telefono,
    opening_hours: horario,
    photo_url: fotoUrl,
  };

  const { error } = await supabase.from(DB_TABLES.clubs).insert(payload);

  if (error) {
    const encodedError = encodeURIComponent(`No se pudo guardar el club: ${error.message}`);
    redirect(`/admin/gestion/onboarding?status=error&message=${encodedError}`);
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/gestion/onboarding");
  redirect("/admin/gestion/onboarding?status=ok&message=Club%20registrado%20con%20exito.");
}

export default async function ClubOnboardingPage({ searchParams }: PageProps) {
  const { status, message } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className={`${adminCard} relative overflow-hidden`}>
        <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-[#0585FC]/10/70 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className={adminKicker}>Onboarding</p>
            <h1 className={adminTitle}>Alta de nuevo club</h1>
            <p className={adminSubtitle}>
              Completa la información inicial del club para dejar su operación lista.
            </p>
          </div>
          <div className="relative h-14 w-40 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90">
            <Image src="/logo.png" alt="Logo de marca" fill className="object-contain p-2 opacity-85" />
          </div>
        </div>
      </header>

      {message ? (
        <p
          className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${
            status === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {message}
        </p>
      ) : null}

      <section className={adminCard}>
        <form action={createClubOnboardingAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="nombre" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre del club
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              required
              placeholder="Ej: Padel Norte Club"
              className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="direccion" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Direccion completa
            </label>
            <input
              id="direccion"
              name="direccion"
              type="text"
              required
              placeholder="Ej: Av. Libertador 1234"
              className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ciudad" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Ciudad
            </label>
            <input
              id="ciudad"
              name="ciudad"
              type="text"
              required
              placeholder="Ej: Buenos Aires"
              className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="descripcion" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Descripcion del club
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              required
              rows={4}
              placeholder="Conta brevemente que ofrece tu club, servicios y propuesta."
              className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="telefono" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Telefono de contacto
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              required
              placeholder="Ej: +54 11 1234-5678"
              className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="horario" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Horario de atencion general
            </label>
            <input
              id="horario"
              name="horario"
              type="text"
              required
              placeholder="Ej: Lun a Dom de 08:00 a 23:00"
              className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="foto_url" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Foto del club (URL)
            </label>
            <input
              id="foto_url"
              name="foto_url"
              type="text"
              required
              placeholder="https://..."
              className="w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className={`w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 ${adminPressable}`}
            >
              Guardar club
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
