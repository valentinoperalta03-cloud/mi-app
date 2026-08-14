import Image from "next/image";
import Link from "next/link";
import CapacitorShellReady from "@/components/capacitor-shell-ready";
import { LegalFooterLinks } from "@/components/legal-footer-links";
import LoginCard from "./login-card";

type LoginPageProps = {
  searchParams: Promise<{ message?: string; kind?: string; next?: string }>;
};

function displayMessage(raw: string | undefined) {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message, kind, next } = await searchParams;
  const text = displayMessage(message);
  const isError = kind === "error" || (Boolean(text) && kind !== "info");

  return (
    <main
      className="login-page-main relative isolate flex min-h-dvh flex-col overflow-y-auto"
      style={{ background: "linear-gradient(135deg, #0C1829 0%, #0A2540 100%)" }}
    >
      <CapacitorShellReady />
      <div className="h-0.5 w-full shrink-0 bg-[#CCFF00]" />
      <div className="flex flex-1 flex-col justify-center px-4 py-10 sm:py-14">
        <div className="login-page-inner mx-auto w-full max-w-[480px] px-4">
          <div className="flex flex-col items-center">
            <Image src="/logo.png" alt="PadeLibre" width={40} height={40} className="rounded-xl" priority />
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">PadeLibre</p>
          </div>

          <div className="login-page-card mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_25px_70px_-20px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-10">
            {text ? (
              <p
                role="alert"
                className={
                  isError
                    ? "mb-6 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-medium text-rose-300"
                    : "mb-6 rounded-2xl border border-[#0085FC]/30 bg-[#0085FC]/10 px-4 py-3 text-sm font-medium text-[#69B8FF]"
                }
              >
                {text}
              </p>
            ) : null}

            <LoginCard next={next} />

            <div className="mt-7 border-t border-white/10 pt-5 text-center">
              <p className="text-sm font-medium text-white/50">¿Tenés un club de pádel?</p>
              <Link
                href="/registro-club"
                className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-[#0085FC] hover:underline"
              >
                Registrá tu club gratis <span aria-hidden>→</span>
              </Link>
            </div>

            <LegalFooterLinks variant="login" className="mt-6" />
          </div>
        </div>
      </div>
    </main>
  );
}
