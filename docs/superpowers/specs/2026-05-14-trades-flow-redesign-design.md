# Trades Flow Redesign — design spec

**Fecha**: 2026-05-14
**Autor**: Oscar Ortega (con asistencia de Claude)
**Estado**: aprobado, listo para writing-plans

## Problema

Hoy para iniciar un trueque con alguien nuevo el usuario tiene que recorrer Perfil → escanear QR/buscar @ → aceptar amistad → volver a Amigos → tap amigo → "Proponer cambio". 6 pasos para una acción que debería ser directa. Además, el QR y los botones de "agregar amigo" viven en Perfil cuando conceptualmente pertenecen al ámbito social/Amigos.

## Objetivos

1. **Centralizar el flujo social en el tab Amigos**. Perfil queda como "opciones de cuenta".
2. **Hacer trivial iniciar un trueque** desde la sub-tab Trueques, sin importar si la contraparte es amigo o desconocido.
3. **Mantener la regla "trueque implica amistad"** (importante para RLS y privacidad de progreso) pero ocultarlo de la UX cuando se puede fusionar.

## Decisiones del brainstorming

Q1 — ¿Qué fricción resuelve? → **C**: el flow de "armar un trueque" debe arrancar desde Trueques sin importar si la persona ya es amigo.

Q2 — ¿Cómo se inicia? → **A**: FAB "+ Nuevo trueque" en sub-tab Trueques → wizard de 2 pasos (elegir persona → elegir stickers).

Q3 — ¿Qué pasa con un destinatario no-amigo? → **A**: solicitud de amistad + propuesta de trueque viajan combinadas en un solo RPC.

Q4 — ¿Dónde vive mi QR/código? → **B**: chip "Mi código" al tope de sub-tab Amigos.

Q5 — ¿Qué pasa con scan/search standalone? → **B**: chip "+ Agregar amigo" al lado de "Mi código" para casos sin trueque adjunto.

Q6 — ¿Cómo acepta el destinatario? → **C**: tap Aceptar = solo amistad. El trueque queda pendiente para decisión separada.

## Reestructuración de tabs

### Perfil — solo configuración personal

```
┌─ Perfil ───────────┐
│ Avatar + nombre    │
│ @username          │
│                    │
│ Tema oscuro        │
│ Editar perfil      │
│ Acerca de          │
│ Cerrar sesión      │
│ Borrar cuenta      │
└────────────────────┘
```

Se eliminan: QR/código, "Escanear código", "Buscar por @".

### Amigos — todo el flujo social

Sub-tabs sin cambios: Amigos / Trueques / Cerca. Lo que cambia es el contenido.

## Sub-tab Amigos — header chips

```
┌─ Sub-tab Amigos ────────────────────────────┐
│ ┌─ Mi código ABC-123  📤 ┐ ┌─ + Agregar ┐  │
│ └────────────────────────┘ └────────────┘  │
│                                              │
│ SOLICITUDES (si hay)                        │
│ ...                                         │
│                                              │
│ MIS AMIGOS                                  │
│ ...                                         │
└──────────────────────────────────────────────┘
```

**Chip "Mi código"**:
- Muestra el código de invitación inline (ej. `ABC-123`).
- Icono 📤 a la derecha = shortcut directo a la Share API nativa (WhatsApp/mail/etc.) con el texto "Agregame en stickerSwap: ABC-123 — [link]".
- Tap en el chip (no en el icono) → modal con QR full size, código, botón "Copiar código".

**Chip "+ Agregar amigo"**:
- Tap → bottom sheet o modal con dos opciones: "📷 Escanear QR" y "⌕ Buscar por @username".
- Reusa pantallas existentes `app/add-friend/scan.tsx` y `app/add-friend/search.tsx` (sin cambios funcionales).

**Componentes nuevos**:
- `src/ui/MyCodeChip.tsx`
- `src/ui/AddFriendChip.tsx`
- `src/ui/AddFriendPicker.tsx` (el bottom sheet con scan/search)

## Sub-tab Trueques — FAB + wizard

```
┌─ Sub-tab Trueques ──────────────────────────┐
│ [Pendientes] [En curso] [Completados]       │
│                                              │
│ ── Lista de trades ──                       │
│ ...                                         │
│                                              │
│                                          ⊕  │  ← FAB
└──────────────────────────────────────────────┘
```

**FAB**:
- Position absolute, bottom-right, `bottom: insets.bottom + 24`, `right: 20`.
- Solo visible cuando `tab === "trueques"` en el `Friends` parent.
- Tap → `router.push("/trades/new")`.

**Wizard paso 1 — Elegir persona** (`app/trades/new/index.tsx`):

```
┌─ Nuevo trueque · Paso 1/2 ──────────────────┐
│ ←                                            │
│ ¿Con quién?                                  │
│                                              │
│ [🔍 Buscar amigo o @username…]              │
│                                              │
│ ── ALGUIEN NUEVO ──                          │
│ [📷 Escanear código]                         │
│ [⌕ Buscar por @]                             │
│                                              │
│ ── MIS AMIGOS ──                             │
│ @luis     · 3 matches                       │
│ @maria    · 1 match                         │
│ ...                                         │
└──────────────────────────────────────────────┘
```

Filtro inline: lo que tipees en el buscador filtra la lista de "MIS AMIGOS" por username/displayName. Si tipean un `@texto` que no matchea ningún amigo, mostramos una línea inline "Buscar @texto en stickerSwap →" que abre la pantalla de search-by-username pre-rellenada.

**Wizard paso 2 — Elegir stickers** (reusa `app/trades/propose/[username].tsx`):
- Mismo UI que hoy: secciones "LE DOY" / "LE PIDO" / mensaje opcional / "Enviar".
- **Diferencia**: si el destinatario NO es amigo aceptado, el resumen del botón "Enviar" cambia a:
  ```
  Enviar
  (incluye solicitud de amistad)
  ```
  Y al tap, muestra un confirmation alert: "Vas a enviar una solicitud de amistad junto con este trueque. ¿Continuar?"

**Nuevos archivos**:
- `app/trades/new/index.tsx` — paso 1 del wizard
- `src/ui/AddFriendPicker.tsx` — bottom sheet scan/search reutilizable

**Archivos modificados**:
- `app/(tabs)/friends.tsx` — agrega FAB condicional al sub-tab Trueques
- `app/trades/propose/[username].tsx` — detecta si username es amigo aceptado, ajusta UI del envío

## Backend — combo amistad+trueque

### Schema (migration nueva)

```sql
-- supabase/migrations/20260514000000_friendship_trade_combo.sql

-- Permitir el source "trade_combo" en friendships (existing CHECK debe ampliarse)
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_source_check;
ALTER TABLE friendships ADD CONSTRAINT friendships_source_check
  CHECK (source IN ('qr_code', 'username_search', 'nearby_match', 'trade_combo'));
```

### RPC nuevo `propose_trade_with_friendship`

```sql
CREATE OR REPLACE FUNCTION propose_trade_with_friendship(
  p_recipient_id uuid,
  p_proposer_gives text[],
  p_proposer_gets text[],
  p_message text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_trade_id uuid;
  v_existing_friendship friendships%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_recipient_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_trade_with_self';
  END IF;

  -- 1. Resolver estado de amistad
  SELECT * INTO v_existing_friendship
  FROM friendships
  WHERE (user_a = auth.uid() AND user_b = p_recipient_id)
     OR (user_a = p_recipient_id AND user_b = auth.uid())
  LIMIT 1;

  IF v_existing_friendship.id IS NULL THEN
    -- Sin relación previa: crear pending
    INSERT INTO friendships (user_a, user_b, requester_id, status, source, created_at)
    VALUES (auth.uid(), p_recipient_id, auth.uid(), 'pending', 'trade_combo', v_now);
  ELSIF v_existing_friendship.status IN ('rejected', 'blocked') THEN
    RAISE EXCEPTION 'friendship_blocked';
  END IF;
  -- Si status = 'pending' o 'accepted', no tocamos la amistad. El trade sigue.

  -- 2. Crear el trade en pending
  INSERT INTO trades (proposer_id, recipient_id, proposer_gives, proposer_gets, message, status, created_at, updated_at)
  VALUES (auth.uid(), p_recipient_id, p_proposer_gives, p_proposer_gets, p_message, 'pending', v_now, v_now)
  RETURNING id INTO v_trade_id;

  RETURN v_trade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION propose_trade_with_friendship TO authenticated;
```

### Cliente

`src/social/trades.ts` (existing):
```ts
export async function proposeTradeWithFriendship(args: {
  recipientId: string;
  gives: string[];
  gets: string[];
  message: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("propose_trade_with_friendship", {
    p_recipient_id: args.recipientId,
    p_proposer_gives: args.gives,
    p_proposer_gets: args.gets,
    p_message: args.message
  });
  if (error) throw error;
  return data;
}
```

`src/hooks/useProposeTrade.ts`:
- Si el destinatario es amigo aceptado → usa el RPC existente `propose_trade`.
- Si no → usa `propose_trade_with_friendship`.

## Flujo del destinatario

Cuando el destinatario abre Amigos sub-tab *Amigos*:

```
┌─ SOLICITUDES ───────────────────────────────┐
│ @vos quiere ser tu amigo                    │
│ 🔄 Te propuso un trueque también            │
│ "Hola, vi que tienes los que me faltan…"    │
│                                              │
│ [Aceptar amistad] [Rechazar]                │
└──────────────────────────────────────────────┘
```

- Tap **Aceptar amistad** → amistad pasa a `accepted`. El trade queda visible en sub-tab Trueques en "Pendientes" con sus dos botones normales (Aceptar/Rechazar trueque). Decisión separada.
- Tap **Rechazar** → amistad pasa a `rejected`. El trade asociado se cancela atómicamente vía nuevo RPC `resolve_pending_combo(p_other_user_id uuid, p_action text)` con `action='decline'`, que rechaza la amistad y marca todos los trades pendientes entre ambos como `cancelled` por motivo "friendship_declined".

El mismo RPC `resolve_pending_combo` se usa para el caso "proposer cancela su solicitud pendiente" con `action='cancel'`. La diferencia de autorización se infiere del `requester_id` de la friendship pendiente y el `proposer_id` de los trades pendientes:
- `cancel`: solo permitido si `auth.uid() === friendship.requester_id`.
- `decline`: solo permitido si `auth.uid() !== friendship.requester_id` (es decir, lo recibe).

En sub-tab *Trueques* mientras la amistad está pendiente:
```
┌─ TradeCard ─────────────────────────────────┐
│ @vos    pendiente                           │
│ Le di: MEX-3, ARG-7   Te dio: BRA-12        │
│ ⚪ Esperando que aceptes la amistad         │
│ [Aceptar trueque] desactivado               │
└──────────────────────────────────────────────┘
```

El trade no se puede aceptar hasta que la amistad esté en `accepted`. UI grisada con etiqueta "esperando amistad".

## Sub-tab Cerca — sin cambios

El flujo nearby ya tiene su propio combo (request friendship + intent). Lo dejamos exactamente como está. A futuro se podría unificar con el wizard de Trueques, pero no es parte de este spec.

## Edge cases

| Caso | Comportamiento |
|---|---|
| Proposer cancela el trade antes de respuesta | Trade va a `cancelled`. Amistad queda pending (la otra persona puede decidir). |
| Proposer cancela la amistad pendiente | Amistad y trade se cancelan juntos (`resolve_pending_combo` con `action='cancel'`). |
| Recipient acepta amistad, después rechaza trade | Amistad queda `accepted`. Trade va a `declined`. Relación social válida, no hay intercambio. |
| Recipient deja la solicitud pendiente | Trade queda visible en su lista "esperando amistad", no accionable. |
| Proposer ya es amigo aceptado del recipient | RPC normal `propose_trade`. No se toca friendships. |
| Recipient ya bloqueó al proposer | `friendship_blocked` error. UI muestra "No se puede contactar a este usuario". |
| Proposer trata de proponer a sí mismo | `cannot_trade_with_self` error. UI muestra "No puedes intercambiar contigo mismo". |
| Solicitud previa rechazada (status=`rejected`) | `friendship_blocked` error igual que blocked. UX message: "Tu solicitud anterior fue rechazada. No podés volver a contactarlo." |

## Testing

**Unit / TDD**:
- `src/domain/tradeProposal*.test.ts` (existing): suma casos cuando el destinatario no es amigo (`isFriend: false`).
- Nuevo `src/domain/tradeRpcSelector.ts` + test: función pura `pickProposeRpc(friendship: Friendship | null)` que devuelve `'propose_trade'` o `'propose_trade_with_friendship'`. Aisla la decisión del cliente para testearla sin tocar Supabase.

**Integration**:
- `tests/data/trades.test.ts` (existing): mock RPC `propose_trade_with_friendship` para nuevos amigos.
- `tests/social/friendships.test.ts`: caso "crear amistad via trade_combo source".

**Manual / device** (no UI snapshots per CLAUDE.md):
- FAB aparece solo en sub-tab Trueques.
- Chips "Mi código" y "+ Agregar amigo" visibles en sub-tab Amigos.
- Modal Mi código: copiar funciona, Share funciona.
- Wizard step 1: filtro de amigos por nombre, scan QR de un user nuevo, search por @ de un user nuevo, tap amigo existente.
- Wizard step 2: si target es amigo → flow normal; si no → confirmation alert + envío via RPC nuevo.
- Recipient: solicitud combo muestra badge "🔄 trueque pendiente". Accept solo acepta amistad. Trade pendiente "esperando amistad" no es accionable.
- Recipient rechaza amistad: trade se cancela también.

## Migración / rollout

- 1 migration SQL (`20260514000000_friendship_trade_combo.sql`).
- 1 RPC nuevo (`propose_trade_with_friendship`), no rompe los existentes.
- Cliente: nuevos componentes + cambios en `friends.tsx` y `propose/[username].tsx`.
- No requiere feature flag. Es un cambio de UI grande pero coherente — no convive con el viejo.
- Datos viejos: sin backfill. Amistades viejas tienen `source != 'trade_combo'`, el badge "🔄 trueque pendiente" solo aparece para nuevas con ese source.

## Out of scope

- Trueques sin amistad (decisión Q3 = A, mantenemos amistad obligatoria).
- Notificaciones push (sigue el mecanismo de Realtime + invalidaciones existente).
- Aceptación atómica amistad+trueque (decisión Q6 = C, separadas).
- Sub-tab Cerca redesign.
- Onboarding o tutorial nuevo (los chips son lo suficientemente descubribles).
- Migración del wording de "trueque" a "cambio" o similar.

## Archivos afectados (resumen)

**Nuevos**:
- `app/trades/new/index.tsx` — wizard paso 1
- `src/ui/MyCodeChip.tsx`
- `src/ui/AddFriendChip.tsx`
- `src/ui/AddFriendPicker.tsx`
- `supabase/migrations/20260514000000_friendship_trade_combo.sql`

**Modificados**:
- `app/(tabs)/profile.tsx` — saca QR + códigos + add-friend
- `app/(tabs)/friends.tsx` — chips header en sub-tab Amigos, FAB en sub-tab Trueques, badge combo en SOLICITUDES, status "esperando amistad" en TradeCard
- `app/trades/propose/[username].tsx` — detecta no-amigo, ajusta UI envío, llama RPC nuevo
- `src/social/trades.ts` — nueva función wrapper
- `src/social/friendships.ts` — nuevo RPC para cancel/decline combo
- `src/hooks/useProposeTrade.ts` — selector entre RPCs

**Test files nuevos/modificados**:
- `tests/data/trades.test.ts` — caso combo
- `tests/social/friendships.test.ts` — source trade_combo
- `tests/domain/tradeRpcSelector.test.ts` — selector puro entre RPCs (nuevo)
