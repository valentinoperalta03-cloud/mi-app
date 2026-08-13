import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { EditProfileForm } from "@/components/edit-profile-form";
import { DB_TABLES } from "@/lib/db-tables";
import { formatPlayerCategory } from "@/lib/profile-display";
import { createClient } from "@/utils/supabase/server";

export default async function EditarPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("name, age, bio, avatar_url, category, gender, preferred_hand, court_position, preferred_schedule")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = profile as {
    name?: string | null;
    age?: number | null;
    bio?: string | null;
    avatar_url?: string | null;
    category?: string | null;
    gender?: "masculino" | "femenino" | null;
    preferred_hand?: string | null;
    court_position?: string | null;
    preferred_schedule?: string | null;
  } | null;

  const emailLocal = user.email?.split("@")[0] ?? "Jugador";
  const defaultName = row?.name?.trim() || emailLocal;
  const competitiveLevelLine = formatPlayerCategory(row?.category);

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md bg-[var(--bg-app)] px-4 pb-24 pt-6">
      <header className="mb-6 space-y-1">
        <div className="flex items-center gap-3">
          <Link
            href="/perfil"
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--bg-card)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] dark:ring-white/10"
          >
            <ChevronLeft size={20} className="text-[var(--text-secondary)]" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Editar perfil</h1>
        </div>
        <p className="mt-1 pl-11 text-sm text-[var(--text-tertiary)]">
          La foto se sube a Supabase desde tu dispositivo; al guardar solo enviamos la URL pública.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
        <EditProfileForm
          userId={user.id}
          defaultName={defaultName}
          defaultAge={row?.age ?? null}
          defaultBio={row?.bio ?? null}
          defaultAvatarUrl={row?.avatar_url ?? null}
          defaultGender={row?.gender ?? null}
          defaultPreferredHand={row?.preferred_hand ?? null}
          defaultCourtPosition={row?.court_position ?? null}
          defaultPreferredSchedule={row?.preferred_schedule ?? null}
          competitiveLevelLine={competitiveLevelLine}
        />
      </section>
    </MotionPage>
  );
}
