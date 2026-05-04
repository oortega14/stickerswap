-- supabase/migrations/20260503000006_rpc_friend_requests.sql

create function public.accept_friend_request(requester_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.friendships
    set status = 'accepted'
    where user_id = requester_id
      and friend_id = auth.uid()
      and status = 'pending';

  if not found then
    raise exception 'request_not_found';
  end if;

  -- Mirror row del lado mío
  insert into public.friendships (user_id, friend_id, status, source)
  values (auth.uid(), requester_id, 'accepted', 'nearby_match')
  on conflict (user_id, friend_id) do update set status = 'accepted';
end;
$$;

create function public.decline_friend_request(requester_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friendships
  where user_id = requester_id
    and friend_id = auth.uid()
    and status = 'pending';
end;
$$;

grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.decline_friend_request(uuid) to authenticated;
