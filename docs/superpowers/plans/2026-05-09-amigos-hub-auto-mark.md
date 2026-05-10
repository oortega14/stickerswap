# Amigos Hub + Auto-Mark on Completed Trade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el bottom tab "Cambios" por una pestaña "Amigos" con sub-tabs (Amigos / Trueques / Cerca), eliminar la página de lista de amigos sepultada en Perfil, y arreglar el bug donde completar un trueque deja la SQLite local stale (cromos no se auto-marcan hasta el próximo sync).

**Architecture:** Refactor incremental — primero la capa de datos (`src/data/trades.ts`) y el hook nuevo (`src/hooks/useTrades.ts`), después el fix del auto-mark en `confirmTrade` + el realtime listener, después la UI nueva (`app/(tabs)/friends.tsx`) construida en paralelo a la vieja sin romper nada, y finalmente el switch del bottom tab + cleanup. Commits frecuentes para que cada paso quede en estado verde.

**Tech Stack:** React Native 0.81 + Expo SDK 54 + Expo Router (file-based), TanStack Query v5, Zustand, expo-sqlite (better-sqlite3 mock para tests), Supabase client, NativeWind v4, Jest + jest-expo. Tests TDD solo en lógica pura/data layer (consistente con CLAUDE.md).

---

## Pre-Flight

Antes de arrancar tareas de implementación, commitear el spec aprobado y la migración del default `auth.uid()` que ya se aplicó al remote (sesión anterior).

### Task 0: Commit spec + migration

**Files:**
- Already modified (untracked/staged):
  - `docs/superpowers/specs/2026-05-09-amigos-hub-auto-mark-design.md` (new, staged)
  - `supabase/migrations/20260509000004_trades_proposer_default.sql` (new, untracked)
- Drop: working-tree edit en `app/friends/index.tsx` (back button fix; el archivo se borra en Task 12 → la edición es moot)

- [ ] **Step 1: Discard back-button edit en `app/friends/index.tsx`** (ese archivo se borra después)

```bash
git checkout -- app/friends/index.tsx
```

- [ ] **Step 2: Stage migration**

```bash
git add supabase/migrations/20260509000004_trades_proposer_default.sql
```

- [ ] **Step 3: Verify staging**

```bash
git status -s
```

Expected output (orden puede variar):

```
A  docs/superpowers/specs/2026-05-09-amigos-hub-auto-mark-design.md
A  supabase/migrations/20260509000004_trades_proposer_default.sql
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs+db: spec amigos hub + default auth.uid() en proposer_id

Spec aprobado para reemplazar Cambios por Amigos hub con sub-tabs
(Amigos/Trueques/Cerca) y arreglar el auto-mark de cromos al completar
un trueque.

La migración 20260509000004 alinea el schema de trades con la RLS
policy trades_insert_friends (que exige auth.uid() = proposer_id),
arreglando el "new row violates row-level security policy" al proponer
un trueque desde el cliente sin enviar proposer_id.
EOF
)"
```

---

## Backend / Data Layer

### Task 1: `listLocalTradesByStatus` en `src/data/trades.ts`

**Files:**
- Modify: `src/data/trades.ts`
- Test: `tests/data/trades.test.ts`

Necesario para que `useTradesByStatus` (Task 5) lea trueques filtrados desde la SQLite local. Ordena por `completed_at desc` cuando filtra completados, por `created_at desc` en los demás. Limita a 50 resultados (CLAUDE.md privilegia código simple; infinite scroll no se pide).

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `tests/data/trades.test.ts`, antes del `});` del `describe`:

```ts
  it("listLocalTradesByStatus filters and orders correctly", async () => {
    await upsertTrade(t({ id: "p1", status: "pending", createdAt: 100, updatedAt: 100 }));
    await upsertTrade(t({ id: "p2", status: "pending", createdAt: 200, updatedAt: 200 }));
    await upsertTrade(t({ id: "a1", status: "accepted", createdAt: 300, updatedAt: 300 }));
    await upsertTrade(
      t({ id: "c1", status: "completed", completedAt: 1000, createdAt: 50, updatedAt: 1000 })
    );
    await upsertTrade(
      t({ id: "c2", status: "completed", completedAt: 2000, createdAt: 60, updatedAt: 2000 })
    );

    const pending = await listLocalTradesByStatus("pending");
    expect(pending.map((x) => x.id)).toEqual(["p2", "p1"]); // por created_at desc

    const accepted = await listLocalTradesByStatus("accepted");
    expect(accepted.map((x) => x.id)).toEqual(["a1"]);

    const completed = await listLocalTradesByStatus("completed");
    expect(completed.map((x) => x.id)).toEqual(["c2", "c1"]); // por completed_at desc
  });
```

Y agregar `listLocalTradesByStatus` al import en la línea 5–11:

```ts
import {
  upsertTrade,
  listActiveTrades,
  getActiveTradeForFriend,
  getTradeById,
  removeTrade,
  listLocalTradesByStatus
} from "@/data/trades";
```

- [ ] **Step 2: Correr test para verificar que falla**

```bash
eval "$(mise activate zsh)" && pnpm test -- --testPathPattern=tests/data/trades.test.ts 2>&1 | tail -30
```

Expected: FAIL con "listLocalTradesByStatus is not a function" o similar TS error.

- [ ] **Step 3: Implementar `listLocalTradesByStatus`**

Agregar al final de `src/data/trades.ts` (después de `removeTrade`):

```ts
export async function listLocalTradesByStatus(
  status: TradeStatus
): Promise<Trade[]> {
  const db = getDb();
  const orderCol = status === "completed" ? "completed_at" : "created_at";
  const rows = await db.getAllAsync<Row>(
    `SELECT id, proposer_id, recipient_id, proposer_gives, proposer_gets,
            status, proposer_confirmed_at, recipient_confirmed_at, message,
            created_at, updated_at, completed_at
       FROM trades_cache
      WHERE status = ?
      ORDER BY ${orderCol} DESC
      LIMIT 50`,
    [status]
  );
  return rows.map(rowToTrade);
}
```

- [ ] **Step 4: Correr test para verificar que pasa**

```bash
pnpm test -- --testPathPattern=tests/data/trades.test.ts 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 5: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/data/trades.ts tests/data/trades.test.ts
git commit -m "feat(data): listLocalTradesByStatus para feed de trueques filtrado"
```

---

### Task 2: `confirmTrade` recibe `userId` y sincroniza al completar

**Files:**
- Modify: `src/social/trades.ts:77-82`

Root cause del bug: el RPC `trade_confirm` actualiza `sticker_status` en remote cuando el segundo usuario confirma, pero la SQLite local del cliente no se entera. La query `["stickers"]` invalidada por el hook lee del SQLite local (no del server), así que no hay re-render con datos frescos. Fix: tras un confirm que devuelve `"completed"`, llamar `pullRemoteStatus(userId)` para traer el delta del server al SQLite.

- [ ] **Step 1: Modificar `confirmTrade` en `src/social/trades.ts`**

Buscar la firma actual:

```ts
export async function confirmTrade(tradeId: string): Promise<"completed" | "awaiting_other"> {
  const { data, error } = await supabase.rpc("trade_confirm", { p_trade: tradeId });
  if (error) throw error;
  await refreshTradeFromRemote(tradeId);
  return data;
}
```

Reemplazar por:

```ts
export async function confirmTrade(
  tradeId: string,
  userId: string
): Promise<"completed" | "awaiting_other"> {
  const { data, error } = await supabase.rpc("trade_confirm", { p_trade: tradeId });
  if (error) throw error;
  await refreshTradeFromRemote(tradeId);
  if (data === "completed") {
    await pullRemoteStatus(userId);
  }
  return data;
}
```

- [ ] **Step 2: Agregar el import de `pullRemoteStatus` arriba del archivo**

Buscar la línea de imports (cerca del top) y agregar:

```ts
import { pullRemoteStatus } from "@/sync/worker";
```

(Ubicar el import ordenado alfabéticamente con los otros internos `@/...`.)

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: errores en los callers de `confirmTrade(tradeId)` que aún no pasan `userId`. Va a saltar en `src/hooks/useConfirmTrade.ts`. **Esto es esperado** — la corregimos en Task 3.

- [ ] **Step 4: NO commitear todavía** — el código no compila. Continúa a Task 3.

---

### Task 3: `useConfirmTrade` lee `userId` de la sesión

**Files:**
- Modify: `src/hooks/useConfirmTrade.ts`

- [ ] **Step 1: Reescribir el hook completo**

Reemplazar el contenido de `src/hooks/useConfirmTrade.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { confirmTrade } from "@/social/trades";
import { useSession } from "@/auth/useSession";

export function useConfirmTrade() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: (tradeId: string) => {
      if (!user) throw new Error("not_authenticated");
      return confirmTrade(tradeId, user.id);
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      if (result === "completed") {
        qc.invalidateQueries({ queryKey: ["stickers"] });
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["progress"] });
      }
    }
  });
}
```

(Agrega `["progress"]` para que la home se re-renderice; el hook `useProgress` corre con esa queryKey.)

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Tests completos pasan**

```bash
pnpm test 2>&1 | tail -15
```

Expected: todos los tests pasan (no toco lógica testeada).

- [ ] **Step 4: Commit**

```bash
git add src/social/trades.ts src/hooks/useConfirmTrade.ts
git commit -m "fix(trades): pullRemoteStatus al completar para auto-marcar cromos

Cuando trade_confirm devuelve 'completed', el server ya aplicó el delta
a sticker_status remoto. El cliente quedaba desincronizado hasta el
próximo sync (boot/foreground/30s). Ahora pull inmediato sincroniza la
SQLite local y la UI se refresca al instante."
```

---

### Task 4: Realtime `onTradeChange` también sincroniza al completar

**Files:**
- Modify: `app/_layout.tsx:129-138` (FriendUpdatesBridge `onTradeChange` handler)

El otro lado del trueque (la persona que confirmó primero, no segunda) se entera del completado por realtime, no por su propio `confirmTrade`. Necesita el mismo `pullRemoteStatus` para auto-marcar.

- [ ] **Step 1: Agregar el import de `pullRemoteStatus`**

Verificar si `pullRemoteStatus` ya está importado en `app/_layout.tsx` (línea 14 ya importa `drainQueue, pullRemoteStatus from "@/sync/worker"`). ✓ Ya está.

- [ ] **Step 2: Modificar el handler `onTradeChange`**

Buscar el bloque actual del handler en `FriendUpdatesBridge` (alrededor de líneas 129-138):

```ts
      onTradeChange: (payload) => {
        qc.invalidateQueries({ queryKey: ["trades"] });
        const newStatus = payload?.new?.status as string | undefined;
        const oldStatus = payload?.old?.status as string | undefined;
        if (newStatus && newStatus !== oldStatus) {
          announceTradeChange(payload, user.id);
        }
      }
```

Reemplazar por:

```ts
      onTradeChange: (payload) => {
        qc.invalidateQueries({ queryKey: ["trades"] });
        const newStatus = payload?.new?.status as string | undefined;
        const oldStatus = payload?.old?.status as string | undefined;
        if (newStatus && newStatus !== oldStatus) {
          announceTradeChange(payload, user.id);
        }
        if (newStatus === "completed" && oldStatus !== "completed") {
          pullRemoteStatus(user.id)
            .then(() => {
              qc.invalidateQueries({ queryKey: ["stickers"] });
              qc.invalidateQueries({ queryKey: ["matches"] });
              qc.invalidateQueries({ queryKey: ["progress"] });
            })
            .catch((e) => console.warn("pullRemoteStatus on trade completion failed", e));
        }
      }
```

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "fix(trades): otro lado del trueque también pull al completar via realtime

Cuando la otra parte confirma y el trade pasa a 'completed', llega por
realtime; el listener ahora sincroniza sticker_status local."
```

---

### Task 5: Hook `useTradesByStatus`

**Files:**
- Modify: `src/hooks/useTrades.ts` (existente — agregar la función al archivo)

- [ ] **Step 1: Agregar `useTradesByStatus` al final del archivo `src/hooks/useTrades.ts`**

Después de la función `useTrades` existente, agregar:

```ts
import { listLocalTradesByStatus } from "@/data/trades";
import type { TradeStatus } from "@/domain/types";

export function useTradesByStatus(status: TradeStatus) {
  return useQuery({
    queryKey: ["trades", status],
    queryFn: () => listLocalTradesByStatus(status),
    staleTime: 5_000
  });
}
```

(Mover los `import` al top del archivo y unificar con los existentes — `useQuery` ya está importado, `listLocalTradesByStatus` y `TradeStatus` son nuevos.)

El archivo final debería verse:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchActiveTrades } from "@/social/trades";
import { listActiveTrades, listLocalTradesByStatus } from "@/data/trades";
import type { TradeStatus } from "@/domain/types";

export function useTrades() {
  return useQuery({
    queryKey: ["trades"],
    queryFn: async () => {
      try {
        return await fetchActiveTrades();
      } catch {
        return await listActiveTrades();
      }
    }
  });
}

export function useTradesByStatus(status: TradeStatus) {
  return useQuery({
    queryKey: ["trades", status],
    queryFn: () => listLocalTradesByStatus(status),
    staleTime: 5_000
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTrades.ts
git commit -m "feat(hooks): useTradesByStatus para filtrar trueques por estado"
```

---

## UI: Nueva pestaña Amigos

Construye la nueva pantalla **al lado** de la vieja `app/(tabs)/trades.tsx` sin tocarla. El bottom tab cambia recién en Task 10. Esto permite ir verificando incrementalmente sin romper la app.

### Task 6: Esqueleto de `app/(tabs)/friends.tsx`

**Files:**
- Create: `app/(tabs)/friends.tsx`

- [ ] **Step 1: Crear el archivo con estructura mínima (sub-tabs vacíos)**

```tsx
import { useState } from "react";
import { ScrollView, View, Text, RefreshControl } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { haptics } from "@/lib/haptics";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { useTheme } from "@/theme/ThemeProvider";

type Subtab = "amigos" | "trueques" | "cerca";

export default function Friends() {
  const [tab, setTab] = useState<Subtab>("amigos");
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await haptics.light();
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["friends"] }),
      qc.invalidateQueries({ queryKey: ["matches"] }),
      qc.invalidateQueries({ queryKey: ["pendingRequests"] }),
      qc.invalidateQueries({ queryKey: ["outgoingRequests"] }),
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] }),
      qc.invalidateQueries({ queryKey: ["trades"] })
    ]);
    setRefreshing(false);
  };

  return (
    <ThemedBackground>
      <ScrollView
        className="flex-1 px-4 pt-14"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">AMIGOS</Text>

        <View className="mb-4">
          <SegmentedControl<Subtab>
            options={[
              { value: "amigos", label: "Amigos" },
              { value: "trueques", label: "Trueques" },
              { value: "cerca", label: "Cerca" }
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === "amigos" ? (
          <AmigosView />
        ) : tab === "trueques" ? (
          <TruequesView />
        ) : (
          <CercaView />
        )}
      </ScrollView>
    </ThemedBackground>
  );
}

function AmigosView() {
  return null;
}

function TruequesView() {
  return null;
}

function CercaView() {
  return null;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores. (No hay rutas pendientes — el archivo declara una nueva ruta que se activa cuando `(tabs)/_layout.tsx` la registre.)

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/friends.tsx
git commit -m "feat(friends): esqueleto del nuevo tab Amigos con 3 sub-tabs"
```

---

### Task 7: `AmigosView` — solicitudes + lista de amigos

**Files:**
- Modify: `app/(tabs)/friends.tsx`

Reusa la lógica que vive hoy en `app/(tabs)/trades.tsx` (`RequestsView`) y `app/friends/index.tsx` (lista). No extraigo a archivos compartidos para evitar over-engineering — la lógica vive en el archivo nuevo y la vieja se borra en Task 12.

- [ ] **Step 1: Agregar imports al top de `app/(tabs)/friends.tsx`**

Reemplazar el bloque de imports actual con:

```tsx
import { useState } from "react";
import { ScrollView, View, Text, Pressable, RefreshControl, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { haptics } from "@/lib/haptics";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { EmptyState } from "@/ui/EmptyState";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { useFriends } from "@/hooks/useFriends";
import { useMatches } from "@/hooks/useMatches";
import {
  usePendingRequests,
  useOutgoingRequests,
  useAcceptRequest,
  useDeclineRequest,
  useDeleteMyOutgoingRequest
} from "@/hooks/usePendingRequests";
import { useTheme } from "@/theme/ThemeProvider";
```

- [ ] **Step 2: Reemplazar el stub `function AmigosView()` con la implementación**

```tsx
function AmigosView() {
  const router = useRouter();
  const { theme } = useTheme();
  const incoming = usePendingRequests();
  const outgoing = useOutgoingRequests();
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();
  const remove = useDeleteMyOutgoingRequest();
  const { data: friends } = useFriends();
  const { summary } = useMatches();
  const matchMap = new Map(summary.map((s) => [s.friendId, s.matchCount]));

  const hasIncoming = (incoming.data?.length ?? 0) > 0;
  const hasOutgoing = (outgoing.data?.length ?? 0) > 0;
  const hasRequests = hasIncoming || hasOutgoing;

  return (
    <View>
      {hasRequests && (
        <View className="mb-6">
          <Text className="text-space-mute text-xs tracking-widest mb-2">SOLICITUDES</Text>
          {hasIncoming &&
            incoming.data!.map((r) => (
              <GlowCard key={`in-${r.requesterId}`} className="mb-3">
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
                  @{r.username}
                  {r.cityLabel ? (
                    <Text style={{ color: theme.textMute, fontSize: 12, fontWeight: "400" }}>
                      {"  · "}{r.cityLabel}
                    </Text>
                  ) : null}
                </Text>
                {r.message ? (
                  <Text style={{ color: theme.text, fontSize: 14, marginTop: 6 }}>«{r.message}»</Text>
                ) : null}
                <View className="flex-row mt-3" style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      accept.mutate(r.requesterId, {
                        onError: (e: unknown) => {
                          const msg = (e as Error).message;
                          const human = msg.includes("request_not_found")
                            ? "Esta solicitud ya no existe."
                            : msg;
                          Alert.alert("No se pudo aceptar", human);
                        }
                      });
                    }}
                    disabled={accept.isPending || decline.isPending}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: theme.accent,
                      alignItems: "center"
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Aceptar solicitud de ${r.username}`}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Aceptar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => decline.mutate(r.requesterId)}
                    disabled={accept.isPending || decline.isPending}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: theme.card,
                      borderWidth: 1,
                      borderColor: theme.border,
                      alignItems: "center"
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Rechazar solicitud de ${r.username}`}
                  >
                    <Text style={{ color: theme.textMute, fontWeight: "700" }}>Rechazar</Text>
                  </Pressable>
                </View>
              </GlowCard>
            ))}
          {hasOutgoing &&
            outgoing.data!.map((r) => {
              const isPending = r.status === "pending";
              const buttonLabel = isPending ? "Cancelar" : "Borrar";
              const statusLabel = isPending ? "Pendiente" : "Rechazada";
              const statusColor = isPending ? theme.textMute : "#dc2626";
              return (
                <GlowCard key={`out-${r.recipientId}`} className="mb-3">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
                      @{r.username}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 999,
                        backgroundColor: isPending ? theme.card : "#fee2e2",
                        borderWidth: 1,
                        borderColor: isPending ? theme.border : "#fca5a5"
                      }}
                    >
                      <Text style={{ color: statusColor, fontSize: 10, fontWeight: "700" }}>{statusLabel}</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => remove.mutate(r.recipientId)}
                    disabled={remove.isPending}
                    style={{
                      marginTop: 10,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: theme.card,
                      borderWidth: 1,
                      borderColor: theme.border,
                      alignItems: "center"
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${buttonLabel} solicitud a ${r.username}`}
                  >
                    <Text style={{ color: theme.textMute, fontSize: 13, fontWeight: "600" }}>
                      {buttonLabel}
                    </Text>
                  </Pressable>
                </GlowCard>
              );
            })}
        </View>
      )}

      <Text className="text-space-mute text-xs tracking-widest mb-2">MIS AMIGOS</Text>
      {!friends || friends.length === 0 ? (
        <EmptyState variant="planet" title="Sin amigos" message="Comparte tu código en Perfil." />
      ) : (
        friends.map((item) => {
          const count = matchMap.get(item.id) ?? 0;
          return (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/friends/${item.username}` as never)}
              accessibilityLabel={`Ver perfil de @${item.username}`}
              accessibilityRole="button"
            >
              <GlowCard className="mb-2">
                <Text className="text-space-ink font-semibold">
                  {item.displayName ?? item.username}
                </Text>
                <Text className="text-space-mute text-xs">@{item.username}</Text>
                {count > 0 && (
                  <Text className="text-space-violet text-xs mt-1">
                    {count} match{count === 1 ? "" : "es"} contigo
                  </Text>
                )}
              </GlowCard>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/friends.tsx
git commit -m "feat(friends): AmigosView con sección Solicitudes + lista de amigos"
```

---

### Task 8: `TruequesView` — filter chips + cards de trueque

**Files:**
- Modify: `app/(tabs)/friends.tsx`

- [ ] **Step 1: Agregar imports nuevos**

Al bloque de imports en el top, agregar:

```tsx
import { useTradesByStatus } from "@/hooks/useTrades";
import { useFriends } from "@/hooks/useFriends";
import { useSession } from "@/auth/useSession";
import { useRespondTrade } from "@/hooks/useRespondTrade";
import { useCancelTrade } from "@/hooks/useCancelTrade";
import { useConfirmTrade } from "@/hooks/useConfirmTrade";
import { useUnconfirmTrade } from "@/hooks/useUnconfirmTrade";
import type { Trade, TradeStatus } from "@/domain/types";
```

(Si `useFriends` ya está importado del Task 7, no duplicar.)

- [ ] **Step 2: Verificar que existen los hooks `useRespondTrade`, `useCancelTrade`**

```bash
ls src/hooks/useRespondTrade.ts src/hooks/useCancelTrade.ts src/hooks/useConfirmTrade.ts src/hooks/useUnconfirmTrade.ts 2>&1
```

Expected: los 4 archivos existen. Si alguno no existe, leer `src/social/trades.ts` y crear hooks análogos a `useConfirmTrade`. (Si todos existen, continuar.)

- [ ] **Step 3: Reemplazar el stub `function TruequesView()` con la implementación**

```tsx
type TradeFilter = "pending" | "accepted" | "completed";

function TruequesView() {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<TradeFilter>("pending");
  const { data: trades, isLoading } = useTradesByStatus(filter);
  const { data: friends } = useFriends();
  const { user } = useSession();
  const friendMap = new Map((friends ?? []).map((f) => [f.id, f]));

  if (!user) return null;

  return (
    <View>
      <View className="flex-row mb-4" style={{ gap: 8 }}>
        {(["pending", "accepted", "completed"] as TradeFilter[]).map((f) => {
          const active = f === filter;
          const label = f === "pending" ? "Pendientes" : f === "accepted" ? "En curso" : "Completados";
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar ${label}`}
              accessibilityState={{ selected: active }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: active ? theme.accent : theme.card,
                borderWidth: 1,
                borderColor: active ? theme.accent : theme.border
              }}
            >
              <Text
                style={{
                  color: active ? "#fff" : theme.textMute,
                  fontSize: 12,
                  fontWeight: "600"
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <Text style={{ color: theme.textMute, textAlign: "center", marginTop: 16 }}>Cargando…</Text>
      ) : !trades || trades.length === 0 ? (
        <EmptyState
          variant="rocket"
          title={
            filter === "pending"
              ? "Sin trueques pendientes"
              : filter === "accepted"
                ? "Sin trueques en curso"
                : "Sin trueques completados"
          }
          message="Cuando inicies o recibas un trueque, aparecerá acá."
        />
      ) : (
        trades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            meId={user.id}
            counterpartyUsername={
              friendMap.get(trade.proposerId === user.id ? trade.recipientId : trade.proposerId)
                ?.username ?? "amigo"
            }
          />
        ))
      )}
    </View>
  );
}

function TradeCard({
  trade,
  meId,
  counterpartyUsername
}: {
  trade: Trade;
  meId: string;
  counterpartyUsername: string;
}) {
  const { theme } = useTheme();
  const respond = useRespondTrade();
  const cancel = useCancelTrade();
  const confirm = useConfirmTrade();
  const unconfirm = useUnconfirmTrade();

  const iAmProposer = trade.proposerId === meId;
  const iGave = iAmProposer ? trade.proposerGives : trade.proposerGets;
  const iGot = iAmProposer ? trade.proposerGets : trade.proposerGives;
  const iConfirmed = iAmProposer ? trade.proposerConfirmedAt !== null : trade.recipientConfirmedAt !== null;
  const otherConfirmed = iAmProposer ? trade.recipientConfirmedAt !== null : trade.proposerConfirmedAt !== null;

  const dateLabel =
    trade.status === "completed" && trade.completedAt
      ? new Date(trade.completedAt).toLocaleDateString()
      : new Date(trade.updatedAt).toLocaleDateString();

  return (
    <GlowCard className="mb-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
          @{counterpartyUsername}
        </Text>
        <Text style={{ color: theme.textMute, fontSize: 12 }}>{dateLabel}</Text>
      </View>
      <Text style={{ color: theme.textMute, fontSize: 12, marginBottom: 2 }}>
        Le diste: {iGave.join(", ")}
      </Text>
      <Text style={{ color: theme.textMute, fontSize: 12, marginBottom: 8 }}>
        Te dio: {iGot.join(", ")}
      </Text>

      {trade.status === "pending" && iAmProposer && (
        <Pressable
          onPress={() => cancel.mutate(trade.id)}
          disabled={cancel.isPending}
          style={{
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: "center"
          }}
          accessibilityRole="button"
          accessibilityLabel="Cancelar trueque"
        >
          <Text style={{ color: theme.textMute, fontWeight: "600" }}>Cancelar</Text>
        </Pressable>
      )}

      {trade.status === "pending" && !iAmProposer && (
        <View className="flex-row" style={{ gap: 8 }}>
          <Pressable
            onPress={() => respond.mutate({ tradeId: trade.id, accept: true })}
            disabled={respond.isPending}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: theme.accent,
              alignItems: "center"
            }}
            accessibilityRole="button"
            accessibilityLabel="Aceptar trueque"
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Aceptar</Text>
          </Pressable>
          <Pressable
            onPress={() => respond.mutate({ tradeId: trade.id, accept: false })}
            disabled={respond.isPending}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center"
            }}
            accessibilityRole="button"
            accessibilityLabel="Rechazar trueque"
          >
            <Text style={{ color: theme.textMute, fontWeight: "600" }}>Rechazar</Text>
          </Pressable>
        </View>
      )}

      {trade.status === "accepted" && !iConfirmed && (
        <Pressable
          onPress={() => confirm.mutate(trade.id)}
          disabled={confirm.isPending}
          style={{
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: theme.accent,
            alignItems: "center"
          }}
          accessibilityRole="button"
          accessibilityLabel="Confirmar trueque"
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Confirmar</Text>
        </Pressable>
      )}

      {trade.status === "accepted" && iConfirmed && !otherConfirmed && (
        <View>
          <Text style={{ color: theme.textMute, fontSize: 13, marginBottom: 6 }}>
            Esperás confirmación de @{counterpartyUsername}
          </Text>
          <Pressable
            onPress={() => unconfirm.mutate(trade.id)}
            disabled={unconfirm.isPending}
            style={{
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center"
            }}
            accessibilityRole="button"
            accessibilityLabel="Deshacer confirmación"
          >
            <Text style={{ color: theme.textMute, fontWeight: "600" }}>Deshacer</Text>
          </Pressable>
        </View>
      )}

      {trade.status === "completed" && (
        <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "600" }}>
          ✓ Completado · {dateLabel}
        </Text>
      )}
    </GlowCard>
  );
}
```

- [ ] **Step 4: Verificar firma de `useRespondTrade`**

```bash
cat src/hooks/useRespondTrade.ts
```

Si la mutación recibe `{ tradeId, accept }` como objeto, el código funciona. Si recibe parámetros separados, ajustar el `respond.mutate` arriba. **Si no existe el hook**, crearlo:

```ts
// src/hooks/useRespondTrade.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { respondTrade } from "@/social/trades";

export function useRespondTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, accept }: { tradeId: string; accept: boolean }) =>
      respondTrade(tradeId, accept),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
    }
  });
}
```

- [ ] **Step 5: Verificar firma de `useCancelTrade`**

```bash
cat src/hooks/useCancelTrade.ts
```

Si no existe, crearlo:

```ts
// src/hooks/useCancelTrade.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelTrade } from "@/social/trades";

export function useCancelTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tradeId: string) => cancelTrade(tradeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
    }
  });
}
```

- [ ] **Step 6: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 7: Tests**

```bash
pnpm test 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/\(tabs\)/friends.tsx src/hooks/
git commit -m "feat(friends): TruequesView con chips Pendientes/En curso/Completados"
```

---

### Task 9: `CercaView` — mover NearbyView del archivo viejo

**Files:**
- Modify: `app/(tabs)/friends.tsx`

Copia el cuerpo de `NearbyView` desde `app/(tabs)/trades.tsx` al stub `CercaView` en `friends.tsx`. La lógica es idéntica.

- [ ] **Step 1: Imports faltantes**

Asegurarse que en los imports de `friends.tsx` está:

```tsx
import { useNearbyMatches } from "@/hooks/useNearbyMatches";
import { ProgressBar } from "@/ui/ProgressBar";
```

(Y `useSession`, `useRouter`, `EmptyState`, `GlowCard` ya están del Task 7/8.)

- [ ] **Step 2: Reemplazar stub `function CercaView()`**

```tsx
function CercaView() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSession();
  const { data, isLoading, isFetching, refetch } = useNearbyMatches();

  const onReload = async () => {
    await haptics.light();
    await refetch();
  };

  if (!user?.discoverable) {
    return (
      <EmptyState
        variant="rocket"
        title="Permite que te encuentren"
        message="Ve a Perfil → Editar para activar «Que me encuentren» y que personas de tu ciudad puedan contactarte."
      />
    );
  }

  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-space-mute text-xs tracking-widest">
          {user.city_label ?? "TU CIUDAD"}
        </Text>
        <Pressable
          onPress={onReload}
          disabled={isFetching}
          accessibilityRole="button"
          accessibilityLabel="Actualizar matches cercanos"
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            opacity: isFetching ? 0.6 : 1
          }}
        >
          {isFetching ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>↻ Actualizar</Text>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <Text className="text-space-mute text-center mt-4">Cargando…</Text>
      ) : !data || data.length === 0 ? (
        <EmptyState
          variant="rocket"
          title="Sin matches cerca todavía"
          message={`Nadie en ${user.city_label ?? "tu ciudad"} tiene complementarios contigo por ahora. Toca Actualizar o vuelve después.`}
        />
      ) : (
        data.map((m) => {
          const maxScore = data[0]?.score ?? m.score;
          const pct = maxScore > 0 ? m.score / maxScore : 0;
          return (
            <Pressable
              key={m.themId}
              onPress={() => router.push(`/nearby/${m.username}` as never)}
              accessibilityLabel={`Ver match con @${m.username}, score ${m.score}`}
              accessibilityRole="button"
            >
              <GlowCard className="mb-2">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-space-ink font-semibold">@{m.username}</Text>
                  <Text style={{ color: theme.accent, fontWeight: "700" }}>score {m.score}</Text>
                </View>
                <Text className="text-space-mute text-xs mb-2">
                  necesitas {m.theyHaveINeed} · puedes dar {m.iHaveTheyNeed}
                </Text>
                <ProgressBar pct={pct} height={3} from={theme.accent} to={theme.accent} />
              </GlowCard>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/friends.tsx
git commit -m "feat(friends): CercaView movido desde trades.tsx (idéntico)"
```

---

## Switch del bottom tab + cleanup

### Task 10: Cambiar el bottom tab Cambios → Amigos

**Files:**
- Modify: `app/(tabs)/_layout.tsx:33-44`

- [ ] **Step 1: Reemplazar la `Tabs.Screen name="trades"`**

Buscar el bloque actual (líneas ~33-44):

```tsx
      <Tabs.Screen
        name="trades"
        options={{
          title: "Cambios",
          tabBarIcon: ({ focused }) => <TabIcon icon="↔" focused={focused} active={theme.accent} inactive={theme.textMute} />,
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined
        }}
      />
```

Reemplazar por:

```tsx
      <Tabs.Screen
        name="friends"
        options={{
          title: "Amigos",
          tabBarIcon: ({ focused }) => <TabIcon icon="◍" focused={focused} active={theme.accent} inactive={theme.textMute} />,
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined
        }}
      />
```

(El glifo `◍` representa un pequeño avatar group — alineado con el set existente; si visualmente no encaja, sustituir por `★` o cualquiera del set actual del proyecto.)

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Smoke test manual**

Iniciar Metro si no está corriendo:

```bash
pnpm start
```

En el dispositivo:
- Tap en el tab del medio → debería decir "Amigos" y abrir la nueva pantalla.
- Verificar los 3 sub-tabs cargan (Amigos default, Trueques, Cerca).
- Verificar la sección Solicitudes solo aparece si hay pending.
- Verificar la lista de amigos.
- Tap en un amigo → navega a `/friends/[username]` (ruta vieja, ya existe).

(Si algo no carga, NO continuar a Task 11. Volver a investigar el bug.)

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/_layout.tsx
git commit -m "feat(tabs): swap bottom tab Cambios → Amigos"
```

---

### Task 11: Quitar botón "Mis amigos" de Perfil

**Files:**
- Modify: `app/(tabs)/profile.tsx:114-121`

- [ ] **Step 1: Borrar el `Pressable` "Mis amigos"**

Buscar el bloque (líneas ~114-121):

```tsx
        <Pressable
          onPress={() => router.push("/friends" as never)}
          className="bg-space-mid rounded-xl py-3 items-center mb-2"
          accessibilityLabel="Mis amigos"
          accessibilityRole="button"
        >
          <Text className="text-space-ink font-semibold">👥 Mis amigos</Text>
        </Pressable>
```

Borrarlo completo.

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores. Si `useRouter` queda sin usar en `profile.tsx`, removerlo del import (verificar el resto del archivo).

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/profile.tsx
git commit -m "refactor(profile): quitar botón Mis amigos (vive en el tab Amigos)"
```

---

### Task 12: Borrar archivos obsoletos

**Files:**
- Delete: `app/friends/index.tsx` (la lista; `[username].tsx` se mantiene)
- Delete: `app/(tabs)/trades.tsx`

- [ ] **Step 1: Verificar que ningún import vivo apunta a `app/friends/index.tsx` o a la ruta `/friends` (sin `[username]`)**

```bash
grep -rn "router\.push.*\"/friends\"" app/ src/ 2>/dev/null
```

Expected: sin matches (el único uso fue el botón borrado en Task 11). Si aparece algo, decidir si remover o si redirigir antes de borrar.

- [ ] **Step 2: Verificar que `app/(tabs)/trades.tsx` no es importado por nada**

```bash
grep -rn "(tabs)/trades\|/trades['\"]" app/ src/ 2>/dev/null | grep -v "trades_cache\|trades.ts\|trades/propose\|trades.tsx"
```

Expected: sin matches que importen el módulo (sí pueden aparecer matches con `trades/propose/[username]`, que es otra ruta y se queda).

- [ ] **Step 3: Borrar archivos**

```bash
rm app/friends/index.tsx app/\(tabs\)/trades.tsx
```

- [ ] **Step 4: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores. (Expo Router puede emitir un warning sobre rutas, pero el typecheck no debería fallar.)

- [ ] **Step 5: Tests**

```bash
pnpm test 2>&1 | tail -10
```

Expected: PASS (no toco nada testeado).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: borrar app/friends/index.tsx y app/(tabs)/trades.tsx (obsoletos)

La lista de amigos vive ahora en el sub-tab Amigos del tab nuevo. La
pantalla Cambios fue reemplazada por el tab Amigos."
```

---

## Verificación final

### Task 13: Smoke test end-to-end

- [ ] **Step 1: Reiniciar Metro**

Si tiene cambios stale:

```bash
pnpm start --clear
```

- [ ] **Step 2: En el iPhone, verificar:**

- [ ] Bottom tab muestra: Home | Amigos | Perfil (3 tabs)
- [ ] Tap "Amigos" → carga sin colgarse
- [ ] Sub-tab "Amigos" → ve solicitudes pendientes (si hay) y lista de amigos
- [ ] Sub-tab "Trueques" → chips Pendientes/En curso/Completados funcionan, mostrando empty state cuando vacío
- [ ] Sub-tab "Cerca" → idéntico al Cerca de mí viejo
- [ ] Pull-to-refresh en cualquier sub-tab actualiza
- [ ] Perfil ya no tiene botón "Mis amigos"
- [ ] Tap "/" en Perfil (back button del tab no aplica, es root)
- [ ] Tab badge numérico aparece sobre Amigos cuando hay solicitudes

- [ ] **Step 3: Verificar el fix del auto-mark**

Necesitan dos dispositivos (o dos cuentas).

- [ ] Cuenta A propone trueque a B (algo concreto, ej. ARG-1 ↔ COL-2).
- [ ] Cuenta B acepta.
- [ ] Ambas cuentas ven el trueque en "En curso".
- [ ] Cuenta A tap "Confirmar" → status "Esperás confirmación de @b".
- [ ] Cuenta B tap "Confirmar" → en B la app marca cromos al instante (Home muestra ARG-1 con `count -1`, COL-2 con `count +1` SIN salir y volver a entrar a la app).
- [ ] En A llega por realtime: la home se refresca también (cromos actualizados sin salir y volver).

(Si el auto-mark no funciona en alguno de los dos lados, revisar logs de `pullRemoteStatus` y de `onTradeChange` en Metro.)

- [ ] **Step 4: Run typecheck + tests final**

```bash
pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -10
```

Expected: typecheck clean + tests PASS.

- [ ] **Step 5: NO commit final** (todos los commits ya quedaron en sus respectivos tasks). Si querés, push:

```bash
git log --oneline -8
```

Verificar que los 8-9 commits del plan están listos para push.

---

## Notas para el implementador

- **Glifo del tab**: `◍` se eligió por encajar con `⌂` (Home) y `◔` (Perfil). Si en device se ve raro, sustituir por cualquier glifo monocromo del proyecto.
- **`pendingCount` badge**: representa solicitudes de amistad, no trueques pendientes. Se mantiene la semántica actual.
- **Falta de tests UI**: consistente con CLAUDE.md ("no testeamos UI con snapshots"). El smoke test cubre la experiencia.
- **Recovery si el plan falla mid-flight**: cada commit deja la app en estado verde (ya sea con la pantalla vieja activa o con la nueva — nunca ambas a medias). Reset al último commit que funcione es seguro.
- **Si `useRespondTrade` o `useCancelTrade` no existían**: el plan incluye creación inline en Task 8 steps 4-5. Esto es un mini-task adicional dentro de Task 8.
