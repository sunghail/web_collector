-- ============================================================================
-- Message reactions (👍 ❤️ 😂 ...) for the community room and chat rooms.
-- One row per person, message and emoji. Run once in Supabase -> SQL Editor; safe to run again.
-- ============================================================================

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
