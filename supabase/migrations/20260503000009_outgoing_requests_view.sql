-- supabase/migrations/20260503000009_outgoing_requests_view.sql

-- Continúa la 008. El valor 'rejected' ya está committed en el enum, así que
-- ahora podemos usarlo en funciones y vistas.

-- 1) decline_friend_request: ahora UPDATE en vez de DELETE — el row sobrevive
--    como 'rejected' para que el remitente lo vea. El remitente lo borra él
--    mismo cuando quiera (delete_my_outgoing_request).
create or replace function public.decline_friend_request(requester_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.friendships
    set status = 'rejected'
    where user_id = requester_id
      and friend_id = auth.uid()
      and status = 'pending';

  if not found then
    raise exception 'request_not_found';
  end if;
end;
$$;

-- 2) RPC nuevo: el remitente borra su propio request (pending o rejected).
--    Sirve para "cancelar" un pending y para "borrar" uno rechazado.
--    Si el row ya está accepted, el sender debería usar unfriend en su lugar
--    (no este RPC).
create function public.delete_my_outgoing_request(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friendships
  where user_id = auth.uid()
    and friend_id = target_id
    and status in ('pending', 'rejected');
end;
$$;

-- 3) Vista de mis requests enviados (pending + rejected).
--    Las accepted no van acá — esas las cubre el flujo de Matches.
create view public.v_outgoing_requests with (security_invoker = on) as
select
  f.friend_id     as recipient_id,
  p.username,
  p.display_name,
  p.city_label,
  f.status,
  f.message,
  f.source,
  f.created_at
from public.friendships f
join public.profiles p on p.id = f.friend_id
where f.user_id = auth.uid() and f.status in ('pending', 'rejected');

grant select on public.v_outgoing_requests to authenticated;
grant execute on function public.delete_my_outgoing_request(uuid) to authenticated;
