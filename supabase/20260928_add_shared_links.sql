-- ============================================================================
-- Shared links: every site shared in the community room or a chat room, one row per site.
-- A message can now carry several sites (or a whole category), each with an optional note,
-- and the Link history screen lists them all. Run once in Supabase -> SQL Editor; safe to run again.
-- ============================================================================

create table if not exists public.shared_links (
  id uuid primary key default gen_random_uuid(),
  -- The message the site was shared in: exactly one of these two.
  community_message_id uuid references public.community_messages(id) on delete cascade,
  chat_message_id uuid references public.chat_messages(id) on delete cascade,
  -- The chat room, for chat messages only; lets the history show only rooms you are in.
  room_id uuid references public.chat_rooms(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  url text not null,
  title text not null,
  -- "What is this link?" written by the person sharing it.
  memo text,
  position integer not null default 0,
  created_at timestamptz not null default now(),

  constraint shared_links_one_message check (num_nonnulls(community_message_id, chat_message_id) = 1),
  constraint shared_links_room_for_chat check ((chat_message_id is null) = (room_id is null)),
  constraint shared_links_url_http check (url ~* '^https?://'),
  constraint shared_links_url_length check (char_length(url) <= 2048),
  constraint shared_links_title_length check (char_length(title) between 1 and 200),
  constraint shared_links_memo_length check (memo is null or char_length(memo) <= 300)
);

create index if not exists shared_links_community_message_idx
  on public.shared_links (community_message_id, position) where community_message_id is not null;
create index if not exists shared_links_chat_message_idx
  on public.shared_links (chat_message_id, position) where chat_message_id is not null;
create index if not exists shared_links_room_created_idx on public.shared_links (room_id, created_at desc);
create index if not exists shared_links_created_idx on public.shared_links (created_at desc);

-- A whole category shared at once keeps its name, so people can save it as a category.
alter table public.community_messages add column if not exists collection_name text;
alter table public.chat_messages add column if not exists collection_name text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_messages_collection_name_length') then
    alter table public.community_messages
      add constraint community_messages_collection_name_length check (collection_name is null or char_length(collection_name) <= 50);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chat_messages_collection_name_length') then
    alter table public.chat_messages
      add constraint chat_messages_collection_name_length check (collection_name is null or char_length(collection_name) <= 50);
  end if;
end $$;

-- Sites shared before this change (one per message) join the history too.
insert into public.shared_links (community_message_id, user_id, url, title, created_at)
select m.id, m.user_id, m.link_url, left(coalesce(nullif(btrim(m.link_title), ''), m.link_url), 200), m.created_at
from public.community_messages m
where m.link_url is not null
  and not exists (select 1 from public.shared_links s where s.community_message_id = m.id);

insert into public.shared_links (chat_message_id, room_id, user_id, url, title, created_at)
select m.id, m.room_id, m.user_id, m.link_url, left(coalesce(nullif(btrim(m.link_title), ''), m.link_url), 200), m.created_at
from public.chat_messages m
where m.link_url is not null
  and not exists (select 1 from public.shared_links s where s.chat_message_id = m.id);

-- The app reads and writes only through its own server with the service role key,
-- so no public policies are added: nobody can touch this table with the anon key.
alter table public.shared_links enable row level security;
