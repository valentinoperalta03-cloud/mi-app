"use client";

import { LegalFooterLinks } from "@/components/legal-footer-links";
import { SignOutTextLink } from "@/components/sign-out-text-link";

export function ProfileSessionFooter() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-3 pb-6">
      <SignOutTextLink />
      <LegalFooterLinks variant="profile" />
    </footer>
  );
}
