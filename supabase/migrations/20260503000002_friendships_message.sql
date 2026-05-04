-- supabase/migrations/20260503000002_friendships_message.sql

-- Nuevo source para friendships originadas en match nearby
alter type public.friendship_source add value if not exists 'nearby_match';

-- Mensaje opcional adjunto al request (max 280 chars, estilo tweet)
alter table public.friendships
  add column message text check (message is null or length(message) <= 280);
