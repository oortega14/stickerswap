-- supabase/migrations/20260503000011_user_contacts.sql

-- Tabla aparte de profiles porque profiles tiene SELECT abierto (necesario
-- para búsqueda por @username) y el contacto debe ser privado: solo friends
-- aceptados pueden verlo.

create table public.user_contacts (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  whatsapp   text,    -- número con o sin código país; cliente normaliza al armar el link
  instagram  text,    -- @handle o handle; cliente quita el @ al armar el link
  updated_at timestamptz not null default now()
);

alter table public.user_contacts enable row level security;

-- El dueño puede leer y modificar su propia row
create policy "manage own contact"
  on public.user_contacts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Friends aceptados (mi lado de la friendship) pueden leer
create policy "friends can read contact"
  on public.user_contacts for select
  using (
    exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid()
        and f.friend_id = public.user_contacts.user_id
        and f.status = 'accepted'
    )
  );
