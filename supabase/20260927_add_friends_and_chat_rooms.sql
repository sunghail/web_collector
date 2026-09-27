-- Friends and private chat rooms.
-- Adds new tables only; existing tables (users, links, categories, ...) are not changed.
-- Run after 20260923_add_community_messages.sql.

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
