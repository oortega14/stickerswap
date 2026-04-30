create table public.sticker_status (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sticker_code text not null,
  count smallint not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, sticker_code)
);

create index idx_sticker_status_user on public.sticker_status (user_id);

alter table public.sticker_status enable row level security;

-- En P2 solo se ve el propio. P4 amplía a amigos aceptados.
create policy "select own stickers"
  on public.sticker_status for select
  using (user_id = auth.uid());

create policy "modify own stickers"
  on public.sticker_status for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
