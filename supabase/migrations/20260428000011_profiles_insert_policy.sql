-- Permitir que un usuario inserte su propio profile (id = auth.uid()).
-- Hace falta para el fallback del cliente cuando el trigger handle_new_user
-- no se ejecutó por algún motivo.
create policy "insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());
