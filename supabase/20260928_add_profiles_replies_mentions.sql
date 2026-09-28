-- ============================================================================
-- Profiles, replies and mentions.
--  * A display name, a one-line status and an emoji avatar with a color for each person.
--  * Replying to a message.
--  * @mentions, so people see when someone calls them.
-- Run once in Supabase -> SQL Editor; safe to run again.
-- ============================================================================

-- 1. Profile: shown next to the @ID in chats, friends and room member lists.
alter table public.user_profiles add column if not exists display_name text;
alter table public.user_profiles add column if not exists status_text text;
alter table public.user_profiles add column if not exists avatar_emoji text;
alter table public.user_profiles add column if not exists avatar_color text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_display_name_length') then
    alter table public.user_profiles
      add constraint user_profiles_display_name_length check (display_name is null or char_length(btrim(display_name)) between 1 and 30);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_status_text_length') then
    alter table public.user_profiles
      add constraint user_profiles_status_text_length check (status_text is null or char_length(status_text) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_avatar_emoji_length') then
    alter table public.user_profiles
      add constraint user_profiles_avatar_emoji_length check (avatar_emoji is null or char_length(avatar_emoji) <= 16);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_profiles_avatar_color_hex') then
    alter table public.user_profiles
      add constraint user_profiles_avatar_color_hex check (avatar_color is null or avatar_color ~ '^#[0-9a-f]{6}$');
  end if;
end $$;

-- 2. Replies: a message can answer an earlier one in the same place. Deleting the original keeps the reply.
alter table public.community_messages
  add column if not exists reply_to_id uuid references public.community_messages(id) on delete set null;
alter table public.chat_messages
  add column if not exists reply_to_id uuid references public.chat_messages(id) on delete set null;

-- 3. Mentions: one row per person called with @ID in a message, until they have seen it.
create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  community_message_id uuid references public.community_messages(id) on delete cascade,
  chat_message_id uuid references public.chat_messages(id) on delete cascade,
  room_id uuid references public.chat_rooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz,

  constraint mentions_one_message check (num_nonnulls(community_message_id, chat_message_id) = 1),
  constraint mentions_room_for_chat check ((chat_message_id is null) = (room_id is null))
);
create unique index if not exists mentions_community_once
  on public.mentions (user_id, community_message_id) where community_message_id is not null;
create unique index if not exists mentions_chat_once
  on public.mentions (user_id, chat_message_id) where chat_message_id is not null;
create index if not exists mentions_unseen_idx on public.mentions (user_id, room_id) where seen_at is null;

-- The app reads and writes only through its own server with the service role key,
-- so no public policies are added: nobody can touch this table with the anon key.
alter table public.mentions enable row level security;
