# Remover tab Álbum + flujo de intercambios bilateral

**Fecha:** 2026-05-09
**Estado:** diseño aprobado, pendiente plan de implementación
**Versión target:** `1.1.0-beta.1`

## Contexto

La app hoy tiene 4 tabs: Home · Álbum · Cambios · Perfil.

- **Álbum** (`app/(tabs)/album.tsx`) muestra los 994 cromos en un grid plano de 4 columnas con filtros (Todos/Faltan/Repetidas) y búsqueda. Es redundante: el Home ya navega por equipo y `/team/[code]` muestra los 20 cromos de cada selección. El usuario reportó que no le ve funcionalidad.

- **Cambios** (`app/(tabs)/trades.tsx`) tiene 3 sub-tabs (Matches / Cerca de mí / Solicitudes). El sub-tab Matches solo muestra "qué cromos te faltan que el otro tiene" — unidireccional. El detalle del amigo (`app/friends/[username].tsx`) sí muestra ambos lados pero como texto plano (`FWC-1, MEX-3, ARG-12…`). No hay flujo in-app para coordinar el intercambio: la única acción es abrir WhatsApp/Instagram.

El builder bidireccional ya existe (`src/domain/friendMatchBuilder.ts::buildBidirectional`) pero su segundo lado (`youHaveTheyNeed`) no se expone en el listado de Cambios.

## Objetivo

1. Eliminar la tab Álbum (3 tabs en lugar de 4).
2. Convertir Cambios en un flujo de intercambio real: ver balance bidireccional con cromos visuales, proponer un trade con cromos específicos, aceptar/rechazar, confirmar bilateralmente, y aplicar el delta a `sticker_status` automáticamente al completarse.

## No-objetivos

- Chat / mensajería persistente — los botones de WhatsApp/Instagram cubren la charla informal.
- Push notifications nativas (depende de Apple Developer paga; se difiere a P6 distribución).
- Foto del jugador en cromos — el dataset actual no la tiene; los thumbs reusan colores de equipo + número, coherente con el resto de la app.
- Histórico extenso de trades completados — solo banner verde 24h post-completado; profundizamos si hay demanda.
- Búsqueda global por jugador/número (era una afford. de Álbum) — si vuelve a hacer falta, se suma como modal del Home, no como tab.

---

## 1. Estructura de tabs

**Antes:** Home · Álbum · Cambios · Perfil
**Después:** Home · Cambios · Perfil

`app/(tabs)/_layout.tsx` pierde el `<Tabs.Screen name="album" …>`. El archivo `app/(tabs)/album.tsx` se borra. El Home sigue teniendo el botón "⇄ Intercambios" como atajo, y la tab Cambios mantiene su badge de pending requests.

**Limpieza de huérfanos:** antes de borrar, `grep -r "useFilters\|FilterChip\|SkeletonAlbumGrid"` en `src/` y `app/`. Si solo los usaba `album.tsx`, se eliminan también. `AnimatedStickerCell` se mantiene (lo usa `/team/[code]`).

## 2. Modelo de datos

### Tabla `trades`

```sql
create table public.trades (
  id            uuid primary key default gen_random_uuid(),
  proposer_id   uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,

  proposer_gives text[] not null check (array_length(proposer_gives, 1) >= 1),
  proposer_gets  text[] not null check (array_length(proposer_gets, 1) >= 1),

  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled','completed')),

  proposer_confirmed_at  timestamptz,
  recipient_confirmed_at timestamptz,

  message text check (length(message) <= 280),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  completed_at timestamptz,

  check (proposer_id <> recipient_id)
);

create index trades_proposer_status_idx on public.trades (proposer_id, status);
create index trades_recipient_status_idx on public.trades (recipient_id, status);
```

### RLS

```sql
alter table public.trades enable row level security;

create policy "trades_select_involved" on public.trades for select
  using (auth.uid() in (proposer_id, recipient_id));

create policy "trades_insert_friends" on public.trades for insert
  with check (
    auth.uid() = proposer_id
    and exists (
      select 1 from public.friendships
      where status = 'accepted'
        and ((user_id = proposer_id and friend_id = recipient_id)
          or (user_id = recipient_id and friend_id = proposer_id))
    )
  );

create policy "trades_update_involved" on public.trades for update
  using (auth.uid() in (proposer_id, recipient_id));
```

### RPCs

Las transiciones críticas y el delta atómico viven en RPCs `security definer`. Las policies bloquean updates arbitrarios; el cliente solo invoca RPCs.

- `trade_respond(p_trade uuid, p_accept boolean)` — solo `recipient`, solo si `status = 'pending'`. Setea `accepted` o `declined`.
- `trade_cancel(p_trade uuid)` — solo `proposer`, solo si `pending`. Setea `cancelled`.
- `trade_confirm(p_trade uuid)` — proposer o recipient, solo si `accepted`. Marca el timestamp del que llama. Si ambos timestamps quedan no-nulos, aplica el delta y setea `completed`. Devuelve `'completed'` o `'awaiting_other'`.
- `trade_unconfirm(p_trade uuid)` — limpia tu timestamp si todavía no completó. Permite "deshacer" un toque accidental.

**Delta atómico (dentro de `trade_confirm` cuando ambos confirmaron):**

```sql
foreach code in array t.proposer_gives loop
  -- proposer pierde una repe
  update sticker_status set count = greatest(count - 1, 0), updated_at = now()
   where user_id = t.proposer_id and sticker_code = code;
  -- recipient gana una pegada (o crea row count=1)
  insert into sticker_status (user_id, sticker_code, count, updated_at)
  values (t.recipient_id, code, 1, now())
  on conflict (user_id, sticker_code) do update
    set count = sticker_status.count + 1, updated_at = now();
end loop;
-- mismo patrón inverso para proposer_gets
```

`greatest(count - 1, 0)` evita ir a negativo si el usuario ya destildó la repe manualmente entre el accept y el confirm.

### Decisión: dos confirmaciones (no una)

Si el proposer pudiera marcar "ya lo hice" solo, podría descontarle repes al recipient sin permiso. Confirmación bilateral garantiza que el delta solo se aplica con consentimiento de ambos. Cuesta un toque extra a cambio de seguridad simétrica.

### Restricciones implícitas

No agregamos índice único partial para "un solo trade activo por par" — se valida en cliente al abrir el modal (chequea si ya hay `pending` o `accepted` con esa persona y deshabilita el CTA con explicación). Si crece como pain point se sube a la DB después.

## 3. Cliente: domain + data + hooks

### Domain (lógica pura, testeable sin device)

- `src/domain/tradeProposalBuilder.ts`
  - `buildDefaultProposal(bidirectional: BidirectionalMatch): TradeProposalDraft`
    - Pre-selecciona todos los cromos de ambos lados.
    - Marca el draft como inválido si algún lado queda vacío.
  - Idempotente: aplicar dos veces da el mismo resultado.

- `src/domain/tradeStateMachine.ts`
  - `nextStatus(current: TradeStatus, event: TradeEvent): TradeStatus | 'invalid'`
  - `ctaFor(role: 'proposer' | 'recipient', trade: Trade): TradeCta`
    - Devuelve `{ kind: 'waiting' | 'respond' | 'mark_done' | 'awaiting_other' | 'confirm' | 'completed' | 'none', label: string, action?: TradeAction }`.
    - Tabla completa cubierta en tests.

- `src/domain/types.ts` (ampliar)
  - `Trade`, `TradeStatus`, `TradeProposalDraft`, `TradeCta`, `TradeEvent`.
  - Ampliar `FriendMatchSummary` con `theyHaveYouNeed: string[]` y `youHaveTheyNeed: string[]` (full lists, no solo sample).

### Data layer

- `src/data/trades.ts`
  - Tabla SQLite `trades` (espejo del Postgres relevante para vista offline).
  - `listTradesForFriend(friendId)`, `getActiveTrade(friendId)`, `upsertTrade(trade)`, `removeTrade(id)`.
  - Sin queue local de mutaciones — los trades son colaborativos y necesitan respuesta del backend; no encolamos. El usuario ve un loading inline al proponer/aceptar/confirmar.

- `src/social/trades.ts`
  - `proposeTrade({ recipientId, gives, gets, message })` → INSERT directo respetando RLS.
  - `respondTrade(tradeId, accept)`, `cancelTrade(tradeId)`, `confirmTrade(tradeId)`, `unconfirmTrade(tradeId)` → invocan RPCs.
  - `fetchActiveTrades()` → todos los trades del usuario en `pending | accepted`.

- `src/social/tradesRealtime.ts`
  - Channel `trades:${userId}` filtrado por `or(proposer_id=eq.${userId},recipient_id=eq.${userId})`.
  - On cambio, invalida `['trades']` y `['matches']` (porque al `completed` el set de matches cambia).
  - Comparando estado previo vs nuevo, dispara `Snackbar` con mensaje contextual ("@x aceptó tu propuesta", "@x marcó como hecho", "@x rechazó").

### Hooks (TanStack Query)

- `useTrades()` — todos los activos del usuario, con cache local fallback.
- `useTradeForFriend(friendId)` — el trade activo (si existe) con un amigo específico.
- `useProposeTrade()`, `useRespondTrade()`, `useConfirmTrade()`, `useCancelTrade()`, `useUnconfirmTrade()` — mutations con invalidación.

### Cambios en hooks existentes

- `src/hooks/useMatches.ts` y `src/social/friendships.ts::fetchMatches`
  - Devolver para cada amigo `{ friendId, theyHaveYouNeed: string[], youHaveTheyNeed: string[] }` (ambos lados, full).
  - `summarizeMatches` (`src/domain/friendMatchBuilder.ts`) refleja ambos lados en el summary.
  - `src/data/friendsLocal.ts::listAllCachedMatches` actualiza el shape cacheado.

## 4. UI

### `MatchCard` (nuevo componente, reemplaza el render inline en `MatchesView`)

```
┌─────────────────────────────────────────┐
│ @juanperez            ⚠ trade pendiente │
│                                          │
│  🎯 Querés 12      🎁 Le das 8          │
│  ▢ ▢ ▢ ▢ +8        ▢ ▢ ▢ ▢ +4           │
│                                          │
│           [ Proponer cambio  ›  ]        │
└─────────────────────────────────────────┘
```

- Banner superior con CTA contextual del trade activo (de `tradeStateMachine.ctaFor`) si existe; reemplaza el botón "Proponer cambio".
- Mini-thumbs: 4 visibles + counter `+N`. Tap en un thumb → `/sticker/[code]` (modal existente). Tap en zona no-CTA de la card → `/friends/[username]`.
- Empty state mejorado: además del mensaje actual ("Sumá amigos…") agregar CTA secundario "Compartí tu lista" → enlaza a flow P3 existente.

### `StickerMiniThumb` (nuevo componente)

- 32×40, color de fondo de `getTeamColors(teamCode)` (especiales caen al accent del theme).
- Número impreso del sticker en blanco/contraste.
- Border radius 4. Sin foto del jugador.
- Reutilizable: lo usan `MatchCard`, `/friends/[username]` y `TradeProposalModal`.

### `/friends/[username]` rediseñado

- Header con back + @username + display name + WhatsApp/Instagram (sin cambios).
- Banner `ActiveTradeBanner` arriba si hay trade pendiente/aceptado, con CTAs según `ctaFor`.
- Bloque "🎯 ÉL TIENE QUE NECESITÁS · N": grid de `StickerMiniThumb` agrupado por equipo. Header de equipo (ej. "MÉXICO (3)") tap → `/team/[code]`. Thumb tap → `/sticker/[code]`.
- Bloque "🎁 TENÉS QUE LE NECESITA · N": mismo formato.
- Botón sticky bottom "Proponer cambio" si no hay trade activo.

### `app/trades/propose/[username].tsx` (nuevo screen modal)

- Pre-fill desde `buildDefaultProposal`.
- Lista compacta con checkbox por cromo, agrupada por equipo, dos secciones ("Le doy" / "Le pido") con counter en el header.
- Campo opcional "Mensaje" (max 280 chars).
- Validaciones cliente: ≥1 cromo de cada lado; sin trade activo previo con esa persona.
- CTA "Enviar propuesta": haptic medio, cierre modal, snackbar "Propuesta enviada".

### `Snackbar` (nuevo componente chico)

Toast top con auto-dismiss 3s, theme-aware. Se monta una vez en `_layout.tsx`. Triggea desde realtime listener cuando llega un cambio de estado de trade ("@juan aceptó tu propuesta", "@juan marcó como hecho — confirmá", etc.).

### Estados del CTA contextual (tabla de verdad)

| Tu rol     | Estado                  | CTA                                          |
|------------|-------------------------|----------------------------------------------|
| Proposer   | `pending`               | "Esperando respuesta · [Cancelar]"           |
| Recipient  | `pending`               | "[Aceptar] [Rechazar]"                       |
| Cualquiera | `accepted`, sin tu marca| "[Marcar como hecho]"                        |
| Cualquiera | `accepted`, con tu marca| "Esperando que confirme · [Deshacer]"        |
| Cualquiera | `accepted`, otro marcó  | "@x dice que lo hizo · [Confirmar]"          |
| Cualquiera | `completed`             | "Trade completado ✓" (visible 24h: `now() - completed_at < 24h`) |
| Cualquiera | `declined`/`cancelled`  | (no se muestra)                              |

## 5. Realtime

Bridge montado en `app/_layout.tsx` junto al ya existente `friendsRealtime`. Al recibir cualquier cambio sobre `trades` involucrando al user, invalida `['trades']` y `['matches']`. Cuando el delta de `trade_confirm` toca `sticker_status`, el realtime existente para `sticker_status` (si lo hay) o el sync engine actual replica los cambios al SQLite local en el próximo drain.

> Nota: si `sticker_status` no tiene realtime hoy (revisar al implementar), agregamos un invalidate de `['progress', 'stickers']` cuando llega un trade completed por realtime.

## 6. Tests

### Pure (Jest, sin device)

- `tests/tradeProposalBuilder.test.ts`
  - Pre-selección incluye todos los cromos del bidireccional.
  - Si un lado está vacío → draft inválido.
  - Idempotencia.

- `tests/tradeStateMachine.test.ts`
  - Transiciones válidas y rechazo de inválidas (ej. `pending → completed` sin `accepted`).
  - `ctaFor` cubre cada celda de la tabla del §4.

- `tests/friendMatchBuilder.test.ts` (ampliar)
  - Summary incluye ambos lados.

### Integración (SQLite mock)

- `tests/trades.local.test.ts` — read/write trades cacheados.
- `tests/tradeDelta.test.ts` — simula cambio remoto a `completed` y verifica que el delta queda reflejado en `sticker_status` local.

### No tests

- Snapshots de UI (consistente con CLAUDE.md).
- RPCs en Supabase real (verificación manual en device contra el proyecto remoto).

## 7. Checklist de archivos

**Borrar:**
- `app/(tabs)/album.tsx`
- Candidatos a huérfano (borrar solo si el grep confirma que `album.tsx` era el único consumidor): `src/store/filters.ts`, `src/ui/FilterChip.tsx`, `src/ui/SkeletonAlbumGrid.tsx`.

**Crear:**
- `supabase/migrations/<ts>_trades.sql` (tabla + RLS + RPCs)
- `src/domain/tradeProposalBuilder.ts`
- `src/domain/tradeStateMachine.ts`
- `src/data/trades.ts`
- `src/social/trades.ts`
- `src/social/tradesRealtime.ts`
- `src/hooks/useTrades.ts`
- `src/hooks/useTradeForFriend.ts`
- `src/hooks/useProposeTrade.ts`
- `src/hooks/useRespondTrade.ts`
- `src/hooks/useConfirmTrade.ts`
- `src/hooks/useCancelTrade.ts`
- `src/hooks/useUnconfirmTrade.ts`
- `src/ui/StickerMiniThumb.tsx`
- `src/ui/MatchCard.tsx`
- `src/ui/ActiveTradeBanner.tsx`
- `src/ui/Snackbar.tsx`
- `app/trades/propose/[username].tsx`
- `tests/tradeProposalBuilder.test.ts`
- `tests/tradeStateMachine.test.ts`
- `tests/trades.local.test.ts`
- `tests/tradeDelta.test.ts`

**Modificar:**
- `app/(tabs)/_layout.tsx` — quitar tab Álbum
- `app/(tabs)/trades.tsx` — `MatchesView` usa `MatchCard`
- `app/_layout.tsx` — montar `tradesRealtime` + `Snackbar`
- `app/friends/[username].tsx` — rediseño bidireccional + banner trade
- `src/hooks/useMatches.ts` — devolver ambos lados
- `src/social/friendships.ts` — `fetchMatches` ambos lados
- `src/domain/friendMatchBuilder.ts` — `summarizeMatches` ambos lados
- `src/domain/types.ts` — nuevos tipos
- `src/data/friendsLocal.ts` — cache shape
- `tests/friendMatchBuilder.test.ts` — cubrir bidireccional
- `package.json` — bump a `1.1.0-beta.1`

## 8. Riesgos y mitigaciones

- **Delta corrupto si la app se cierra entre las dos confirmaciones:** la RPC es atómica server-side; el cliente solo refleja el resultado. Si el cliente proposer cierra la app, al volver a abrir el realtime + el invalidate inicial sincronizan estado.
- **Trades duplicados con la misma persona:** validación en cliente al abrir el modal. Si crece a problema, índice único partial en DB.
- **Datos inconsistentes locales (delta aplicado en remoto pero no en SQLite):** el sync engine actual ya reconcilia `sticker_status` por `updated_at`; el delta del trade actualiza `updated_at` y entra en el próximo drain. Edge: si el user navega a la grilla justo después del completed antes del drain, ve el estado anterior por unos segundos. Aceptable; el realtime listener invalida la query en breve.
- **Borrar Álbum y descubrir que `useFilters` o `FilterChip` los usa otro screen:** el grep previo a borrar lo cubre. En la duda, solo se borra `album.tsx` y los huérfanos quedan para una limpieza posterior.

## 9. Versionado

`package.json`: `1.0.0-beta.1` → `1.1.0-beta.1`.
