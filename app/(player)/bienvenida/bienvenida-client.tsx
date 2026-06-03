"use client";

import { useRouter } from "next/navigation";
import { OnboardingSlides } from "@/components/onboarding-slides";
import { markSlidesSeenAction } from "../home/actions";

export function BienvenidaClient() {
  const router = useRouter();

  async function handleComplete() {
    await markSlidesSeenAction();
    router.replace("/home");
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#020D1F]">
      <OnboardingSlides onComplete={handleComplete} />
    </div>
  );
}
