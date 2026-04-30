alter table public.clubs
  add column if not exists description text,
  add column if not exists address text,
  add column if not exists contact_phone text,
  add column if not exists business_hours text,
  add column if not exists logo_url text,
  add column if not exists cover_image_url text,
  add column if not exists gallery_image_1 text,
  add column if not exists gallery_image_2 text,
  add column if not exists gallery_image_3 text;
