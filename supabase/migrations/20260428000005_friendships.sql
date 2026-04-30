create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
create type public.friendship_source as enum ('qr_code', 'username_search');

create table public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  source public.friendship_source not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (friend_id <> user_id)
);

create index idx_friendships_user on public.friendships (user_id);
create index idx_friendships_friend on public.friendships (friend_id);

alter table public.friendships enable row level security;

create policy "select own friendships"
  on public.friendships for select
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy "manage own side"
  on public.friendships for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
