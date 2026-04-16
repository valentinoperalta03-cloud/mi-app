alter table public.profiles
  add column if not exists gender text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_gender_check'
  ) then
    alter table public.profiles
      add constraint profiles_gender_check
      check (gender is null or gender in ('masculino', 'femenino'));
  end if;
end $$;

alter table public.matches
  add column if not exists gender_category text;

update public.matches
set gender_category = 'mixto'
where gender_category is null;

alter table public.matches
  alter column gender_category set default 'mixto',
  alter column gender_category set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_gender_category_check'
  ) then
    alter table public.matches
      add constraint matches_gender_category_check
      check (gender_category in ('masculino', 'femenino', 'mixto'));
  end if;
end $$;
