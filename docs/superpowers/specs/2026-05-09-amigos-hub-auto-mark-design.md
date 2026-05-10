# Amigos hub + auto-mark al completar trueque

**Fecha**: 2026-05-09
**Estado**: Aprobado
**Alcance**: `app/(tabs)/_layout.tsx`, `app/(tabs)/profile.tsx`, `app/(tabs)/trades.tsx` → `app/(tabs)/friends.tsx` (rename + refactor), borrar `app/friends/index.tsx`, `src/social/trades.ts`, `src/hooks/useConfirmTrade.ts`, `app/_layout.tsx` (realtime onTradeChange)

## Problema

El usuario tiene dos fricciones distintas en el flujo social:

1. **Navegación a "Mis amigos" sepultada**. Hoy hay que ir a Perfil → "Mis amigos" para ver la lista de amigos. Es una ruta pushed (`app/friends/index.tsx`) sin botón de volver — recién resuelto en otro fix — pero igual queda escondida detrás de un tap extra.
2. **Estado de trueques inexistente**. La pestaña "Cambios" actual es solo descubrimiento (Matches / Cerca de mí / Solicitudes de amistad). Los trueques que ya tengo iniciados (pendientes / aceptados / completados) no tienen un lugar consolidado donde verlos.

A esto se suma un bug real:

3. **Trueque completado no auto-marca cromos**. Cuando ambas partes confirman un trueque, el RPC `trade_confirm` aplica el delta a `sticker_status` en remote (resta 1 a quien dio, suma 1 a quien recibió). Pero la SQLite local del cliente queda stale — `useConfirmTrade.ts` invalida la query `["stickers"]`, pero esa query lee del SQLite local (no del server), así que la UI sigue mostrando el conteo viejo hasta que un sync periódico (cada 30s o app foreground) traiga el delta del server.

## Goal

Consolidar el universo "social" en una sola pestaña ("Amigos") con sub-navegación clara, y eliminar el lag entre completar un trueque y ver los cromos actualizados en el álbum.

## Decisiones de UX

### Bottom navigation

- Antes: `Home | Cambios | Perfil` (3 tabs)
- Después: `Home | Amigos | Perfil` (3 tabs, mismo recuento — cambia el del medio)
- El badge numérico de "solicitudes pendientes" que hoy vive en el tab Cambios pasa al tab Amigos (mismo `usePendingRequestsCount`).

### Estructura de la pestaña Amigos

Tres sub-tabs en SegmentedControl arriba: `[ Amigos | Trueques | Cerca ]`.

#### Sub-tab "Amigos" (default)

Vista vertical con dos secciones apiladas:

- **Sección "Solicitudes" (top, condicional)**: solo visible si hay `pendingRequests.length > 0` o `outgoingRequests.length > 0`. Renderiza el contenido actual de `RequestsView` (cards aceptar/rechazar para incoming, status + cancelar para outgoing).
- **Sección "Mis amigos"**: lista de amigos con avatar/iniciales, `@username`, displayName, badge de match count. Tap → `/friends/[username]`. Reusa la lógica actual de `app/friends/index.tsx`.

#### Sub-tab "Trueques"

- **Filter chips horizontales**: `( Pendientes )( En curso )( Completados )`. Default: Pendientes. Componente nuevo o variante de SegmentedControl con estilo "chip".
- **Lista filtrada**: cards de trueque mostrando contraparte (@username), fecha relativa, items "Le diste / Te dio" con códigos, y botón de acción según estado:

| Estado UI | Trade.status DB | Yo soy | Acciones |
|-----------|----------------|--------|----------|
| Pendientes | `pending` | proposer | `Cancelar` |
| Pendientes | `pending` | recipient | `Aceptar` / `Rechazar` |
| En curso | `accepted` | cualquiera, no confirmé | `Confirmar` |
| En curso | `accepted` | cualquiera, ya confirmé | label "Esperás confirmación de @x" + `Deshacer` |
| Completados | `completed` | cualquiera | read-only, mostrar `completed_at` formateado |

Estados `declined` y `cancelled` no se listan (alineado con UX actual y con el alcance que aprobó el usuario).

#### Sub-tab "Cerca"

Mover el `NearbyView` actual del archivo `trades.tsx` tal cual. Sin cambios funcionales.

### Limpiezas

- `app/(tabs)/profile.tsx`: borrar el botón "👥 Mis amigos" (y su Pressable). El acceso ahora está en el tab Amigos.
- `app/friends/index.tsx`: borrar el archivo. La ruta `/friends` (lista) ya no se usa porque la lista vive como sub-tab. **Nota**: `app/friends/[username].tsx` (detalle de amigo, accedido al tocar un amigo desde la lista) **no se borra**; se sigue usando.

## Cambios técnicos

### 1. `app/(tabs)/_layout.tsx`

- Reemplazar `Tabs.Screen name="trades"` por `Tabs.Screen name="friends"`. Ícono `👥` (o equivalente del set actual). Título "Amigos".
- El `tabBarBadge` con `pendingCount` se mantiene; pasa al tab Amigos.
- Mantener orden visual: Home (izq), Amigos (centro), Perfil (der).

### 2. `app/(tabs)/friends.tsx` (NEW, reemplaza `trades.tsx`)

Estructura:

```tsx
type Subtab = "amigos" | "trueques" | "cerca";

export default function Friends() {
  const [tab, setTab] = useState<Subtab>("amigos");
  return (
    <ThemedBackground>
      <ScrollView ... refreshControl={...}>
        <Header titulo="AMIGOS" />
        <SegmentedControl options={[
          { value: "amigos", label: "Amigos" },
          { value: "trueques", label: "Trueques" },
          { value: "cerca", label: "Cerca" }
        ]} value={tab} onChange={setTab} />
        {tab === "amigos" ? <AmigosView /> :
         tab === "trueques" ? <TruequesView /> :
         <CercaView />}
      </ScrollView>
    </ThemedBackground>
  );
}
```

`AmigosView`, `TruequesView`, `CercaView` se definen como subcomponentes en el mismo archivo o se extraen a `src/ui/` si crecen >120 líneas.

### 3. `TruequesView` (componente nuevo)

```tsx
type TradeFilter = "pending" | "accepted" | "completed";

function TruequesView() {
  const [filter, setFilter] = useState<TradeFilter>("pending");
  const trades = useTradesByStatus(filter);  // hook nuevo
  // render filter chips + cards
}
```

### 4. `src/hooks/useTrades.ts` (NEW)

```ts
export function useTradesByStatus(status: TradeFilter) {
  return useQuery({
    queryKey: ["trades", status],
    queryFn: async () => listLocalTradesByStatus(status)
  });
}
```

- Lee de `trades_cache` SQLite (ya existe la tabla).
- Si `status === 'completed'`, ordenar por `completed_at desc`. Si no, por `created_at desc`.
- Limitar a 50 últimas (los completados pueden crecer indefinidamente; suficiente UX).

### 5. `src/data/trades.ts` (extender)

Agregar:

```ts
export async function listLocalTradesByStatus(
  status: 'pending' | 'accepted' | 'completed'
): Promise<Trade[]>
```

- Query SQLite: `SELECT ... FROM trades_cache WHERE status = ? ORDER BY <col> DESC LIMIT 50`.

### 6. Fix auto-marcado al completar trueque

**Cambios:**

- **`src/social/trades.ts`** — `confirmTrade` recibe `userId: string` y, al completar, sincroniza:

```ts
export async function confirmTrade(
  tradeId: string,
  userId: string
): Promise<"completed" | "awaiting_other"> {
  const { data, error } = await supabase.rpc("trade_confirm", { p_trade: tradeId });
  if (error) throw error;
  await refreshTradeFromRemote(tradeId);
  if (data === "completed") {
    await pullRemoteStatus(userId);  // syncs sticker_status SQLite ← remote
  }
  return data;
}
```

- **`src/hooks/useConfirmTrade.ts`** — pasa `userId` desde `useSession`. Tras `pullRemoteStatus`, las invalidaciones existentes (`["stickers"]`, `["matches"]`) ya disparan rerender con datos frescos del SQLite actualizado.

- **`app/_layout.tsx`** — handler `onTradeChange` (realtime): cuando el `payload.new.status === 'completed'`, también llamar `pullRemoteStatus(user.id)` y `qc.invalidateQueries(["stickers"])`. Esto cubre al **otro lado** del trueque (que se entera por realtime, no porque hizo confirmTrade él mismo).

**Por qué `pullRemoteStatus` y no escribir el delta directo en SQLite local desde el cliente:** mantiene una sola fuente de verdad post-confirm (server) y evita divergencia si el RPC falla parcialmente o si hay conflictos.

### 7. Borrados

- `app/friends/index.tsx` (lista; `[username].tsx` se mantiene).
- `app/(tabs)/trades.tsx` (renombrado a `friends.tsx`).
- En `app/(tabs)/profile.tsx`: el `Pressable` de "Mis amigos" y su import si queda huérfano.

## Alcance fuera de scope

- Loop de "ya es tu amiga ya es tu amiga" en QR scan. Issue separado.
- Rediseño de la card de trueque (se reusa el mismo estilo `GlowCard` actual del flow Cambios).
- Migraciones SQL nuevas: ninguna. Toda la info ya está en `trades` y `trades_cache`.
- Estados `declined` y `cancelled`: no se exponen en UI (consistente con UX actual).
- Sub-tab "Cerca" no recibe rediseño — solo se mueve.

## Riesgos y consideraciones

- **Tab bar badge**: el `usePendingRequestsCount` cuenta solicitudes de amistad pending. Mantenerlo como badge en Amigos es consistente con que las solicitudes viven dentro de ese tab. No conflictúa con trueques en estado pending (esos no badge).
- **Performance "Completados"**: si el dataset crece, la lista podría ser larga. El LIMIT 50 mitiga; futuro infinite scroll si fuera necesario (no en esta iteración).
- **Realtime double-pull**: si el usuario es quien confirmó (y completó) el trueque, `confirmTrade` llama `pullRemoteStatus`, y el realtime listener también lo dispara cuando llega el evento. Es idempotente (un pull extra es benigno) pero implica un poco de tráfico redundante. Aceptable.
- **Migración de archivos**: rename `trades.tsx` → `friends.tsx` puede afectar imports en otros lugares. Grep antes de borrar.
