-- supabase/migrations/20260503000003_v_nearby_matches.sql

-- Index parcial para acelerar el filter de "extras" (count > 1)
create index if not exists idx_sticker_status_extras
  on public.sticker_status (user_id, sticker_code)
  where count > 1;

-- Vista que calcula matches bidireccionales con usuarios de la misma ciudad.
-- security_invoker=off para que pueda leer sticker_status de otros users SOLO
-- como agregados (count) — los stickers individuales nunca se devuelven.
create view public.v_nearby_matches with (security_invoker = off) as
with me as (
  select id, country, city_slug
  from public.profiles
  where id = auth.uid()
    and discoverable = true
    and country is not null
    and city_slug is not null
),
candidates as (
  select p.id, p.username, p.display_name, p.city_label
  from public.profiles p, me
  where p.id <> me.id
    and p.country = me.country
    and p.city_slug = me.city_slug
    and p.discoverable = true
    and not exists (
      select 1 from public.friendships f
      where (f.user_id = me.id and f.friend_id = p.id)
         or (f.user_id = p.id and f.friend_id = me.id)
    )
),
their_extras as (
  select c.id as them_id, t.sticker_code
  from candidates c
  join public.sticker_status t on t.user_id = c.id and t.count > 1
  left join public.sticker_status m on m.user_id = (select id from me) and m.sticker_code = t.sticker_code
  where coalesce(m.count, 0) = 0
),
my_extras as (
  select c.id as them_id, m.sticker_code
  from candidates c
  join public.sticker_status m on m.user_id = (select id from me) and m.count > 1
  left join public.sticker_status t on t.user_id = c.id and t.sticker_code = m.sticker_code
  where coalesce(t.count, 0) = 0
)
select
  (select id from me)        as me_id,
  c.id                       as them_id,
  c.username,
  c.display_name,
  c.city_label,
  coalesce((select count(*) from their_extras te where te.them_id = c.id), 0)::int as they_have_i_need,
  coalesce((select count(*) from my_extras me2 where me2.them_id = c.id), 0)::int as i_have_they_need
from candidates c;

grant select on public.v_nearby_matches to authenticated;
