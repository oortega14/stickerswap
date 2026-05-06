-- supabase/migrations/20260503000012_nearby_matches_function.sql

-- Reemplaza la VIEW v_nearby_matches con una FUNCTION security definer.
-- Razón: la view con `security_invoker = off` corría con el rol owner pero
-- `auth.uid()` no siempre se resolvía correctamente bajo PostgREST (depende
-- de cómo se setea request.jwt.claims en el contexto de view definer).
-- Una función SECURITY DEFINER lee auth.uid() de manera idéntica al caller
-- y no depende de RLS, por lo que el resultado es predecible.

drop view if exists public.v_nearby_matches;

create or replace function public.get_nearby_matches()
returns table (
  me_id            uuid,
  them_id          uuid,
  username         text,
  display_name     text,
  city_label       text,
  they_have_i_need int,
  i_have_they_need int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller            uuid;
  caller_country    text;
  caller_city_slug  text;
begin
  caller := auth.uid();
  if caller is null then
    return;
  end if;

  select p.country, p.city_slug
    into caller_country, caller_city_slug
  from public.profiles p
  where p.id = caller
    and p.discoverable = true
    and p.country is not null
    and p.city_slug is not null;

  if not found then
    return;
  end if;

  return query
  with candidates as (
    select pr.id, pr.username, pr.display_name, pr.city_label
    from public.profiles pr
    where pr.id <> caller
      and pr.country = caller_country
      and pr.city_slug = caller_city_slug
      and pr.discoverable = true
      and not exists (
        select 1 from public.friendships f
        where (f.user_id = caller and f.friend_id = pr.id)
           or (f.user_id = pr.id and f.friend_id = caller)
      )
  )
  select
    caller                       as me_id,
    c.id                         as them_id,
    c.username,
    c.display_name,
    c.city_label,
    coalesce((
      select count(*)
      from public.sticker_status t
      left join public.sticker_status m
        on m.user_id = caller and m.sticker_code = t.sticker_code
      where t.user_id = c.id
        and t.count > 1
        and coalesce(m.count, 0) = 0
    ), 0)::int as they_have_i_need,
    coalesce((
      select count(*)
      from public.sticker_status m
      left join public.sticker_status t
        on t.user_id = c.id and t.sticker_code = m.sticker_code
      where m.user_id = caller
        and m.count > 1
        and coalesce(t.count, 0) = 0
    ), 0)::int as i_have_they_need
  from candidates c;
end;
$$;

grant execute on function public.get_nearby_matches() to authenticated;
