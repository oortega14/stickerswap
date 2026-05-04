-- supabase/migrations/20260503000005_rpc_nearby_trade.sql

create function public.request_nearby_trade(target_id uuid, msg text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_count int;
  same_city boolean;
begin
  -- Validar mensaje
  if msg is not null and length(msg) > 280 then
    raise exception 'message_too_long';
  end if;

  -- Validar misma ciudad y ambos discoverable
  select exists (
    select 1
    from public.profiles me, public.profiles them
    where me.id = auth.uid()
      and them.id = target_id
      and me.discoverable = true
      and them.discoverable = true
      and me.country is not distinct from them.country
      and me.city_slug is not distinct from them.city_slug
  ) into same_city;

  if not same_city then
    raise exception 'not_in_same_city';
  end if;

  -- Rate limit: máximo 5 pending por nearby creados por mí en las últimas 24h
  select count(*) into pending_count
  from public.friendships
  where user_id = auth.uid()
    and status = 'pending'
    and source = 'nearby_match'
    and created_at > now() - interval '24 hours';

  if pending_count >= 5 then
    raise exception 'too_many_requests';
  end if;

  -- Crear el row pending. Si ya existe (cualquier estado/source) es no-op.
  insert into public.friendships (user_id, friend_id, status, source, message)
  values (auth.uid(), target_id, 'pending', 'nearby_match', msg)
  on conflict (user_id, friend_id) do nothing;
end;
$$;

grant execute on function public.request_nearby_trade(uuid, text) to authenticated;
