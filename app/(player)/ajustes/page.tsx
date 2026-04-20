import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import SettingsClient from "./settings-client";
import { LEVEL_HIERARCHY } from "@/lib/match-level";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type ActionState = { ok: boolean; message: string };

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("location, notifications_enabled, is_public, category, name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  const typed = profile as {
    location?: string | null;
    notifications_enabled?: boolean | null;
    is_public?: boolean | null;
    category?: string | null;
    name?: string | null;
    avatar_url?: string | null;
  } | null;

  async function updateLocation(formData: FormData): Promise<ActionState> {
    "use server";
    const supabase = await createClient({ allowCookieWrites: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "No hay sesión activa." };

    const location = String(formData.get("location") ?? "").trim();
    if (!location) return { ok: false, message: "No se pudo detectar la ubicación." };

    const { error } = await supabase.from(DB_TABLES.profiles).update({ location }).eq("user_id", user.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/ajustes");
    return { ok: true, message: "Ubicación actualizada ✓" };
  }

  async function updateNotifications(formData: FormData): Promise<ActionState> {
    "use server";
    const supabase = await createClient({ allowCookieWrites: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "No hay sesión activa." };

    const enabled = String(formData.get("enabled") ?? "false") === "true";
    const { error } = await supabase
      .from(DB_TABLES.profiles)
      .update({ notifications_enabled: enabled })
      .eq("user_id", user.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/ajustes");
    return { ok: true, message: enabled ? "Notificaciones activadas." : "Notificaciones desactivadas." };
  }

  async function updatePrivacy(formData: FormData): Promise<ActionState> {
    "use server";
    const supabase = await createClient({ allowCookieWrites: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "No hay sesión activa." };

    const isPublic = String(formData.get("is_public") ?? "true") === "true";
    const { error } = await supabase.from(DB_TABLES.profiles).update({ is_public: isPublic }).eq("user_id", user.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/ajustes");
    return { ok: true, message: isPublic ? "Perfil público activado." : "Perfil privado activado." };
  }

  async function downgradeLevel(): Promise<void> {
    "use server";
    const supabase = await createClient({ allowCookieWrites: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: current } = await supabase
      .from(DB_TABLES.profiles)
      .select("category")
      .eq("user_id", user.id)
      .maybeSingle();
    const currentCategory = String((current as { category?: string | null } | null)?.category ?? "");
    const idx = LEVEL_HIERARCHY.indexOf(currentCategory as (typeof LEVEL_HIERARCHY)[number]);
    if (idx > 0) {
      const newCategory = LEVEL_HIERARCHY[idx - 1];
      await supabase.from(DB_TABLES.profiles).update({ category: newCategory }).eq("user_id", user.id);
    }
    revalidatePath("/ajustes");
    redirect("/ajustes?success=nivel_bajado");
  }

  async function changePassword(formData: FormData): Promise<ActionState> {
    "use server";
    const supabase = await createClient({ allowCookieWrites: true });
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword.length < 6) {
      return { ok: false, message: "La contraseña debe tener al menos 6 caracteres." };
    }
    if (newPassword !== confirmPassword) {
      return { ok: false, message: "Las contraseñas no coinciden." };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Contraseña actualizada correctamente." };
  }

  async function deleteAccount(): Promise<void> {
    "use server";
    const supabase = await createClient({ allowCookieWrites: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      redirect("/ajustes");
    }

    await supabase.from(DB_TABLES.profiles).delete().eq("user_id", user.id);

    const admin = createSupabaseAdminClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.auth.admin.deleteUser(user.id);
    redirect("/login");
  }

  return (
    <SettingsClient
      initialLocation={typed?.location ?? null}
      notificationsEnabled={typed?.notifications_enabled ?? true}
      isPublic={typed?.is_public ?? true}
      category={typed?.category ?? null}
      name={typed?.name?.trim() || "Jugador"}
      avatarUrl={typed?.avatar_url ?? null}
      levelDowngraded={sp.success === "nivel_bajado"}
      updateLocationAction={updateLocation}
      updateNotificationsAction={updateNotifications}
      updatePrivacyAction={updatePrivacy}
      downgradeLevelAction={downgradeLevel}
      changePasswordAction={changePassword}
      deleteAccountAction={deleteAccount}
    />
  );
}
