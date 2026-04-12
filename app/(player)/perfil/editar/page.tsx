import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { EditProfileForm } from "@/components/edit-profile-form";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export default async function EditarPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("avatar_url, category")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = profile as { avatar_url?: string | null; category?: string | null } | null;

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md bg-gradient-to-b from-slate-50 to-white px-4 pb-28 pt-6">
      <header className="mb-6 space-y-1">
        <p className="text-sm font-medium text-sky-600">Perfil</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Editar perfil</h1>
        <p className="text-sm text-slate-500">Foto y categoría inicial.</p>
      </header>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
        <EditProfileForm
          defaultAvatarUrl={row?.avatar_url ?? null}
          defaultCategory={row?.category ?? null}
        />
      </section>
    </MotionPage>
  );
}
