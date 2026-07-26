import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { createClient } from "@/utils/supabase/server";
import PenaForm from "../pena-form";

export const dynamic = "force-dynamic";

export default async function AdminPenaNuevaPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) redirect("/admin/club");

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-6 md:pb-10">
      <Link
        href="/admin/penas"
        className="inline-flex items-center gap-1 text-sm font-medium text-[#0461C4] dark:text-sky-400"
      >
        <ChevronLeft size={18} />
        Volver
      </Link>
      <h1 className={`mt-4 ${adminTitle}`}>Crear peña</h1>
      <PenaForm mode="create" clubId={ctx.clubIds[0]!} />
    </div>
  );
}
