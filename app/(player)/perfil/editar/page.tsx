import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
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
    .select("name, age, bio, avatar_url, level, level_of_play, technical_score, gender, preferred_hand, court_position, preferred_schedule")
    .eq("user_id", user.id)
    .maybeSingle();

  const row = profile as {
    name?: string | null;
    age?: number | null;
    bio?: string | null;
    avatar_url?: string | null;
    level?: number | null;
    level_of_play?: string | null;
    technical_score?: number | null;
    gender?: "masculino" | "femenino" | null;
    preferred_hand?: string | null;
    court_position?: string | null;
    preferred_schedule?: string | null;
  } | null;

  const emailLocal = user.email?.split("@")[0] ?? "Jugador";
  const defaultName = row?.name?.trim() || emailLocal;
  const competitiveLevelLine = formatProfileNivelFromRow(row);

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md bg-[var(--bg-app)] px-4 pb-24 pt-4">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/perfil"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-card)] text-[#0585FC] shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] transition active:scale-95 dark:ring-white/10"
            aria-label="Volver al perfil"
          >
            <ChevronLeft size={22} aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Editar perfil</h1>
            <p className="text-sm text-[var(--text-tertiary)]">Actualizá tus datos personales</p>
          </div>
        </div>
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
