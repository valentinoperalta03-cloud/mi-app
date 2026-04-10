import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import GateForm from "./gate-form";
import { createClient } from "@/utils/supabase/server";

export default async function AdminControlPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const hasAccess = cookieStore.get("admin_control_access")?.value === "granted";
  if (!hasAccess) {
    return (
      <main className="space-y-6">
        <GateForm />
      </main>
    );
  }

  redirect("/club/vault");
}
