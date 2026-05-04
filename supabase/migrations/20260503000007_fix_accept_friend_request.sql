-- supabase/migrations/20260503000007_fix_accept_friend_request.sql

-- Bug: accept_friend_request hardcoded source='nearby_match' for the mirror row,
-- which is wrong when accepting a request from qr_code or username_search source.
-- Fix: read original source from the pending row and use it for the mirror.

create or replace function public.accept_friend_request(requester_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  orig_source public.friendship_source;
begin
  update public.friendships
    set status = 'accepted'
    where user_id = requester_id
      and friend_id = auth.uid()
      and status = 'pending'
    returning source into orig_source;

  if not found then
    raise exception 'request_not_found';
  end if;

  -- Mirror row del lado mío con el source original
  insert into public.friendships (user_id, friend_id, status, source)
  values (auth.uid(), requester_id, 'accepted', orig_source)
  on conflict (user_id, friend_id) do update set status = 'accepted';
end;
$$;
