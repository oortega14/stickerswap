-- Habilita Realtime broadcast para cambios en sticker_status.
-- Necesario para que P4 pueda escuchar updates de amigos.
alter publication supabase_realtime add table public.sticker_status;
