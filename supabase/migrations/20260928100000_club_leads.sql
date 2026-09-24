-- Consultas comerciales de clubes ("Quiero que me contacten" en /para-clubes).
-- Acceso exclusivo service_role: la landing inserta vía /api/club-leads y el equipo
-- comercial las lee desde /superadmin/consultas. Anónimos y usuarios logueados no
-- pueden leer ni escribir la tabla directamente (contiene teléfonos).

create table if not exists public.club_leads (
  id uuid primary key default gen_random_uuid(),
  club_name text not null
    check (char_length(club_name) between 2 and 120),
  whatsapp text not null
    check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  problem text not null
    check (problem in (
      'reservas', 'torneos', 'finanzas', 'entrenamientos',
      'turnos_fijos', 'ocupacion', 'gestion_integral', 'otro'
    )),
  source text not null default 'landing_clubes'
    check (source in ('landing_clubes')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'converted', 'discarded')),
  contacted_at timestamptz,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists club_leads_created_at_idx on public.club_leads (created_at desc);
create index if not exists club_leads_status_idx on public.club_leads (status);
create index if not exists club_leads_whatsapp_idx on public.club_leads (whatsapp, created_at desc);

alter table public.club_leads enable row level security;

revoke all on table public.club_leads from anon, authenticated;

drop policy if exists "club_leads no access" on public.club_leads;
create policy "club_leads no access" on public.club_leads for all using (false) with check (false);
