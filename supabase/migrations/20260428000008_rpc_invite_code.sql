create or replace function public.accept_invite_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select id into target_id from public.profiles where invite_code = upper(code);
  if target_id is null then
    raise exception 'Invalid code' using errcode = '22023';
  end if;
  if target_id = caller_id then
    raise exception 'Cannot add yourself' using errcode = '22023';
  end if;

  insert into public.friendships (user_id, friend_id, status, source)
  values (caller_id, target_id, 'accepted', 'qr_code')
  on conflict (user_id, friend_id) do update set status = 'accepted';

  insert into public.friendships (user_id, friend_id, status, source)
  values (target_id, caller_id, 'accepted', 'qr_code')
  on conflict (user_id, friend_id) do update set status = 'accepted';

  return target_id;
end;
$$;

grant execute on function public.accept_invite_code(text) to authenticated;
