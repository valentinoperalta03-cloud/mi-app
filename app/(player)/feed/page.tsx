import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeedRedirectPage({ searchParams }: PageProps) {
  const p = searchParams ? await searchParams : {};
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else q.set(k, v);
  }
  const tail = q.toString();
  redirect(tail ? `/partidos-abiertos?${tail}` : "/partidos-abiertos");
}
