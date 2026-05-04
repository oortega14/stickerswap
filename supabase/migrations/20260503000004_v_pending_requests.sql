-- supabase/migrations/20260503000004_v_pending_requests.sql

-- Vista de requests pending recibidos por el usuario actual.
-- security_invoker=on porque la RLS de friendships ya filtra a friend_id=auth.uid().
create view public.v_pending_incoming_requests with (security_invoker = on) as
select
  f.user_id     as requester_id,
  p.username,
  p.display_name,
  p.city_label,
  f.message,
  f.source,
  f.created_at
from public.friendships f
join public.profiles p on p.id = f.user_id
where f.friend_id = auth.uid() and f.status = 'pending';

grant select on public.v_pending_incoming_requests to authenticated;
