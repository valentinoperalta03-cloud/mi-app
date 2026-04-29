alter table public.courts
  add column if not exists surface text,
  add column if not exists indoor boolean not null default false,
  add column if not exists image_url text;
