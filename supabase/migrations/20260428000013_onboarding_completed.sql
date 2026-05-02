-- Marca explícita de "el usuario completó el onboarding". Sin esto, el gate
-- depende del regex sobre el username auto-generado, lo que no permite que el
-- usuario acepte el username default sin cambiarlo (caería en loop).
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;
