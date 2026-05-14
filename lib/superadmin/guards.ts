import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { SUPERADMIN_COOKIE, SUPERADMIN_EMAILS } from "@/lib/superadmin/constants";
import { verifySuperadminSession } from "@/lib/superadmin/session-cookie";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Usuario logueado cuyo email está en `superadmins` (y en lista permitida).
 */
export async function getSuperadminUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const email = user.email.trim().toLowerCase();
  if (!SUPERADMIN_EMAILS.has(email)) return null;

  const svc = createServiceClient();
  const { data } = await svc.from(DB_TABLES.superadmins).select("email").eq("email", email).maybeSingle();
  if (!data) return null;
  return user;
}

export async function requireSuperadminUser(): Promise<User> {
  const user = await getSuperadminUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperadminPin(user: User): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SUPERADMIN_COOKIE)?.value;
  if (!verifySuperadminSession(token, user.id)) {
    redirect("/superadmin/pin");
  }
}

/** Server actions del panel (requieren cookie de PIN). */
export async function requireSuperadminAction(): Promise<{ user: User; svc: SupabaseClient }> {
  const user = await requireSuperadminUser();
  await requireSuperadminPin(user);
  return { user, svc: createServiceClient() };
}
