"use client";

import { useRouter } from "next/navigation";
import { OnboardingSlides } from "@/components/onboarding-slides";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/client";

export function BienvenidaClient() {
  const router = useRouter();

  async function handleComplete() {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from(DB_TABLES.profiles).update({ slides_seen: true }).eq("user_id", user.id);
      }
    } catch {
      // ignorar error, igual redirigir
    }
    window.location.href = "/home";
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#020D1F]">
      <OnboardingSlides onComplete={handleComplete} />
    </div>
  );
}
