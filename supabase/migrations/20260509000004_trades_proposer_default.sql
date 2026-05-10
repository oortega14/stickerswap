-- supabase/migrations/20260509000004_trades_proposer_default.sql
--
-- Sin default, los inserts del cliente debían setear proposer_id; cuando se
-- omitía llegaba NULL y la policy `trades_insert_friends` (que exige
-- auth.uid() = proposer_id) rechazaba con
-- "new row violates row-level security policy for table 'trades'".
-- Default = auth.uid() alinea el schema con el contrato de la RLS.

alter table public.trades
  alter column proposer_id set default auth.uid();
