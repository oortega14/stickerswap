-- supabase/migrations/20260514000000_friendship_trade_combo.sql
--
-- Combo amistad+trueque: nuevo enum value + RPC para proponer trueque a
-- desconocidos enviando solicitud de amistad pendiente atómicamente.

-- 1. Extender enum
alter type public.friendship_source add value if not exists 'trade_combo';

-- 2. RPC: propone trueque + crea friendship pending si no existe
create or replace function public.trade_propose_combo(
  p_recipient_id uuid,
  p_gives        text[],
  p_gets         text[],
  p_message      text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade_id uuid;
  v_existing public.friendships%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_recipient_id = auth.uid() then
    raise exception 'cannot_trade_with_self';
  end if;

  -- Guard: arrays must be non-empty
  if p_gives is null or array_length(p_gives, 1) is null or array_length(p_gives, 1) < 1 then
    raise exception 'invalid_sticker_list';
  end if;
  if p_gets is null or array_length(p_gets, 1) is null or array_length(p_gets, 1) < 1 then
    raise exception 'invalid_sticker_list';
  end if;
  if p_message is not null and length(p_message) > 280 then
    raise exception 'message_too_long';
  end if;

  -- Resolver amistad (cualquier dirección)
  select * into v_existing
  from public.friendships
  where (user_id = auth.uid() and friend_id = p_recipient_id)
     or (user_id = p_recipient_id and friend_id = auth.uid())
  limit 1;

  if v_existing.user_id is null then
    -- Sin relación: crear pending del lado del proposer
    insert into public.friendships (user_id, friend_id, status, source)
    values (auth.uid(), p_recipient_id, 'pending', 'trade_combo');
  elsif v_existing.status in ('blocked', 'rejected') then
    raise exception 'friendship_blocked';
  end if;
  -- Si pending o accepted, no tocamos la amistad.

  -- Insertar trade en pending
  insert into public.trades (proposer_id, recipient_id, proposer_gives, proposer_gets, message, status)
  values (auth.uid(), p_recipient_id, p_gives, p_gets, p_message, 'pending')
  returning id into v_trade_id;

  return v_trade_id;
end;
$$;

grant execute on function public.trade_propose_combo(uuid, text[], text[], text) to authenticated;

-- 3a. Trigger: cuando se BORRA una friendship (proposer cancels via DELETE)
--     cancela todos los trades pendientes entre los dos usuarios.
create or replace function public._cancel_combo_trades_on_friendship_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.source = 'trade_combo' and old.status = 'pending' then
    update public.trades
       set status = 'cancelled',
           updated_at = now()
     where status = 'pending'
       and ((proposer_id = old.user_id and recipient_id = old.friend_id)
         or (proposer_id = old.friend_id and recipient_id = old.user_id));
  end if;
  return old;
end;
$$;

drop trigger if exists trg_cancel_combo_trades on public.friendships;
create trigger trg_cancel_combo_trades
  after delete on public.friendships
  for each row
  execute function public._cancel_combo_trades_on_friendship_delete();

-- 3b. Trigger: cuando se ACTUALIZA una friendship a rejected (recipient declines via UPDATE)
--     cancela todos los trades pendientes entre los dos usuarios.
create or replace function public._cancel_combo_trades_on_friendship_reject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trades
     set status = 'cancelled',
         updated_at = now()
   where status = 'pending'
     and ((proposer_id = new.user_id and recipient_id = new.friend_id)
       or (proposer_id = new.friend_id and recipient_id = new.user_id));
  return new;
end;
$$;

drop trigger if exists trg_cancel_combo_trades_on_reject on public.friendships;
create trigger trg_cancel_combo_trades_on_reject
  after update on public.friendships
  for each row
  when (old.status = 'pending' and new.status = 'rejected' and old.source = 'trade_combo')
  execute function public._cancel_combo_trades_on_friendship_reject();
