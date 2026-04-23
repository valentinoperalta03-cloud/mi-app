alter table public.posts
  add column if not exists post_type text not null default 'text'
    check (post_type in ('text', 'photo', 'result')),
  add column if not exists image_url text;
