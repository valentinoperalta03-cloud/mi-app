import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { unlockSuperadminPinAction } from "../actions";
import { SUPERADMIN_COOKIE } from "@/lib/superadmin/constants";
import { verifySuperadminSession } from "@/lib/superadmin/session-cookie";
import { getSuperadminUser } from "@/lib/superadmin/guards";

type PageProps = { searchParams?: Promise<{ error?: string }> };

export default async function SuperadminPinPage({ searchParams }: PageProps) {
  const user = await getSuperadminUser();
  if (!user) redirect("/login");

  const jar = await cookies();
  if (verifySuperadminSession(jar.get(SUPERADMIN_COOKIE)?.value, user.id)) {
    redirect("/superadmin");
  }

  const sp = searchParams ? await searchParams : {};
  const err = sp.error === "1";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-900/20 backdrop-blur">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-400/90">PadeLibre</p>
        <h1 className="mt-2 text-center text-2xl font-bold text-white">Acceso superadmin</h1>
        <p className="mt-2 text-center text-sm text-slate-400">Ingresá el PIN para continuar. Se guardará en una cookie de sesión segura.</p>
        {err ? (
          <p className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-center text-sm text-rose-200">
            PIN incorrecto.
          </p>
        ) : null}
        <form action={unlockSuperadminPinAction} className="mt-6 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            PIN
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-lg tracking-widest text-white outline-none ring-0 focus:border-cyan-500/50"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:brightness-110"
          >
            Desbloquear panel
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/home" className="text-cyan-400 hover:underline">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
