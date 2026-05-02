-- Versión robusta del generador de username que no depende de
-- request.jwt.claims (que puede no estar seteado durante el INSERT a
-- auth.users en el flow de OAuth). Username genérico tipo `user_xxxx`.
create or replace function public.generate_default_username()
returns text language plpgsql as $$
declare
  candidate text;
  suffix text;
  exists_check int;
begin
  for i in 1..10 loop
    suffix := substring(md5(random()::text || clock_timestamp()::text) from 1 for 4);
    candidate := 'user_' || suffix;
    select count(*) into exists_check from public.profiles where username = candidate;
    if exists_check = 0 then return candidate; end if;
  end loop;
  return 'user_' || substring(md5(random()::text) from 1 for 8);
end;
$$;

-- Trigger versión robusta: si la inserción del profile falla por cualquier
-- motivo, lo logueamos pero no rompemos el INSERT a auth.users (el cliente
-- creará el profile como fallback).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  begin
    insert into public.profiles (id, username, invite_code, display_name, avatar_url)
    values (
      new.id,
      public.generate_default_username(),
      public.generate_invite_code(),
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'avatar_url'
    );
  exception when others then
    raise log 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
