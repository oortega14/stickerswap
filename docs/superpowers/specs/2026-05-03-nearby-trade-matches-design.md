# Nearby Trade Matches — Design

**Status:** Approved (brainstorming complete, ready for plan)
**Author:** Oscar + Claude
**Date:** 2026-05-03

## Resumen

Permite que usuarios de la misma ciudad (declarada manualmente) descubran a otros con quienes pueden hacer trades bidireccionales — vos tenés cromos repetidos que ellos necesitan, y ellos tienen repetidos que vos necesitás. La feature reusa la infraestructura existente de friendships: descubrir → solicitar trade (con mensaje opcional) → aceptar → ya son "friends" y aplica el `v_friend_matches` que ya existe.

Diferencia con lo actual: hoy sólo ves matches con amigos que vos agregaste explícitamente (QR / username). Esta feature abre el descubrimiento a desconocidos de tu ciudad sin exponer datos crudos (los counts se calculan server-side y sólo se devuelven agregados).

## Motivación

- La P4 cubre "amigos que vos ya conocés" — chico círculo, descubrimiento manual.
- El usuario hipotético (Oscar en Armenia) quiere intercambiar con cualquier coleccionista local, no sólo con sus contactos.
- Trades bidireccionales son donde está el valor: el match perfecto es alguien con repes complementarias a las tuyas.
- Es la "idea ganadora" de la app según el usuario: convertir el álbum en un mercado local p2p.

## Decisiones de producto (lockeadas en brainstorming)

| Decisión | Elegido | Notas |
|---|---|---|
| Modo de localización | Ciudad manual | Sin GPS, sin permisos de sistema |
| Discoverabilidad por default | Opt-in en onboarding | Default sí marcado, pregunta consciente |
| Input de ciudad | País (dropdown) + ciudad (texto libre) | Slug normalizado para match exacto |
| Ranking | Lista rankeada por score | No "top 1", el usuario elige |
| Score | `min(theyHaveINeed, iHaveTheyNeed)` | Premia trades balanceados |
| Conexión | Reusa `friendships` con `source='nearby_match'` | Mensaje opcional 280 chars |
| Filtrado | Solo `score >= 1` | Sin matches vacíos en la lista |
| UI entry point | Sub-tab "Cerca de mí" en Cambios | Junto a Matches / Mi lista |
| Bloqueo | Reusa `status='blocked'` | Botón secundario en modal |
| Rate limit | 5 requests pending / 24h | Anti-spam mínimo |
| Chat in-app | NO | Coordinan fuera de la app post-accept |
| Reportes / ratings | NO (deferred a v2) | Bloqueo cubre el mínimo |
| Push notifications | NO (deferred) | Pendiente Apple Developer license |

## Arquitectura

### Data model

#### Migración `profiles_location.sql`

```sql
alter table public.profiles
  add column country  text,                                    -- ISO-2 ('CO', 'MX', 'AR'…) o 'OT' (otro)
  add column city_slug text,                                   -- 'armenia', 'bogota'
  add column city_label text,                                  -- 'Armenia' (display)
  add column discoverable boolean not null default false;

create index idx_profiles_location on public.profiles (country, city_slug)
  where discoverable = true;

-- Constraint: si discoverable=true, country y city_slug deben estar seteados.
alter table public.profiles
  add constraint profiles_discoverable_requires_location
  check (
    discoverable = false
    or (country is not null and city_slug is not null)
  );
```

#### Migración `friendships_message.sql`

```sql
alter type public.friendship_source add value 'nearby_match';

alter table public.friendships
  add column message text check (length(message) <= 280);
```

#### Vista `v_nearby_matches`

**Nota importante**: el server NO tiene una tabla master de stickers (el dataset vive en `assets/stickers.json` y se siembra en SQLite local en cada device). La vista entonces NO puede usar `cross join public.stickers` — debe trabajar solo con `sticker_status`. Esto es viable porque "needed" puede inferirse como "no existe row" o "row.count = 0".

```sql
create view public.v_nearby_matches with (security_invoker = off) as
with me as (
  select id, country, city_slug
  from public.profiles
  where id = auth.uid() and discoverable = true and country is not null and city_slug is not null
),
candidates as (
  select p.id, p.username, p.display_name, p.city_label
  from public.profiles p, me
  where p.id <> me.id
    and p.country = me.country
    and p.city_slug = me.city_slug
    and p.discoverable = true
    and not exists (
      select 1 from public.friendships f
      where (f.user_id = me.id and f.friend_id = p.id)
         or (f.user_id = p.id and f.friend_id = me.id)
    )
),
-- they_have_i_need: cromos donde ellos tienen repe (count > 1) y yo no tengo (no row, o count = 0)
their_extras as (
  select c.id as them_id, t.sticker_code
  from candidates c
  join public.sticker_status t on t.user_id = c.id and t.count > 1
  left join public.sticker_status m on m.user_id = (select id from me) and m.sticker_code = t.sticker_code
  where coalesce(m.count, 0) = 0
),
-- i_have_they_need: cromos donde yo tengo repe y ellos no tienen
my_extras as (
  select c.id as them_id, m.sticker_code
  from candidates c
  join public.sticker_status m on m.user_id = (select id from me) and m.count > 1
  left join public.sticker_status t on t.user_id = c.id and t.sticker_code = m.sticker_code
  where coalesce(t.count, 0) = 0
)
select
  (select id from me)        as me_id,
  c.id                       as them_id,
  c.username,
  c.display_name,
  c.city_label,
  coalesce((select count(*) from their_extras te where te.them_id = c.id), 0) as they_have_i_need,
  coalesce((select count(*) from my_extras me2  where me2.them_id = c.id), 0) as i_have_they_need
from candidates c;

grant select on public.v_nearby_matches to authenticated;
```

**Nota crítica de seguridad**: la vista usa `security_invoker = off` para que pueda leer `sticker_status` de otros usuarios en el join, **pero solo emite los counts agregados** — los códigos individuales nunca salen del servidor. Esto es lo que mantiene la privacidad sin tener que relajar las RLS de `sticker_status`.

**Performance**: `sticker_status` ya tiene índice en `(user_id)`. Para esta vista conviene también `(user_id, count)` partial index donde `count > 1` para acelerar el filter de extras. Lo agregamos en la misma migración.

#### Vista `v_pending_incoming_requests`

```sql
create view public.v_pending_incoming_requests with (security_invoker = on) as
select
  f.user_id     as requester_id,
  p.username,
  p.display_name,
  p.city_label,
  f.message,
  f.source,
  f.created_at
from public.friendships f
join public.profiles p on p.id = f.user_id
where f.friend_id = auth.uid() and f.status = 'pending';
```

(`security_invoker = on` porque RLS de `friendships` ya filtra a `friend_id = auth.uid()`.)

### RPCs

#### `request_nearby_trade(target_id uuid, msg text)`

```sql
create function public.request_nearby_trade(target_id uuid, msg text default null)
returns void
language plpgsql security definer as $$
declare
  pending_count int;
begin
  -- Rate limit: máximo 5 pending creados por mí en las últimas 24h
  select count(*) into pending_count
  from public.friendships
  where user_id = auth.uid()
    and status = 'pending'
    and source = 'nearby_match'
    and created_at > now() - interval '24 hours';

  if pending_count >= 5 then
    raise exception 'too_many_requests';
  end if;

  -- Validar que ambos usuarios estén discoverable y en la misma ciudad
  if not exists (
    select 1 from public.profiles me, public.profiles them
    where me.id = auth.uid() and them.id = target_id
      and me.discoverable = true and them.discoverable = true
      and me.country = them.country and me.city_slug = them.city_slug
  ) then
    raise exception 'not_in_same_city';
  end if;

  -- Validar mensaje
  if msg is not null and length(msg) > 280 then
    raise exception 'message_too_long';
  end if;

  insert into public.friendships (user_id, friend_id, status, source, message)
  values (auth.uid(), target_id, 'pending', 'nearby_match', msg)
  on conflict (user_id, friend_id) do nothing;
end;
$$;

grant execute on function public.request_nearby_trade(uuid, text) to authenticated;
```

#### `accept_friend_request(requester_id uuid)` y `decline_friend_request(requester_id uuid)`

```sql
create function public.accept_friend_request(requester_id uuid)
returns void
language plpgsql security definer as $$
begin
  update public.friendships
    set status = 'accepted'
    where user_id = requester_id and friend_id = auth.uid() and status = 'pending';

  if not found then
    raise exception 'request_not_found';
  end if;

  -- Crear mirror row del lado mío
  insert into public.friendships (user_id, friend_id, status, source)
  values (auth.uid(), requester_id, 'accepted', 'nearby_match')
  on conflict (user_id, friend_id) do update set status = 'accepted';
end;
$$;

create function public.decline_friend_request(requester_id uuid)
returns void
language plpgsql security definer as $$
begin
  delete from public.friendships
  where user_id = requester_id and friend_id = auth.uid() and status = 'pending';
end;
$$;

grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.decline_friend_request(uuid) to authenticated;
```

### Cliente

#### Onboarding

Nuevo paso en `app/onboarding/[step].tsx` después de username, antes de `onboarding_completed`. Pide:
- País (dropdown — lista 48 World Cup countries + "Otro" mapeado a 'OT'). Default sniff por `Localization.region`.
- Ciudad (TextInput). Al guardar, deriva `city_slug` localmente (lowercased + `String.normalize('NFD').replace(/[̀-ͯ]/g, '')` para quitar tildes + `replace(/\s+/g, '-')`).
- Checkbox "Quiero que personas de mi ciudad puedan encontrarme para intercambiar". Default `true`. Copy explica el efecto.

Al continuar, hace `update profiles set country, city_slug, city_label, discoverable, onboarding_completed = true where id = auth.uid()`.

#### Profile edit

`app/profile/edit.tsx` agrega sección "Ubicación e intercambios":
- Cambiar país / ciudad / discoverable.
- Texto chico bajo el toggle: "Si lo apagás, dejás de aparecer en 'Cerca de mí' de otros usuarios. Tus matches con amigos siguen funcionando."

#### Tab "Cerca de mí"

`app/(tabs)/trades.tsx` cambia el `SegmentedControl`: agrega tercer valor `nearby`. Render:

```
Cerca de mí · Armenia, CO

[fila por usuario]
  @username
  necesitás N · podés dar M
  ▬▬▬▬▬▬▬▬ score (visual del min)
```

Si el usuario no tiene `discoverable = true` → empty state con CTA "Activá la discoverabilidad en Perfil → Editar".

Tap en una fila → `app/nearby/[username].tsx` modal:
- Header: @username, ciudad
- Lista de cromos que ellos tienen / vos necesitás (sample limitado a primeros 20, "y X más")
- Lista de cromos que vos tenés / ellos necesitan
- TextInput "Mensaje (opcional)"
- Botón primario "Solicitar trade" → `request_nearby_trade(themId, msg)` → toast → cierra modal → fila desaparece de "Cerca de mí" (porque ahora hay friendship pending).

#### Inbox de pending

Nueva pantalla `app/profile/requests.tsx` accesible desde Perfil → "Solicitudes". Lista `v_pending_incoming_requests` con botones [Aceptar] [Rechazar] por fila. Cuando aceptás, la friendship pasa a accepted y aparece en `Matches`.

Badge numérico en el tab "Cambios" cuando `pendingRequests.length > 0` — similar al `pending` count de sync que ya existe.

#### Realtime

Reusamos el bridge existente (P4). La subscription a `friendships` ya está activa. Cuando llega un row `pending` nuevo donde `friend_id = auth.uid()`, refetch de pending requests + actualizar badge.

### Hooks y archivos nuevos

```
src/hooks/useNearbyMatches.ts        — TanStack Query → v_nearby_matches
src/hooks/usePendingRequests.ts      — v_pending_incoming_requests + count
src/social/nearbyMatches.ts          — fetchers + RPC wrappers
src/social/locationProfile.ts        — update country/city/discoverable
src/lib/citySlug.ts                  — normalización (NFD + lowercase + slug)
src/domain/types.ts                  — añade NearbyMatch, PendingRequest
src/domain/nearbyScore.ts            — score = min, sort desc, filter >= 1 (lógica pura)

tests/domain/nearbyScore.test.ts     — TDD del score + sort + filter
tests/lib/citySlug.test.ts           — normalización con tildes, espacios, mayúsculas
tests/social/nearbyMatches.test.ts   — integration con sqlite mock + supabase mock

app/onboarding/location.tsx          — nuevo step (step 3 en _layout)
app/profile/edit.tsx                 — añadir sección
app/profile/requests.tsx             — inbox de pending
app/(tabs)/trades.tsx                — añadir sub-tab "nearby"
app/nearby/[username].tsx            — modal detalle + request
```

### Migraciones SQL

```
supabase/migrations/20260503000001_profiles_location.sql
supabase/migrations/20260503000002_friendships_message.sql
supabase/migrations/20260503000003_v_nearby_matches.sql
supabase/migrations/20260503000004_v_pending_requests.sql
supabase/migrations/20260503000005_rpc_nearby_trade.sql
supabase/migrations/20260503000006_rpc_friend_request.sql
```

## Edge cases

- **Match vacío** (yo no tengo nada que ellos necesiten o viceversa): `score = 0` → la vista lo deja pasar pero el cliente filtra `>= 1`. Así si en el futuro queremos mostrar "asimétricos" no hay que cambiar la SQL.
- **Sticker_status desincronizado**: la vista lee del estado servidor. Si tengo cambios locales pendientes en `sync_queue`, mi score puede estar desactualizado hasta el próximo drain. Aceptable: drain corre cada 30s.
- **Rate limit hit**: cliente captura `too_many_requests` y muestra "Llegaste al límite de 5 solicitudes por día. Esperá a que respondan o cancelalas".
- **Cancelar request enviado**: NO en MVP. El que envía no puede cancelar; el receptor decide. Se puede agregar después con un `cancel_friend_request` RPC si causa fricción.
- **Cambio de ciudad**: el `update profiles` cambia el match pool inmediato. Sin trabajo extra en el cliente — la vista re-calcula en cada query.
- **Borrar cuenta**: la migración existente `20260428000010_delete_account.sql` ya cubre la limpieza por cascade.
- **País 'OT' (Otro)**: solo matchea con otros 'OT'+misma ciudad. Pool chico pero coherente.
- **Onboarding sin location**: el constraint `profiles_discoverable_requires_location` permite `discoverable=false` con `country/city_slug` nulos. Si el usuario destilda discoverable en onboarding, puede dejar la ciudad en blanco y completarla después en Profile. Si la deja marcada, la pantalla bloquea el "Continuar" hasta que llene país y ciudad.
- **Rate limit cuenta solo `pending`**: requests aceptados o rechazados liberan el cupo (no penaliza al que envía requests legítimos que el receptor procesó).

## Privacy

- `sticker_status` RLS no se relaja. La vista `v_nearby_matches` es `security_invoker = off` y solo emite agregados.
- `profiles.country/city_slug/city_label` son visibles para todos los authenticated (igual que `username` hoy). Acceptable: ya sos descubrible si te tildeaste discoverable.
- Si `discoverable = false`, la vista te excluye del pool. Apagar el toggle te saca de la lista de otros en tiempo real (siguiente query). No hay caching agresivo.

## Tests

Cubrimos con TDD lo siguiente (siguiendo la convención del proyecto: lógica pura + data layer):

- `nearbyScore.test.ts`: score = min, ordena desc, filtra `>= 1`, empata estable por username.
- `citySlug.test.ts`: 'Bogotá' → 'bogota', 'San José' → 'san-jose', 'ARMENIA  ' → 'armenia', vacío → vacío.
- `nearbyMatches.test.ts`: fetchear y mapear shape, request idempotente (segundo call no crea fila duplicada), rate limit dispara error tipado.

No testeamos UI con snapshots (convención del proyecto).

## Lo que NO hago (deferred a v2)

- Chat in-app — coordinan por fuera post-accept.
- Reportes / abuse — bloqueo cubre el mínimo.
- Reputación / ratings — ningún feedback loop por trade cumplido.
- "Mis trades pendientes" en agenda — el `v_friend_matches` post-accept ya muestra qué intercambiar.
- GPS preciso / sub-zonas dentro de ciudad — ciudad manual es suficiente al inicio.
- Push notifications — pendiente Apple Developer license.
- Cancelar request enviado — el receptor decide, simplifica MVP.
- "Asimétrico" (sólo ellos tienen lo que yo necesito, yo no tengo nada para dar) — ya lo cubre el `v_friend_matches` existente una vez son friends.
- Filtros avanzados (por equipo, por sección) — cuando la lista crezca.
- Onboarding paso skipable — por ahora obligatorio (con default discoverable=true).

## Definition of done

- [ ] Migraciones SQL aplicadas y testeadas en local Supabase.
- [ ] `pnpm test` verde con los nuevos tests.
- [ ] `pnpm exec tsc --noEmit` clean.
- [ ] Onboarding nuevo paso integrado, no rompe el flow existente.
- [ ] Profile edit muestra y persiste country/city/discoverable.
- [ ] Tab "Cerca de mí" lista usuarios y abre modal de request.
- [ ] Request nearby llega vía realtime al inbox del receptor.
- [ ] Aceptar request mueve la friendship a `accepted` y aparece en `Matches`.
- [ ] Bloqueo desde el modal saca al usuario del pool.
- [ ] Rate limit dispara error tipado y UI lo muestra.
- [ ] Apagar discoverable saca al usuario del pool de otros.
