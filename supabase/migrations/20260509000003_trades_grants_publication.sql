-- supabase/migrations/20260509000003_trades_grants_publication.sql
--
-- Patch para gaps detectados en code review de 20260509000001_trades.sql:
--   1. set search_path = public en los 4 RPCs (seguridad + convención del repo)
--   2. grant execute ... to authenticated en los 4 RPCs (PostgREST lo requiere)
--   3. Agregar public.trades a supabase_realtime publication
--   4. Eliminar policy trades_update_involved (sobre-permisiva; las RPCs
--      security definer son el único camino de escritura intencional)

-- ── 1. set search_path en los 4 RPCs ────────────────────────────────────────

alter function public.trade_respond(uuid, boolean) set search_path = public;
alter function public.trade_cancel(uuid)            set search_path = public;
alter function public.trade_unconfirm(uuid)         set search_path = public;
alter function public.trade_confirm(uuid)           set search_path = public;

-- ── 2. grant execute to authenticated ───────────────────────────────────────

grant execute on function public.trade_respond(uuid, boolean) to authenticated;
grant execute on function public.trade_cancel(uuid)           to authenticated;
grant execute on function public.trade_unconfirm(uuid)        to authenticated;
grant execute on function public.trade_confirm(uuid)          to authenticated;

-- ── 3. Agregar trades a la publication de Realtime ──────────────────────────

do $$
begin
  alter publication supabase_realtime add table public.trades;
exception when duplicate_object then null;
end $$;

-- ── 4. Eliminar policy UPDATE sobre-permisiva ────────────────────────────────

drop policy if exists "trades_update_involved" on public.trades;
