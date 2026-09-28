-- ============================================================================
-- Web Collector: full setup for a NEW, empty Supabase project.
-- Run this one file in Supabase -> SQL Editor. It creates every table the app needs.
-- (The dated files next to it are the step-by-step changes for an existing database;
--  you do not need them on a new project.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Accounts, categories, links and macros
-- ---------------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  email text not null,
  -- bcrypt hash, or 'GOOGLE_OAUTH' for accounts made with Google sign-in
  password_hash text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists users_username_key on public.users (username);
create unique index if not exists users_email_key on public.users (lower(email));

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  color text not null default '#3B82F6',
  order_index integer not null default 0,
  default_favicon_id text,
  created_at timestamptz not null default now()
);
create index if not exists categories_user_idx on public.categories (user_id, order_index);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Deleting a category moves its links to the Inbox (null) instead of deleting them.
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  url text not null,
  favicon text,
  show_favicon boolean not null default true,
  memo text,
  -- 'link', or 'macro' for a group of sites that open together
  type text not null default 'link',
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint links_type check (type in ('link', 'macro'))
);
create index if not exists links_user_idx on public.links (user_id, order_index);
create index if not exists links_category_idx on public.links (category_id);

create table if not exists public.macro_items (
  id uuid primary key default gen_random_uuid(),
  macro_id uuid not null references public.links(id) on delete cascade,
  -- A saved link, or a custom address below. Deleting the saved link removes it from the macro.
  link_id uuid references public.links(id) on delete cascade,
  custom_url text,
  custom_title text,
  custom_favicon text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists macro_items_macro_idx on public.macro_items (macro_id, order_index);

-- The app reaches the database only through its own server (service role key).
-- Row level security with no policies keeps every table closed to the public anon key.
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.links enable row level security;
alter table public.macro_items enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Community room (same as 20260923_add_community_messages.sql)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- 3. Public IDs, friends and chat rooms (same as 20260927_add_friends_and_chat_rooms.sql)
-- ---------------------------------------------------------------------------

-- 1. A public ID ("@handle") per person, separate from the login username,
--    so login names are never shown to other people.
create table if not exists public.user_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  handle text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_handle_format check (handle ~ '^[a-z0-9_.]{3,20}$')
);
create unique index if not exists user_profiles_handle_key on public.user_profiles (handle);

-- Give everyone who already has an account an ID: their username (letters, digits, _ and . only)
-- plus 4 characters from their account id. People can change it in the app later.
insert into public.user_profiles (user_id, handle)
select
  u.id,
  left(
    coalesce(nullif(left(regexp_replace(lower(u.username), '[^a-z0-9_.]', '', 'g'), 14), ''), 'user')
      || '_' || substr(md5(u.id::text), 1, 4),
    20
  )
from public.users u
where not exists (select 1 from public.user_profiles p where p.user_id = u.id)
on conflict do nothing;

-- 2. Friend requests and friendships. One row per pair of people.
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  addressee_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_status check (status in ('pending', 'accepted')),
  constraint friendships_not_self check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);

-- 3. Chat rooms. Group rooms have a name; direct (1:1) rooms do not.
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text,
  is_direct boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint chat_rooms_name_length check (name is null or char_length(btrim(name)) between 1 and 50),
  constraint chat_rooms_group_has_name check (is_direct or name is not null)
);

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint chat_room_members_role check (role in ('owner', 'member'))
);
create index if not exists chat_room_members_user_idx on public.chat_room_members (user_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  kind text not null default 'user',
  body text not null default '',
  link_url text,
  link_title text,
  created_at timestamptz not null default now(),

  constraint chat_messages_kind check (kind in ('user', 'system')),
  constraint chat_messages_body_length check (char_length(body) <= 1000),
  constraint chat_messages_link_url_http check (link_url is null or link_url ~* '^https?://'),
  constraint chat_messages_link_url_length check (link_url is null or char_length(link_url) <= 2048),
  constraint chat_messages_link_title_length check (link_title is null or char_length(link_title) <= 200),
  constraint chat_messages_not_empty check (char_length(btrim(body)) > 0 or link_url is not null)
);
create index if not exists chat_messages_room_created_idx on public.chat_messages (room_id, created_at desc);
create index if not exists chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);

-- The app reads and writes only through its own server with the service role key,
-- so no public policies are added: nobody can touch these tables with the anon key.
alter table public.user_profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Message reactions (same as 20260928_add_message_reactions.sql)
-- ---------------------------------------------------------------------------

create table if not exists public.community_message_reactions (
  message_id uuid not null references public.community_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji),
  constraint community_message_reactions_emoji_length check (char_length(emoji) between 1 and 16)
);

create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji),
  constraint chat_message_reactions_emoji_length check (char_length(emoji) between 1 and 16)
);

-- The app reads and writes only through its own server with the service role key,
-- so no public policies are added: nobody can touch these tables with the anon key.
alter table public.community_message_reactions enable row level security;
alter table public.chat_message_reactions enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Shared links and shared categories (same as 20260928_add_shared_links.sql)
-- ---------------------------------------------------------------------------

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
