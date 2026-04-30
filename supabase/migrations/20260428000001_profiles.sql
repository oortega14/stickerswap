-- Tabla profiles 1:1 con auth.users
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  avatar_url text,
  invite_code text unique not null,
  created_at timestamptz not null default now()
);

create index idx_profiles_invite_code on public.profiles (invite_code);

alter table public.profiles enable row level security;

create policy "select profiles"
  on public.profiles for select
  using (true);

create policy "update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
