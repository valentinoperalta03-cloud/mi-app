import SuperadminSessionMark from "@/components/superadmin/superadmin-session-mark";
import SuperadminSidebar from "@/components/superadmin/superadmin-sidebar";
import { requireSuperadminPin, requireSuperadminUser } from "@/lib/superadmin/guards";

export default async function SuperadminMainLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperadminUser();
  await requireSuperadminPin(user);
  return (
    <div className="flex min-h-screen">
      <SuperadminSidebar />
      <main className="relative flex-1 overflow-x-auto border-l border-white/5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-10">
        <SuperadminSessionMark />
        {children}
      </main>
    </div>
  );
}
