import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { ProfileLevelingWizard } from "@/components/profile/profile-leveling-wizard";
import { ProfileSessionFooter } from "@/components/profile-session-footer";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function NivelacionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from(DB_TABLES.profiles)
    .select("level, level_of_play, is_leveled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    redirect("/perfil");
  }

  const row = profile as {
    level?: number | null;
    level_of_play?: string | null;
    is_leveled?: boolean | null;
  } | null;
  const hasLevel =
    (row?.level != null && Number.isFinite(Number(row.level))) ||
    Boolean(row?.level_of_play?.trim()) ||
    row?.is_leveled === true;
  if (hasLevel) {
    redirect("/perfil");
  }

  return (
    <MotionPage className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-2 bg-[#F5F5F7] px-4 pb-28 pt-6">
      <ProfileLevelingWizard />
      <ProfileSessionFooter />
    </MotionPage>
  );
}
