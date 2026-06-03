import { redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { BienvenidaClient } from "./bienvenida-client";

export default async function BienvenidaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("slides_seen")
    .eq("user_id", user.id)
    .maybeSingle();

  const slidesSeen = Boolean((profile as { slides_seen?: boolean | null } | null)?.slides_seen);
  if (slidesSeen) redirect("/home");

  return <BienvenidaClient />;
}
