/* RLS: group_chats, group_chat_members, group_chat_messages */

alter table public.group_chats enable row level security;
alter table public.group_chat_members enable row level security;
alter table public.group_chat_messages enable row level security;

drop policy if exists "group_chats_select_members" on public.group_chats;
drop policy if exists "group_chats_insert_owner" on public.group_chats;
drop policy if exists "group_chats_insert_authenticated_creator" on public.group_chats;
drop policy if exists "group_chats_select_member" on public.group_chats;
drop policy if exists "group_chats_update_creator" on public.group_chats;
drop policy if exists "group_chats_delete_creator" on public.group_chats;

drop policy if exists "group_chat_members_select_members" on public.group_chat_members;
drop policy if exists "group_chat_members_insert_admin_only" on public.group_chat_members;
drop policy if exists "group_chat_members_update_admin_only" on public.group_chat_members;
drop policy if exists "group_chat_members_select_co_member" on public.group_chat_members;

drop policy if exists "group_chat_messages_select_members" on public.group_chat_messages;
drop policy if exists "group_chat_messages_insert_members" on public.group_chat_messages;
drop policy if exists "group_chat_messages_select_member" on public.group_chat_messages;

create policy "group_chats_insert_authenticated_creator"
on public.group_chats
for insert
to authenticated
with check (created_by = auth.uid());

create policy "group_chats_select_member"
on public.group_chats
for select
to authenticated
using (
  exists (
    select 1
    from public.group_chat_members m
    where m.group_id = group_chats.id
      and m.user_id = auth.uid()
  )
);

create policy "group_chats_update_creator"
on public.group_chats
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "group_chats_delete_creator"
on public.group_chats
for delete
to authenticated
using (created_by = auth.uid());

create policy "group_chat_members_select_co_member"
on public.group_chat_members
for select
to authenticated
using (
  exists (
    select 1
    from public.group_chat_members mine
    where mine.group_id = group_chat_members.group_id
      and mine.user_id = auth.uid()
  )
);

create policy "group_chat_messages_select_member"
on public.group_chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.group_chat_members m
    where m.group_id = group_chat_messages.group_id
      and m.user_id = auth.uid()
  )
);
