import { requireSuperadminUser } from "@/lib/superadmin/guards";

export default async function SuperadminRootLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadminUser();
  return <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</div>;
}
