-- supabase/migrations/20260509000002_friend_matches_bidirectional.sql
--
-- View bidireccional de matches: para cada friendship aceptada del
-- usuario actual, expone los stickers que el amigo tiene de sobra y yo
-- no tengo (`direction = 'they_have_you_need'`) y los míos repetidos
-- que él no tiene (`direction = 'you_have_they_need'`).

create or replace view public.v_friend_matches_bidirectional as
-- they have, you need
select
  f.user_id    as me_id,
  f.friend_id  as friend_id,
  ss_friend.sticker_code,
  (ss_friend.count - 1) as extras,
  'they_have_you_need'::text as direction
from public.friendships f
join public.sticker_status ss_me
  on ss_me.user_id = f.user_id
  and ss_me.count = 0
join public.sticker_status ss_friend
  on ss_friend.user_id = f.friend_id
  and ss_friend.sticker_code = ss_me.sticker_code
  and ss_friend.count > 1
where f.status = 'accepted'
  and f.user_id = auth.uid()

union all

-- you have, they need
select
  f.user_id    as me_id,
  f.friend_id  as friend_id,
  ss_me.sticker_code,
  (ss_me.count - 1) as extras,
  'you_have_they_need'::text as direction
from public.friendships f
join public.sticker_status ss_me
  on ss_me.user_id = f.user_id
  and ss_me.count > 1
join public.sticker_status ss_friend
  on ss_friend.user_id = f.friend_id
  and ss_friend.sticker_code = ss_me.sticker_code
  and ss_friend.count = 0
where f.status = 'accepted'
  and f.user_id = auth.uid();
