-- supabase/migrations/20260509000001_trades.sql
--
-- Tabla `trades`: propuestas de intercambio bidireccional entre amigos
-- aceptados. Las transiciones (respond/cancel/confirm) viven en RPCs
-- `security definer` para aplicar el delta atómico sobre sticker_status
-- de ambos lados sin que RLS bloquee la operación cross-user.

create table public.trades (
  id            uuid primary key default gen_random_uuid(),
  proposer_id   uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,

  proposer_gives text[] not null check (array_length(proposer_gives, 1) >= 1),
  proposer_gets  text[] not null check (array_length(proposer_gets, 1) >= 1),

  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled','completed')),

  proposer_confirmed_at  timestamptz,
  recipient_confirmed_at timestamptz,

  message text check (length(message) <= 280),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz,

  check (proposer_id <> recipient_id)
);

create index trades_proposer_status_idx on public.trades (proposer_id, status);
create index trades_recipient_status_idx on public.trades (recipient_id, status);

alter table public.trades enable row level security;

create policy "trades_select_involved" on public.trades for select
  using (auth.uid() in (proposer_id, recipient_id));

create policy "trades_insert_friends" on public.trades for insert
  with check (
    auth.uid() = proposer_id
    and exists (
      select 1 from public.friendships
      where status = 'accepted'
        and ((user_id = proposer_id and friend_id = recipient_id)
          or  (user_id = recipient_id and friend_id = proposer_id))
    )
  );

-- UPDATE solo se permite via RPCs (security definer). Esta policy permite
-- al cliente leer el row después de un UPDATE pero no editar arbitrariamente
-- ya que las RPCs son las únicas que escriben.
create policy "trades_update_involved" on public.trades for update
  using (auth.uid() in (proposer_id, recipient_id))
  with check (auth.uid() in (proposer_id, recipient_id));

-- Realtime requiere replica identity full para que el filtro funcione bien
-- con postgres_changes filtrando por columnas (proposer_id/recipient_id).
alter table public.trades replica identity full;

-- ────────────────────────────────────────────────────────────
-- RPCs
-- ────────────────────────────────────────────────────────────

create or replace function public.trade_respond(p_trade uuid, p_accept boolean)
returns void language plpgsql security definer as $$
begin
  update public.trades
     set status = case when p_accept then 'accepted' else 'declined' end,
         updated_at = now()
   where id = p_trade
     and recipient_id = auth.uid()
     and status = 'pending';
  if not found then raise exception 'trade_not_pending'; end if;
end $$;

create or replace function public.trade_cancel(p_trade uuid)
returns void language plpgsql security definer as $$
begin
  update public.trades
     set status = 'cancelled', updated_at = now()
   where id = p_trade
     and proposer_id = auth.uid()
     and status = 'pending';
  if not found then raise exception 'trade_not_cancellable'; end if;
end $$;

create or replace function public.trade_unconfirm(p_trade uuid)
returns void language plpgsql security definer as $$
declare
  is_proposer boolean;
begin
  select (proposer_id = auth.uid()) into is_proposer
    from public.trades where id = p_trade and status = 'accepted'
    for update;
  if not found then raise exception 'trade_not_unconfirmable'; end if;
  if is_proposer then
    update public.trades set proposer_confirmed_at = null, updated_at = now()
     where id = p_trade;
  else
    update public.trades set recipient_confirmed_at = null, updated_at = now()
     where id = p_trade;
  end if;
end $$;

create or replace function public.trade_confirm(p_trade uuid)
returns text language plpgsql security definer as $$
declare
  t record;
  is_proposer boolean;
  both_done boolean;
  code text;
begin
  select * into t from public.trades where id = p_trade for update;
  if not found or t.status <> 'accepted' then
    raise exception 'trade_not_confirmable';
  end if;
  if auth.uid() not in (t.proposer_id, t.recipient_id) then
    raise exception 'not_involved';
  end if;

  is_proposer := (auth.uid() = t.proposer_id);

  if is_proposer and t.proposer_confirmed_at is null then
    update public.trades set proposer_confirmed_at = now(), updated_at = now()
     where id = p_trade;
  elsif not is_proposer and t.recipient_confirmed_at is null then
    update public.trades set recipient_confirmed_at = now(), updated_at = now()
     where id = p_trade;
  end if;

  select (proposer_confirmed_at is not null and recipient_confirmed_at is not null)
    into both_done
    from public.trades where id = p_trade;

  if both_done then
    -- Aplicar delta: -1 a quien dio, +1 a quien recibió. Ambos lados.
    foreach code in array t.proposer_gives loop
      update public.sticker_status
         set count = greatest(count - 1, 0), updated_at = now()
       where user_id = t.proposer_id and sticker_code = code;
      insert into public.sticker_status (user_id, sticker_code, count, updated_at)
      values (t.recipient_id, code, 1, now())
      on conflict (user_id, sticker_code) do update
        set count = public.sticker_status.count + 1, updated_at = now();
    end loop;
    foreach code in array t.proposer_gets loop
      update public.sticker_status
         set count = greatest(count - 1, 0), updated_at = now()
       where user_id = t.recipient_id and sticker_code = code;
      insert into public.sticker_status (user_id, sticker_code, count, updated_at)
      values (t.proposer_id, code, 1, now())
      on conflict (user_id, sticker_code) do update
        set count = public.sticker_status.count + 1, updated_at = now();
    end loop;

    update public.trades
       set status = 'completed', completed_at = now(), updated_at = now()
     where id = p_trade;
    return 'completed';
  end if;

  return 'awaiting_other';
end $$;
