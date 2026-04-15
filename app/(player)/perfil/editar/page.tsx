import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { EditProfileForm } from "@/components/edit-profile-form";
import { DB_TABLES } from "@/lib/db-tables";
import { formatProfileNivelFromRow } from "@/lib/profile-display";
import { createClient } from "@/utils/supabase/server";

export default async function EditarPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("name, age, bio, avatar_url, level_of_play, technical_score")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = profile as {
    name?: string | null;
    age?: number | null;
    bio?: string | null;
    avatar_url?: string | null;
    level_of_play?: string | null;
    technical_score?: number | null;
  } | null;

  const emailLocal = user.email?.split("@")[0] ?? "Jugador";
  const defaultName = row?.name?.trim() || emailLocal;
  const competitiveLevelLine = formatProfileNivelFromRow(row);

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md bg-gradient-to-b from-slate-50 to-white px-4 pb-28 pt-6">
      <header className="mb-6 space-y-1">
        <p className="text-sm font-medium text-sky-600">Perfil</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Editar perfil</h1>
        <p className="text-sm text-slate-500">
          La foto se sube a Supabase desde tu dispositivo; al guardar solo enviamos la URL pública.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
        <EditProfileForm
          userId={user.id}
          defaultName={defaultName}
          defaultAge={row?.age ?? null}
          defaultBio={row?.bio ?? null}
          defaultAvatarUrl={row?.avatar_url ?? null}
          competitiveLevelLine={competitiveLevelLine}
        />
      </section>
    </MotionPage>
  );
}
