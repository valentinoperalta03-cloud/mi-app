import {
  Activity,
  Banknote,
  Building2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  DollarSign,
  GraduationCap,
  House,
  Info,
  Link2,
  Settings,
  Settings2,
  SquareChartGantt,
  Star,
  Target,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon };
export type AdminNavGroup = {
  key: string;
  title: string;
  icon: LucideIcon;
  defaultOpen: boolean;
  items: AdminNavItem[];
};

/** Item suelto, siempre visible arriba de los grupos — también el ícono home cuando el sidebar está colapsado. */
export const ADMIN_NAV_HOME: AdminNavItem = { href: "/admin/dashboard", label: "Hoy", icon: House };

/** Fuente única de navegación del admin — la usan tanto el sidebar desktop como el drawer mobile. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: "gestion-juego",
    title: "Gestión de juego",
    icon: Target,
    defaultOpen: true,
    items: [
      { href: "/admin/reservas", label: "Reservas", icon: SquareChartGantt },
      { href: "/admin/turnos-fijos", label: "Turnos fijos", icon: Clock3 },
      { href: "/admin/torneos", label: "Torneos", icon: Trophy },
      { href: "/admin/clases", label: "Clases", icon: GraduationCap },
    ],
  },
  {
    key: "registro-diario",
    title: "Registro diario",
    icon: DollarSign,
    defaultOpen: false,
    items: [
      { href: "/admin/pagos", label: "Pagos", icon: CreditCard },
      { href: "/admin/cobros", label: "Cobros", icon: Banknote },
    ],
  },
  {
    key: "analisis",
    title: "Análisis",
    icon: SquareChartGantt,
    defaultOpen: false,
    items: [
      { href: "/admin/analytics", label: "Ocupación", icon: Activity },
      { href: "/admin/finanzas", label: "Finanzas", icon: Wallet },
      { href: "/admin/jugadores", label: "Jugadores", icon: Users },
    ],
  },
  {
    key: "configuracion",
    title: "Configuración",
    icon: Settings,
    defaultOpen: false,
    items: [
      { href: "/admin/canchas", label: "Canchas", icon: Building2 },
      { href: "/admin/config/informacion", label: "Información", icon: Info },
      { href: "/admin/config/servicios", label: "Servicios", icon: Star },
      { href: "/admin/config/pagos", label: "Métodos de pago", icon: CreditCard },
      { href: "/admin/config/general", label: "General", icon: Settings2 },
      { href: "/admin/config/suscripcion", label: "Suscripción", icon: CircleDollarSign },
      { href: "/admin/config/mp-connect", label: "MP Connect", icon: Link2 },
    ],
  },
];

/** Match exacto o de sub-ruta (`/admin/config/pagos/x` sigue activando `/admin/config/pagos`). */
export function isAdminNavItemActive(pathname: string, href: string): boolean {
  if (href === ADMIN_NAV_HOME.href) {
    return pathname === href || pathname === "/admin";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Key del grupo que contiene la ruta activa, o null si es el item suelto "Hoy" o no matchea nada. */
export function findActiveGroupKey(pathname: string): string | null {
  for (const group of ADMIN_NAV_GROUPS) {
    if (group.items.some((item) => isAdminNavItemActive(pathname, item.href))) {
      return group.key;
    }
  }
  return null;
}
