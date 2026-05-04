-- supabase/migrations/20260503000010_fix_friend_matches_self.sql

-- Bug: v_friend_matches no filtraba por auth.uid(), así que para una
-- friendship aceptada con dos rows (mía y mirror del otro), el cliente
-- recibía matches en AMBAS direcciones — el usuario veía a sí mismo en su
-- propia lista de "Matches".
-- Fix: limitar al lado donde yo soy el `user_id` (mi perspectiva).

create or replace view public.v_friend_matches as
select
  f.user_id           as me_id,
  f.friend_id         as friend_id,
  ss_friend.sticker_code,
  (ss_friend.count - 1) as extras
from public.friendships f
join public.sticker_status ss_me
  on ss_me.user_id = f.user_id
  and ss_me.count = 0
join public.sticker_status ss_friend
  on ss_friend.user_id = f.friend_id
  and ss_friend.sticker_code = ss_me.sticker_code
  and ss_friend.count > 1
where f.status = 'accepted'
  and f.user_id = auth.uid();
