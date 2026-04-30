create or replace function public.find_user_by_username(uname text)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select id, username, display_name, avatar_url
  from public.profiles
  where username = lower(uname);
$$;

grant execute on function public.find_user_by_username(text) to authenticated;
