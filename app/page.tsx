import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/utils/supabase/server";

async function signOutAction() {
  "use server";

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function HomePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error || !user) {
    redirect("/login");
  }

  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email ??
    "Jugador";
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-10">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between rounded-3xl border border-sky-100 bg-white p-6 shadow-xl shadow-sky-100/70">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Foto de perfil"
              width={48}
              height={48}
              className="h-12 w-12 rounded-full border border-sky-200 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-sky-200 bg-sky-100 text-sky-700">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="text-lg font-semibold text-sky-700">
            Bienvenido, {name}! Listo para jugar?
          </p>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
          >
            Cerrar Sesion
          </button>
        </form>
      </div>
    </main>
  );
}