import { formatDistanceToNow, isThisWeek, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  CalendarCheck,
  CalendarX,
  CheckCircle,
  Clock,
  CreditCard,
  MessageCircle,
  MessageSquare,
  TrendingUp,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import EmptyStateCard from "@/components/empty-state-card";
import MotionPage from "@/components/motion-page";
import NotificationsPermissionButton from "@/components/notifications-permission-button";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  match_id: string | null;
  actor_id: string | null;
  read: boolean;
  created_at: string;
};

const TYPE_UI: Record<string, { Icon: typeof UserPlus; className: string }> = {
  join_request: { Icon: UserPlus, className: "text-[#0585FC]" },
  join_approved: { Icon: CheckCircle, className: "text-emerald-600" },
  join_rejected: { Icon: XCircle, className: "text-rose-600" },
  player_joined: { Icon: Users, className: "text-[#0585FC]" },
  match_reminder: { Icon: Clock, className: "text-amber-600" },
  result_pending: { Icon: AlertCircle, className: "text-amber-600" },
  reservation_confirmed: { Icon: CalendarCheck, className: "text-emerald-600" },
  reservation_cancelled: { Icon: CalendarX, className: "text-rose-600" },
  payment_approved: { Icon: CreditCard, className: "text-emerald-600" },
  payment_rejected: { Icon: CreditCard, className: "text-rose-600" },
  level_up: { Icon: TrendingUp, className: "text-[#0585FC]" },
  new_follower: { Icon: UserPlus, className: "text-[#0585FC]" },
  now_friends: { Icon: Users, className: "text-emerald-600" },
  new_message: { Icon: MessageCircle, className: "text-[#0585FC]" },
  group_message: { Icon: MessageSquare, className: "text-[#0585FC]" },
  added_to_group: { Icon: UserPlus, className: "text-emerald-600" },
};

export async function markAllAsRead() {
  "use server";
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
}

export default async function NotificacionesPage() {
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await markAllAsRead();

  const { data } = await supabase
    .from(DB_TABLES.notifications)
    .select("id,type,title,body,match_id,actor_id,read,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as NotificationRow[];
  const today: NotificationRow[] = [];
  const week: NotificationRow[] = [];
  const older: NotificationRow[] = [];

  for (const n of rows) {
    const created = parseISO(n.created_at);
    if (isToday(created)) {
      today.push(n);
    } else if (isThisWeek(created, { weekStartsOn: 1 })) {
      week.push(n);
    } else {
      older.push(n);
    }
  }

  const groups: Array<{ label: string; items: NotificationRow[] }> = [
    { label: "Hoy", items: today },
    { label: "Esta semana", items: week },
    { label: "Anteriores", items: older },
  ];

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-transparent px-4 pb-24 pt-6">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#0585FC]">Notificaciones</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Tu actividad reciente</h1>
        </div>
        <NotificationsPermissionButton />
      </header>

      {rows.length === 0 ? (
        <EmptyStateCard
          title="No tenés notificaciones"
          subtitle="Acá aparecerán avisos de tus partidos y reservas"
        />
      ) : (
        groups.map((group) =>
          group.items.length > 0 ? (
            <section key={group.label} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</h2>
              <div className="space-y-2">
                {group.items.map((n) => {
                  const meta = TYPE_UI[n.type] ?? { Icon: AlertCircle, className: "text-slate-500" };
                  const rel = formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: es });
                  const showProfileButton =
                    Boolean(n.actor_id) &&
                    ["new_follower", "now_friends", "join_request", "join_approved"].includes(n.type);
                  const content = (
                    <article className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <span className={`rounded-full bg-slate-100 p-2 ${meta.className}`}>
                          <meta.Icon size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-bold text-slate-900">{n.title}</p>
                            {!n.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#0585FC]/50" /> : null}
                          </div>
                          <p className="mt-1 break-words text-sm text-slate-600">{n.body}</p>
                          <p className="mt-2 text-xs text-slate-400">{rel}</p>
                          {showProfileButton ? (
                            <Link
                              href={`/jugador/${n.actor_id}`}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[#0585FC]/25 bg-[#0585FC]/5 px-3 py-1.5 text-xs font-semibold text-[#0461C4] transition active:scale-[0.97] dark:text-sky-400"
                            >
                              Ver perfil →
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                  const href = showProfileButton
                    ? null
                    : n.match_id
                      ? `/partidos/${n.match_id}`
                      : null;

                  return href ? (
                    <Link key={n.id} href={href} className="block">
                      {content}
                    </Link>
                  ) : (
                    <div key={n.id}>{content}</div>
                  );
                })}
              </div>
            </section>
          ) : null
        )
      )}
    </MotionPage>
  );
}
