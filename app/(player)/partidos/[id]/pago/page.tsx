import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { PartidoPagoReturn } from "./partido-pago-client";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    status?: string;
    collection_status?: string;
    collection_id?: string;
  }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Pago · Partido",
    description: `Confirmación de pago del partido ${id.slice(0, 8)}…`,
  };
}

export default async function PartidoPagoPage({ params, searchParams }: PageProps) {
  const { id: matchId } = await params;
  const sp = searchParams ? await searchParams : {};

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: pay } = await supabase
    .from(DB_TABLES.payments)
    .select("id,status")
    .eq("match_id", matchId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const paymentId = (pay as { id?: string } | null)?.id ?? null;
  const dbStatus = (pay as { status?: string | null } | null)?.status ?? null;

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <header className="space-y-2">
        <Link
          href={`/partidos/${matchId}`}
          className="inline-block text-sm font-semibold text-[var(--color-brand)] hover:opacity-90"
        >
          ← Volver al partido
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Estado del pago</h1>
      </header>

      <PartidoPagoReturn
        key={`${matchId}-${paymentId ?? "nopay"}-${dbStatus ?? ""}`}
        matchId={matchId}
        paymentId={paymentId}
        dbStatus={dbStatus}
        collectionStatus={sp.collection_status}
        status={sp.status}
      />
    </MotionPage>
  );
}
