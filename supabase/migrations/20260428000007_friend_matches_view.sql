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
where f.status = 'accepted';
