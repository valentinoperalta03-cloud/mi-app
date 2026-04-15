import Link from "next/link";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export default async function ComunidadBuscarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from(DB_TABLES.profiles)
    .select("user_id, name, avatar_url, level, level_of_play, technical_score")
    .neq("user_id", user.id)
    .order("name", { ascending: true })
    .limit(48);

  const list = (rows ?? []) as {
    user_id: string;
    name: string | null;
    avatar_url: string | null;
    level?: number | null;
    level_of_play?: string | null;
    technical_score?: number | null;
  }[];

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-slate-50 px-4 pb-32 pt-6">
      <header className="space-y-2">
        <Link
          href="/comunidad"
          className="inline-block text-sm font-semibold text-sky-600 hover:text-sky-700"
        >
          ← Comunidad
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Buscar jugadores</h1>
        <p className="text-sm text-slate-500">
          Explorá perfiles y sumalos a favoritos desde su página pública.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {list.map((p) => {
          const label = p.name?.trim() || "Jugador";
          const nivelLine = formatProfileNivelFromRow(p);
          const nivelParts = splitOfficialCategoryLine(nivelLine);
          return (
            <li key={p.user_id}>
              <Link
                href={`/jugador/${p.user_id}`}
                className="flex items-center gap-4 rounded-[2rem] border border-slate-200/80 bg-white p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)] transition hover:border-slate-300"
              >
                <ProfileAvatar avatarUrl={p.avatar_url} name={label} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="text-xs text-sky-700">
                    <span className="font-bold">{nivelParts.category || "—"}</span>
                    {nivelParts.description ? (
                      <span className="font-medium">{" - "}{nivelParts.description}</span>
                    ) : null}
                  </p>
                </div>
                <span className="text-sm font-semibold text-sky-600">Ver →</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {list.length === 0 ? (
        <p className="rounded-[2rem] border border-dashed border-slate-200 bg-white/80 p-6 text-center text-sm text-slate-500">
          No hay otros jugadores cargados todavía.
        </p>
      ) : null}
    </MotionPage>
  );
}
