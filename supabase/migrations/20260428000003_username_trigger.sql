-- Generador de username default y invite_code, ambos únicos
create or replace function public.generate_default_username()
returns text language plpgsql as $$
declare
  base text;
  candidate text;
  suffix text;
  exists_check int;
begin
  base := lower(regexp_replace(coalesce(current_setting('request.jwt.claims', true)::json->>'email', 'user'), '[^a-z0-9]', '', 'g'));
  base := substring(base from 1 for 12);
  if length(base) < 3 then base := 'user'; end if;

  for i in 1..10 loop
    suffix := substring(md5(random()::text || clock_timestamp()::text) from 1 for 4);
    candidate := base || '_' || suffix;
    select count(*) into exists_check from public.profiles where username = candidate;
    if exists_check = 0 then return candidate; end if;
  end loop;

  return base || '_' || substring(md5(random()::text) from 1 for 8);
end;
$$;

create or replace function public.generate_invite_code()
returns text language plpgsql as $$
declare
  candidate text;
  exists_check int;
begin
  for i in 1..10 loop
    candidate := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    select count(*) into exists_check from public.profiles where invite_code = candidate;
    if exists_check = 0 then return candidate; end if;
  end loop;
  return upper(substring(md5(random()::text) from 1 for 12));
end;
$$;

-- Cuando un usuario se crea en auth.users, insertamos su profile con defaults
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, invite_code, display_name, avatar_url)
  values (
    new.id,
    public.generate_default_username(),
    public.generate_invite_code(),
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
