-- supabase/migrations/20260514000000_friendship_trade_combo_enum.sql
--
-- Combo amistad+trueque (parte 1): extiende el enum friendship_source con
-- el valor 'trade_combo'. Postgres no permite usar un enum value nuevo en
-- la misma transacción donde se agrega, así que el RPC y triggers que
-- consumen este valor viven en la migración _rpc separada.

alter type public.friendship_source add value if not exists 'trade_combo';
