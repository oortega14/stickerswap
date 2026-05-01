create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  -- Cascadea por FKs ON DELETE CASCADE en profiles, sticker_status, friendships
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
