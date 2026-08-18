"use client";

import { useState } from "react";
import { Space_Grotesk } from "next/font/google";
import { AppleAuthForm, EmailAuthForm, GoogleAuthForm } from "./auth-forms";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["700"] });

export default function LoginCard({ next }: { next?: string }) {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <>
      <div className="text-center">
        <h1 className={`${spaceGrotesk.className} text-2xl font-bold text-white`}>
          {isLogin ? "Bienvenido de vuelta" : "Crear cuenta"}
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-white/55">
          Registrate una sola vez y listo. La próxima vez que entrés desde cualquier link de un club, ya
          vas a estar dentro de tu cuenta automáticamente.
        </p>
      </div>

      <div className="mt-7 space-y-3">
        <AppleAuthForm next={next} />
        <GoogleAuthForm next={next} />
      </div>

      <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-white/30">
        <span className="h-px flex-1 bg-white/20" />
        <span className="shrink-0">o continuá con email</span>
        <span className="h-px flex-1 bg-white/20" />
      </div>

      <EmailAuthForm next={next} isLogin={isLogin} onModeChange={setIsLogin} />
    </>
  );
}
