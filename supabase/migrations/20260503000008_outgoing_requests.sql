-- supabase/migrations/20260503000008_outgoing_requests.sql

-- Estado 'rejected' en el enum. Esta migración NO puede usar el valor nuevo
-- (Postgres prohibe referenciar un enum value en la misma transacción que
-- lo agrega). El resto del cambio (RPCs + view) vive en la migración 009.
alter type public.friendship_status add value if not exists 'rejected';
