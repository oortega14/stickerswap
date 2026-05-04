-- supabase/migrations/20260503000001_profiles_location.sql

-- Columnas para discovery local
alter table public.profiles
  add column country     text,
  add column city_slug   text,
  add column city_label  text,
  add column discoverable boolean not null default false;

-- Index parcial para que las queries de "cerca de mí" sean rápidas
create index idx_profiles_location on public.profiles (country, city_slug)
  where discoverable = true;

-- Si alguien marca discoverable=true tiene que tener país y ciudad
alter table public.profiles
  add constraint profiles_discoverable_requires_location
  check (
    discoverable = false
    or (country is not null and city_slug is not null)
  );
