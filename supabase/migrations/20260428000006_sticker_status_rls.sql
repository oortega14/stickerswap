-- Reemplaza la policy de SELECT de P2 por la versión que incluye amigos aceptados
drop policy if exists "select own stickers" on public.sticker_status;

create policy "select own or friends stickers"
  on public.sticker_status for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid()
        and f.friend_id = public.sticker_status.user_id
        and f.status = 'accepted'
    )
  );
