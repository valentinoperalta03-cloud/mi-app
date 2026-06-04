import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { PRACTICE_MODALITY_OPTIONS } from "@/lib/practice-constants";
import { practiceTotalPrice } from "@/lib/practice-pricing";
import { createClient } from "@/utils/supabase/server";
import PracticeRegisterForm from "../practice-register-form";

type PageProps = { params: Promise<{ sessionId: string }> };

export const dynamic = "force-dynamic";

export default async function ClaseDetallePage({ params, searchParams }: PageProps & { searchParams: Promise<{ pay?: string }> }) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/clases/${sessionId}`);

  const { data: session } = await supabase
    .from(DB_TABLES.practiceSessions)
    .select(
      "id, session_date, start_time, status, practices(id, title, description, modality, max_spots, price_base, level_min, level_max, status, practice_coaches(name), clubs(name, logo_url))"
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) redirect("/clases");

  const raw = session as Record<string, unknown>;
  const practicePack = raw.practices;
  const practiceRow = Array.isArray(practicePack) ? practicePack[0] : practicePack;
  const s = {
    session_date: String(raw.session_date),
    start_time: String(raw.start_time),
    status: String(raw.status),
  };
  const practice = practiceRow as {
    id: string;
    title: string;
    description: string | null;
    modality: string;
    max_spots: number;
    price_base: number;
    level_min: number | null;
    level_max: number | null;
    status: string;
    practice_coaches?: { name: string } | { name: string }[] | null;
    clubs?: { name: string | null; logo_url: string | null } | { name: string | null; logo_url: string | null }[] | null;
  } | undefined;
  if (!practice || practice.status !== "open") redirect("/clases");

  const club = Array.isArray(practice.clubs) ? practice.clubs[0] : practice.clubs;
  const coach = Array.isArray(practice.practice_coaches)
    ? practice.practice_coaches[0]
    : practice.practice_coaches;

  const { data: regs } = await supabase
    .from(DB_TABLES.practiceRegistrations)
    .select("player_id, payment_status")
    .eq("session_id", sessionId);
  const approved = ((regs ?? []) as { payment_status: string }[]).filter((r) => r.payment_status === "approved").length;
  const already = ((regs ?? []) as { player_id: string; payment_status: string }[]).some(
    (r) => r.player_id === user.id && r.payment_status === "approved"
  );
  const canRegister =
    s.status === "open" &&
    s.session_date >= new Date().toISOString().slice(0, 10) &&
    !already &&
    approved < practice.max_spots;

  const dt = parseISO(`${s.session_date}T${String(s.start_time).slice(0, 5)}:00`);
  const total = practiceTotalPrice(Number(practice.price_base));
  const modality = PRACTICE_MODALITY_OPTIONS.find((o) => o.value === practice.modality)?.label ?? practice.modality;

  const payBanner =
    sp.pay === "ok"
      ? "¡Pago confirmado! Tu inscripción quedó registrada."
      : sp.pay === "pending"
        ? "Pago pendiente. Te avisamos cuando se confirme."
        : sp.pay === "fail"
          ? "El pago no se completó. Podés intentar de nuevo."
          : null;

  return (
    <MotionPage className="mx-auto min-h-screen w-full min-w-0 max-w-md overflow-x-hidden bg-[var(--bg-app)] px-4 pb-28 pt-6">
      <Link href="/clases" className="text-sm font-medium text-[#0461C4]">
        ← Clases
      </Link>

      {payBanner ? (
        <p className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          {payBanner}
        </p>
      ) : null}

      <header className="mt-4 min-w-0 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{club?.name ?? "Club"}</p>
        <h1 className="mt-1 break-words text-2xl font-bold leading-tight text-[var(--text-primary)]">{practice.title}</h1>
        <p className="mt-2 text-sm capitalize text-[var(--text-secondary)]">
          {format(dt, "EEEE d 'de' MMMM · HH:mm", { locale: es })}
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {modality} · {approved}/{practice.max_spots} cupos
        </p>
        {coach?.name ? <p className="mt-1 text-sm text-[var(--text-tertiary)]">Profesor: {coach.name}</p> : null}
        {practice.description ? (
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{practice.description}</p>
        ) : null}
        <p className="mt-3 text-lg font-bold text-[var(--text-primary)]">${total.toLocaleString("es-AR")}</p>
      </header>

      <div className="mt-4">
        <PracticeRegisterForm
          sessionId={sessionId}
          canRegister={canRegister}
          priceLabel={`$${total.toLocaleString("es-AR")}`}
        />
      </div>
      {already ? (
        <p className="mt-4 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">Ya estás inscripto.</p>
      ) : null}
      {approved >= practice.max_spots && !already ? (
        <p className="mt-4 text-center text-sm text-[var(--text-tertiary)]">Clase completa.</p>
      ) : null}
    </MotionPage>
  );
}
