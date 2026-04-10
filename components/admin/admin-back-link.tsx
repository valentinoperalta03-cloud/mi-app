import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type AdminBackLinkProps = {
  href?: string;
  label?: string;
};

export default function AdminBackLink({
  href = "/admin/dashboard",
  label = "Volver al inicio",
}: AdminBackLinkProps) {
  return (
    <Link
      href={href}
      className="group mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-sky-600"
    >
      <ChevronLeft
        size={18}
        strokeWidth={2}
        className="transition-transform group-hover:-translate-x-0.5"
      />
      {label}
    </Link>
  );
}
