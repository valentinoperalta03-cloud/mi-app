"use client";

import { useState, type ReactNode } from "react";
import { OnboardingSlides } from "@/components/onboarding-slides";
import { markSlidesSeenAction } from "./actions";

export function HomeClientWrapper({
  slidesSeen,
  children,
}: {
  slidesSeen: boolean;
  children: ReactNode;
}) {
  const [showSlides, setShowSlides] = useState(!slidesSeen);

  async function handleComplete() {
    await markSlidesSeenAction();
    setShowSlides(false);
  }

  if (showSlides) {
    return <OnboardingSlides onComplete={handleComplete} />;
  }

  return <>{children}</>;
}
