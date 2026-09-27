-- Public community chat: one shared room where signed-in users talk and share sites.
-- Adds a new table only; existing tables are not changed.

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null default '',
  link_url text,
  link_title text,
  created_at timestamptz not null default now(),

  constraint community_messages_body_length check (char_length(body) <= 1000),
  constraint community_messages_link_url_http check (link_url is null or link_url ~* '^https?://'),
  constraint community_messages_link_url_length check (link_url is null or char_length(link_url) <= 2048),
  constraint community_messages_link_title_length check (link_title is null or char_length(link_title) <= 200),
  constraint community_messages_not_empty check (char_length(btrim(body)) > 0 or link_url is not null)
);

create index if not exists community_messages_created_at_idx
  on public.community_messages (created_at desc);

create index if not exists community_messages_user_created_idx
  on public.community_messages (user_id, created_at desc);

-- The app reads and writes through its own server with the service role key,
-- so no public policies are added: nobody can touch this table with the anon key.
alter table public.community_messages enable row level security;
