# Trades Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover el QR + agregar-amigo de Perfil a la sub-tab Amigos, y agregar un FAB "+ Nuevo trueque" en sub-tab Trueques que lanza un wizard de 2 pasos — el cual soporta proponer trueque a desconocidos enviando una solicitud de amistad combo en un solo RPC.

**Architecture:** Backend nuevo RPC `trade_propose_combo` (security definer) que crea pending friendship + pending trade atómicos; trigger `cancel_combo_trades_on_friendship_delete` para cancelar trades pendientes cuando cualquier lado borra la friendship asociada. Cliente nuevo selector puro (`tradeRpcSelector.ts`) decide entre el flow normal (INSERT directo) y el RPC combo según si el destinatario ya es amigo aceptado. UI nueva: dos chips en sub-tab Amigos (Mi código + Agregar amigo), un FAB en sub-tab Trueques, una nueva ruta `/trades/new` (wizard step 1) y una pantalla `/trades/propose/[username]` adaptada para mostrar el resumen combo cuando aplica.

**Tech Stack:** Expo SDK 54 + React Native 0.81, TypeScript strict, Supabase Postgres + RLS, expo-router file-based routing, NativeWind v4, react-native-qrcode-svg, Jest + jest-expo.

---

## File Structure

**Nuevos archivos** (responsabilidad de cada uno):

- `supabase/migrations/20260514000000_friendship_trade_combo.sql` — extiende el enum `friendship_source` con `trade_combo`, crea RPC `trade_propose_combo`, modifica `decline_friend_request` y agrega trigger `cancel_combo_trades_on_friendship_delete`.
- `src/domain/tradeRpcSelector.ts` — función pura que devuelve `'insert' | 'combo'` según el estado de friendship.
- `tests/domain/tradeRpcSelector.test.ts` — tests del selector.
- `src/ui/MyCodeChip.tsx` — chip horizontal con código + icono share + modal con QR.
- `src/ui/AddFriendChip.tsx` — chip "+ Agregar amigo" que abre el picker.
- `src/ui/AddFriendPicker.tsx` — bottom sheet con opciones "Escanear QR" / "Buscar por @".
- `app/trades/new/index.tsx` — wizard step 1, lista amigos + accesos a scan/search para extranjeros.

**Archivos modificados** (qué cambia en cada uno):

- `app/(tabs)/profile.tsx` — saca el `GlowCard` del QR/código y los dos botones "Escanear" / "Buscar @".
- `app/(tabs)/friends.tsx` — sub-tab Amigos: agrega header con MyCodeChip + AddFriendChip; sub-tab Trueques: agrega FAB; SOLICITUDES card: muestra badge "🔄 trueque pendiente" cuando `friendship.source === 'trade_combo'`; TradeCard: estado "esperando amistad" cuando hay un trade pendiente y la friendship sigue pending.
- `app/trades/propose/[username].tsx` — detecta si el destinatario es amigo aceptado; si no, muestra alerta confirmando "Vas a enviar solicitud de amistad junto con este trueque", y llama al RPC combo en vez de `proposeTrade` (insert directo).
- `src/social/trades.ts` — agrega `proposeTradeCombo(input)` wrapper del RPC nuevo.
- `src/hooks/useProposeTrade.ts` — usa el selector para decidir qué función llamar.
- `src/social/friendships.ts` — pequeño helper para detectar si un username es amigo aceptado (puede ya existir; verificar).
- `tests/domain/trades.test.ts` (o existente análogo) — caso combo: cuando friendship es null/pending, selector devuelve `'combo'`.

---

## Task 1: Migración SQL — enum, RPC combo, trigger

**Files:**
- Create: `supabase/migrations/20260514000000_friendship_trade_combo.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/20260514000000_friendship_trade_combo.sql
--
-- Combo amistad+trueque: nuevo enum value + RPC para proponer trueque a
-- desconocidos enviando solicitud de amistad pendiente atómicamente.

-- 1. Extender enum
alter type public.friendship_source add value if not exists 'trade_combo';

-- 2. RPC: propone trueque + crea friendship pending si no existe
create or replace function public.trade_propose_combo(
  p_recipient_id uuid,
  p_gives        text[],
  p_gets         text[],
  p_message      text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trade_id uuid;
  v_existing public.friendships%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_recipient_id = auth.uid() then
    raise exception 'cannot_trade_with_self';
  end if;

  -- Resolver amistad (cualquier dirección)
  select * into v_existing
  from public.friendships
  where (user_id = auth.uid() and friend_id = p_recipient_id)
     or (user_id = p_recipient_id and friend_id = auth.uid())
  limit 1;

  if v_existing.user_id is null then
    -- Sin relación: crear pending del lado del proposer
    insert into public.friendships (user_id, friend_id, status, source)
    values (auth.uid(), p_recipient_id, 'pending', 'trade_combo');
  elsif v_existing.status = 'blocked' then
    raise exception 'friendship_blocked';
  end if;
  -- Si pending o accepted, no tocamos la amistad.

  -- Insertar trade en pending
  insert into public.trades (proposer_id, recipient_id, proposer_gives, proposer_gets, message, status)
  values (auth.uid(), p_recipient_id, p_gives, p_gets, p_message, 'pending')
  returning id into v_trade_id;

  return v_trade_id;
end;
$$;

grant execute on function public.trade_propose_combo(uuid, text[], text[], text) to authenticated;

-- 3. Trigger: cuando se borra una friendship (cancel proposer / decline recipient)
--    cancela todos los trades pendientes entre los dos usuarios.
create or replace function public._cancel_combo_trades_on_friendship_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo aplica si la friendship borrada era una solicitud combo pendiente
  if old.source <> 'trade_combo' or old.status <> 'pending' then
    return old;
  end if;

  update public.trades
     set status = 'cancelled',
         updated_at = now()
   where status = 'pending'
     and ((proposer_id = old.user_id and recipient_id = old.friend_id)
       or (proposer_id = old.friend_id and recipient_id = old.user_id));

  return old;
end;
$$;

drop trigger if exists trg_cancel_combo_trades on public.friendships;
create trigger trg_cancel_combo_trades
  after delete on public.friendships
  for each row
  execute function public._cancel_combo_trades_on_friendship_delete();
```

- [ ] **Step 2: Aplicar migración al proyecto remoto**

```bash
supabase db push
```

Expected: la migration aparece en el proyecto remoto, sin errores. Si hay error de transacción mixta con `alter type`, separar en dos migraciones (primera solo el `alter type`, segunda lo demás) — Postgres no permite mezclar enum extension + uso del nuevo valor en la misma transacción.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260514000000_friendship_trade_combo.sql
git commit -m "$(cat <<'EOF'
feat(db): RPC trade_propose_combo + trigger para combo amistad+trueque

Agrega el enum value friendship_source.trade_combo, el RPC
trade_propose_combo (security definer) que inserta friendship pending +
trade pending atómicos cuando el destinatario no es amigo, y un trigger
que cancela trades pendientes cuando una friendship combo se borra.
EOF
)"
```

---

## Task 2: Pure logic — tradeRpcSelector con TDD

**Files:**
- Create: `src/domain/tradeRpcSelector.ts`
- Test: `tests/domain/tradeRpcSelector.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
// tests/domain/tradeRpcSelector.test.ts
import { pickProposeRpc } from "@/domain/tradeRpcSelector";

describe("pickProposeRpc", () => {
  it("devuelve 'insert' cuando la amistad está aceptada", () => {
    expect(pickProposeRpc({ status: "accepted" })).toBe("insert");
  });

  it("devuelve 'combo' cuando no hay relación previa", () => {
    expect(pickProposeRpc(null)).toBe("combo");
  });

  it("devuelve 'combo' cuando la amistad está pending", () => {
    expect(pickProposeRpc({ status: "pending" })).toBe("combo");
  });

  it("tira error cuando la amistad está blocked", () => {
    expect(() => pickProposeRpc({ status: "blocked" })).toThrow("friendship_blocked");
  });

  it("tira error cuando la amistad está rejected", () => {
    expect(() => pickProposeRpc({ status: "rejected" })).toThrow("friendship_blocked");
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

```bash
pnpm test tests/domain/tradeRpcSelector.test.ts
```

Expected: FAIL con "Cannot find module '@/domain/tradeRpcSelector'".

- [ ] **Step 3: Implementar el selector mínimo para que pase**

```ts
// src/domain/tradeRpcSelector.ts

export type FriendshipStateForRpc = { status: "pending" | "accepted" | "blocked" | "rejected" } | null;

/**
 * Decide qué RPC usar para proponer un trueque según el estado de amistad.
 *
 * - 'insert': amistad ya aceptada → insert directo en `trades` (la RLS valida).
 * - 'combo': sin relación previa o pending → llamar al RPC trade_propose_combo
 *   que crea friendship pending (si hace falta) + trade pending atómicos.
 *
 * Tira 'friendship_blocked' si el otro nos bloqueó o rechazó previamente.
 */
export function pickProposeRpc(friendship: FriendshipStateForRpc): "insert" | "combo" {
  if (!friendship) return "combo";
  switch (friendship.status) {
    case "accepted":
      return "insert";
    case "pending":
      return "combo";
    case "blocked":
    case "rejected":
      throw new Error("friendship_blocked");
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

```bash
pnpm test tests/domain/tradeRpcSelector.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/domain/tradeRpcSelector.ts tests/domain/tradeRpcSelector.test.ts
git commit -m "$(cat <<'EOF'
feat(domain): tradeRpcSelector decide entre insert vs combo RPC

Función pura que mapea estado de friendship → qué camino tomar para
proponer un trueque. accepted → insert directo (existing flow), null/pending
→ RPC combo. blocked/rejected tira friendship_blocked.
EOF
)"
```

---

## Task 3: Client wrapper `proposeTradeCombo` en social/trades.ts

**Files:**
- Modify: `src/social/trades.ts`

- [ ] **Step 1: Agregar el wrapper a `src/social/trades.ts`**

Encontrar el bloque de `export async function proposeTrade(...)` (línea ~46) y agregar inmediatamente después:

```ts
export async function proposeTradeCombo(input: ProposeTradeInput): Promise<string> {
  const { data, error } = await supabase.rpc("trade_propose_combo", {
    p_recipient_id: input.recipientId,
    p_gives: input.proposerGives,
    p_gets: input.proposerGets,
    p_message: input.message ?? null
  });
  if (error) throw error;
  const tradeId = data as string;
  // El insert directo en proposeTrade hace upsertTrade desde el row. Acá
  // el RPC solo devuelve el id; tiramos un refresh para hidratar el cache.
  await refreshTradeFromRemote(tradeId);
  return tradeId;
}
```

Asumir que `refreshTradeFromRemote` ya existe (lo usan `respondTrade`, `cancelTrade`). Si no, ver al final del archivo cómo lo definen y reusar.

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/social/trades.ts
git commit -m "$(cat <<'EOF'
feat(social): proposeTradeCombo wrapper del RPC trade_propose_combo

Llama al RPC nuevo cuando el destinatario aún no es amigo aceptado.
Devuelve el id del trade y refresca el cache local desde remote.
EOF
)"
```

---

## Task 4: Hook `useProposeTrade` usa el selector

**Files:**
- Modify: `src/hooks/useProposeTrade.ts`
- Modify: `src/social/friendships.ts` (si hace falta helper de "is friend accepted")

- [ ] **Step 1: Leer hook actual para entender la shape**

```bash
cat src/hooks/useProposeTrade.ts
```

- [ ] **Step 2: Modificar el hook para usar el selector**

Reemplazar el cuerpo del hook (todo el `useMutation`) con lo siguiente — ajustando los imports al tope del archivo:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposeTrade, proposeTradeCombo, type ProposeTradeInput } from "@/social/trades";
import { findFriendshipStatusByUserId } from "@/social/friendships";
import { pickProposeRpc } from "@/domain/tradeRpcSelector";

export function useProposeTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProposeTradeInput) => {
      const friendship = await findFriendshipStatusByUserId(input.recipientId);
      const rpc = pickProposeRpc(friendship);
      if (rpc === "insert") {
        const trade = await proposeTrade(input);
        return trade.id;
      }
      return proposeTradeCombo(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["outgoingRequests"] });
    }
  });
}
```

- [ ] **Step 3: Agregar `findFriendshipStatusByUserId` a `src/social/friendships.ts` si no existe**

Verificar primero si la función ya existe:

```bash
grep -n "findFriendshipStatusByUserId" src/social/friendships.ts
```

Si NO existe, agregar al final del archivo:

```ts
export async function findFriendshipStatusByUserId(
  otherUserId: string
): Promise<{ status: "pending" | "accepted" | "blocked" | "rejected" } | null> {
  const meId = (await supabase.auth.getSession()).data.session?.user?.id;
  if (!meId) throw new Error("not_authenticated");
  const { data, error } = await supabase
    .from("friendships")
    .select("status")
    .or(
      `and(user_id.eq.${meId},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${meId})`
    )
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { status: data.status } : null;
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProposeTrade.ts src/social/friendships.ts
git commit -m "$(cat <<'EOF'
refactor(hook): useProposeTrade selecciona insert vs combo según friendship

Usa el selector puro tradeRpcSelector + un nuevo helper
findFriendshipStatusByUserId para decidir si el trueque va por el path
de INSERT directo (amigo aceptado) o por el RPC combo (desconocido o
pending).
EOF
)"
```

---

## Task 5: `MyCodeChip` con modal QR

**Files:**
- Create: `src/ui/MyCodeChip.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// src/ui/MyCodeChip.tsx
import { useState } from "react";
import { View, Text, Pressable, Modal, Share, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { useSession } from "@/auth/useSession";
import { useTheme } from "@/theme/ThemeProvider";
import { haptics } from "@/lib/haptics";

export function MyCodeChip() {
  const { user } = useSession();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const code = user.invite_code;

  const onShare = async () => {
    await haptics.light();
    await Share.share({
      message: `Agregame en stickerSwap: ${code}`
    });
  };

  const onCopy = async () => {
    await Clipboard.setStringAsync(code);
    await haptics.success();
    Alert.alert("Copiado", `Tu código ${code} está en el portapapeles.`);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Ver mi código QR"
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.textMute, fontSize: 10, letterSpacing: 1, fontWeight: "700" }}>
            MI CÓDIGO
          </Text>
          <Text style={{ color: theme.text, fontSize: 14, fontFamily: "monospace", marginTop: 2 }}>
            {code}
          </Text>
        </View>
        <Pressable
          onPress={onShare}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Compartir mi código"
          style={{ paddingHorizontal: 6 }}
        >
          <Text style={{ color: theme.text, fontSize: 18 }}>📤</Text>
        </Pressable>
      </Pressable>

      <Modal
        visible={open}
        animationType="fade"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}
        >
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
              borderRadius: 16,
              padding: 24,
              alignItems: "center",
              maxWidth: 320,
              width: "85%"
            }}
          >
            <Text style={{ color: theme.textMute, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginBottom: 14 }}>
              TU CÓDIGO
            </Text>
            <View style={{ backgroundColor: "#fff", padding: 14, borderRadius: 10, marginBottom: 14 }}>
              <QRCode value={code} size={180} backgroundColor="#fff" color="#000" />
            </View>
            <Text style={{ color: theme.text, fontSize: 22, fontFamily: "monospace", fontWeight: "700", letterSpacing: 2, marginBottom: 16 }}>
              {code}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={onCopy}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  borderWidth: 1
                }}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Copiar</Text>
              </Pressable>
              <Pressable
                onPress={onShare}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: theme.accent
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Compartir</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/MyCodeChip.tsx
git commit -m "$(cat <<'EOF'
feat(ui): MyCodeChip — chip con código + modal QR + share

Chip horizontal con código de invitación inline e icono de share.
Tap abre modal con QR full-size, código, copiar y compartir.
EOF
)"
```

---

## Task 6: `AddFriendPicker` + `AddFriendChip`

**Files:**
- Create: `src/ui/AddFriendPicker.tsx`
- Create: `src/ui/AddFriendChip.tsx`

- [ ] **Step 1: Crear `AddFriendPicker.tsx` (modal bottom-sheet con dos opciones)**

```tsx
// src/ui/AddFriendPicker.tsx
import { Modal, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";

export function AddFriendPicker({
  visible,
  onClose
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { theme } = useTheme();

  const goScan = () => {
    onClose();
    router.push("/add-friend/scan" as never);
  };
  const goSearch = () => {
    onClose();
    router.push("/add-friend/search" as never);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: theme.bg,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 32
          }}
        >
          <Text style={{ color: theme.textMute, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginBottom: 12 }}>
            AGREGAR AMIGO
          </Text>

          <Pressable
            onPress={goScan}
            accessibilityRole="button"
            accessibilityLabel="Escanear código de amigo"
            style={{
              backgroundColor: theme.accent,
              paddingVertical: 14,
              borderRadius: 10,
              alignItems: "center",
              marginBottom: 8
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>📷  Escanear código</Text>
          </Pressable>

          <Pressable
            onPress={goSearch}
            accessibilityRole="button"
            accessibilityLabel="Buscar por username"
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
              paddingVertical: 14,
              borderRadius: 10,
              alignItems: "center"
            }}
          >
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>⌕  Buscar por @username</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Crear `AddFriendChip.tsx`**

```tsx
// src/ui/AddFriendChip.tsx
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { AddFriendPicker } from "./AddFriendPicker";

export function AddFriendChip() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Agregar amigo"
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 10
        }}
      >
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700" }}>+ Agregar</Text>
      </Pressable>
      <AddFriendPicker visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/AddFriendChip.tsx src/ui/AddFriendPicker.tsx
git commit -m "$(cat <<'EOF'
feat(ui): AddFriendChip + AddFriendPicker bottom sheet

Chip "+ Agregar" abre un bottom sheet con dos opciones (Escanear /
Buscar por @) que rutean a las pantallas existentes add-friend/scan
y add-friend/search.
EOF
)"
```

---

## Task 7: Limpiar Perfil — sacar QR y add-friend

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Eliminar el `GlowCard` del QR y los dos botones "Escanear" / "Buscar @"**

Buscar y borrar el bloque `<GlowCard className="items-center mb-4">...QRCode...</GlowCard>` (líneas aprox. 73-89 según `Read` previo).

Buscar y borrar los dos `<Pressable>` que rutean a `/add-friend/scan` y `/add-friend/search` (líneas aprox. 110-126).

También limpiar imports que dejan de usarse:
- `QRCode from "react-native-qrcode-svg"` — quitar import.
- `* as Clipboard from "expo-clipboard"` — quitar import.
- `haptics` — quitar import si no se usa más.
- La función `onCopyCode` — quitar.

El archivo debería quedar con: avatar/nombre, apariencia (tema oscuro), editar perfil, acerca de, cerrar sesión, borrar cuenta.

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/profile.tsx
git commit -m "$(cat <<'EOF'
refactor(profile): saca QR + add-friend, pasa a vivir en tab Amigos

Perfil queda solo con: avatar/nombre, apariencia, editar, acerca de y
acciones de cuenta. El QR/código de invitación y los botones de
"Escanear" / "Buscar @" se mueven a la sub-tab Amigos en commits
siguientes.
EOF
)"
```

---

## Task 8: Sub-tab Amigos — header con chips

**Files:**
- Modify: `app/(tabs)/friends.tsx`

- [ ] **Step 1: Importar los chips al tope de `friends.tsx`**

Sumar a los imports existentes:

```tsx
import { MyCodeChip } from "@/ui/MyCodeChip";
import { AddFriendChip } from "@/ui/AddFriendChip";
```

- [ ] **Step 2: Modificar el `AmigosView` para renderizar la fila de chips arriba de SOLICITUDES**

Buscar el bloque `function AmigosView() { ... return ( <View> {hasRequests && ...} ...` (línea aprox. 89).

Reemplazar el `return (<View>...)` por:

```tsx
  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <MyCodeChip />
        <AddFriendChip />
      </View>

      {hasRequests && (
        // ... el bloque existing de SOLICITUDES intacto
      )}

      {/* MIS AMIGOS y la lista, intactos */}
    </View>
  );
```

(Mantener el resto del JSX exactamente como está; solo insertar la nueva fila al inicio del `<View>` raíz.)

- [ ] **Step 3: Verificar visualmente que el padding del MyCodeChip llena (flex: 1) y AddFriendChip ocupa lo necesario**

Si visualmente AddFriendChip queda muy chico, sumar `style={{ alignSelf: "stretch" }}` en su Pressable.

- [ ] **Step 4: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/friends.tsx
git commit -m "$(cat <<'EOF'
feat(friends): header con chips Mi código + Agregar amigo

Inserta una fila al tope de la sub-tab Amigos con los chips MyCodeChip
(QR + share) y AddFriendChip (abre bottom sheet con scan/buscar).
Sustituye lo que antes vivía en Perfil.
EOF
)"
```

---

## Task 9: FAB "+ Nuevo trueque" en sub-tab Trueques

**Files:**
- Modify: `app/(tabs)/friends.tsx`

- [ ] **Step 1: Agregar el FAB condicional al `Friends` component (root)**

Justo antes del `</ThemedBackground>` final del `Friends()` component, agregar:

```tsx
        {tab === "trueques" && (
          <Pressable
            onPress={() => router.push("/trades/new" as never)}
            accessibilityRole="button"
            accessibilityLabel="Nuevo trueque"
            style={{
              position: "absolute",
              right: 20,
              bottom: insets.bottom + 24,
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: theme.accent,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: theme.text,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 6,
              zIndex: 20
            }}
          >
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700", lineHeight: 30 }}>+</Text>
          </Pressable>
        )}
```

El `router` ya está importado (`useRouter`). Si no, agregar `const router = useRouter();` en el componente `Friends()`.

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors (la ruta `/trades/new` aún no existe pero `as never` evita error).

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/friends.tsx
git commit -m "$(cat <<'EOF'
feat(friends): FAB + Nuevo trueque en sub-tab Trueques

Botón flotante que solo aparece cuando la sub-tab activa es Trueques.
Ruta a /trades/new (wizard step 1). Respeta insets.bottom para no
quedar bajo gesture/nav bar de Android.
EOF
)"
```

---

## Task 10: Wizard step 1 — `app/trades/new/index.tsx`

**Files:**
- Create: `app/trades/new/index.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
// app/trades/new/index.tsx
import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useFriends } from "@/hooks/useFriends";
import { useMatches } from "@/hooks/useMatches";
import { useTheme } from "@/theme/ThemeProvider";

export default function NewTradeStep1() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: friends } = useFriends();
  const { summary } = useMatches();
  const matchMap = useMemo(
    () => new Map(summary.map((s) => [s.friendId, s.matchCount])),
    [summary]
  );

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = friends ?? [];
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return list;
    return list.filter(
      (f) =>
        f.username.toLowerCase().includes(trimmed) ||
        (f.displayName ?? "").toLowerCase().includes(trimmed)
    );
  }, [friends, q]);

  return (
    <ThemedBackground>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center mb-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12
            }}
          >
            <Text style={{ color: theme.text, fontSize: 18 }}>‹</Text>
          </Pressable>
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800", flex: 1 }}>
            Nuevo trueque
          </Text>
          <Text style={{ color: theme.textMute, fontSize: 12 }}>1 / 2</Text>
        </View>

        <Text style={{ color: theme.textMute, fontSize: 13, marginBottom: 12 }}>
          ¿Con quién querés intercambiar?
        </Text>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar amigo…"
          placeholderTextColor={theme.textMute}
          autoCorrect={false}
          autoCapitalize="none"
          style={{
            backgroundColor: theme.card,
            color: theme.text,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            marginBottom: 16
          }}
        />

        <Text style={{ color: theme.textMute, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginBottom: 8 }}>
          ALGUIEN NUEVO
        </Text>
        <Pressable
          onPress={() => router.push("/add-friend/scan" as never)}
          accessibilityRole="button"
          accessibilityLabel="Escanear código de amigo"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderWidth: 1,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            marginBottom: 8
          }}
        >
          <Text style={{ color: theme.text, fontWeight: "600" }}>📷  Escanear código</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/add-friend/search" as never)}
          accessibilityRole="button"
          accessibilityLabel="Buscar por username"
          style={{
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderWidth: 1,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            marginBottom: 16
          }}
        >
          <Text style={{ color: theme.text, fontWeight: "600" }}>⌕  Buscar por @username</Text>
        </Pressable>

        <Text style={{ color: theme.textMute, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginBottom: 8 }}>
          MIS AMIGOS
        </Text>
        {filtered.length === 0 ? (
          <Text style={{ color: theme.textMute, fontSize: 13, marginTop: 12, textAlign: "center" }}>
            {q.trim().length > 0
              ? `Sin amigos que matcheen "${q}". Probá scan o buscar @.`
              : "Todavía no tenés amigos. Agregalo desde Escanear o Buscar."}
          </Text>
        ) : (
          filtered.map((f) => {
            const count = matchMap.get(f.id) ?? 0;
            return (
              <Pressable
                key={f.id}
                onPress={() => router.push(`/trades/propose/${f.username}` as never)}
                accessibilityRole="button"
                accessibilityLabel={`Proponer trueque a @${f.username}`}
              >
                <GlowCard className="mb-2">
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: "700" }}>
                    @{f.username}
                  </Text>
                  {count > 0 && (
                    <Text style={{ color: theme.accent, fontSize: 12, marginTop: 2 }}>
                      {count} match{count === 1 ? "" : "es"}
                    </Text>
                  )}
                </GlowCard>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </ThemedBackground>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/trades/new/index.tsx
git commit -m "$(cat <<'EOF'
feat(trades): wizard step 1 — elegir persona

Pantalla /trades/new que el FAB de Trueques abre. Muestra buscador
para filtrar amigos, dos accesos directos "Escanear" / "Buscar por @"
para casos de alguien-nuevo, y la lista de amigos abajo con cantidad
de matches. Tap en amigo → /trades/propose/[username] (step 2).
EOF
)"
```

---

## Task 11: `propose/[username].tsx` adaptado al combo

**Files:**
- Modify: `app/trades/propose/[username].tsx`

- [ ] **Step 1: Detectar si el destinatario es amigo aceptado**

Leer el archivo y buscar el `useEffect` que hidrata `bidi` (línea aprox. 33). El componente ya recibe el username y resuelve `friend` desde `useFriends`. Si el destinatario es accesible vía amistad aceptada, está en `friends`. Si NO está, es un combo.

Cambiar la lógica para soportar el caso "no es amigo todavía":

```tsx
// Justo después de obtener `friend` (línea ~22):
const isExistingFriend = !!friend; // si está en useFriends y status accepted
```

Para los casos en que `friend === undefined`, también necesitamos resolver el `id` del recipient. Esto requiere fetching del profile por username. Agregar un fallback:

```tsx
const [resolvedRecipient, setResolvedRecipient] = useState<{ id: string; username: string } | null>(null);

useEffect(() => {
  if (friend) {
    setResolvedRecipient({ id: friend.id, username: friend.username });
    return;
  }
  if (!username) return;
  let cancelled = false;
  (async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("username", username)
      .maybeSingle();
    if (cancelled || error || !data) return;
    setResolvedRecipient({ id: data.id, username: data.username });
  })();
  return () => { cancelled = true; };
}, [friend, username]);
```

- [ ] **Step 2: Mostrar banner combo cuando NO es amigo**

Justo antes del `</ScrollView>` (línea aprox. 199) y dentro del contenido (después del header), insertar:

```tsx
{!isExistingFriend && resolvedRecipient && (
  <View
    style={{
      backgroundColor: theme.card,
      borderColor: theme.accent,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12
    }}
  >
    <Text style={{ color: theme.text, fontSize: 13, fontWeight: "700", marginBottom: 4 }}>
      🔄  Solicitud de amistad incluida
    </Text>
    <Text style={{ color: theme.textMute, fontSize: 12 }}>
      Al enviar, también se manda solicitud de amistad a @{resolvedRecipient.username}.
      Solo van a poder concretar el trueque si acepta.
    </Text>
  </View>
)}
```

- [ ] **Step 3: Ajustar el `onSubmit` para llamar al hook con el recipientId resuelto**

El hook `useProposeTrade` ya selecciona internamente entre `insert` y `combo` via `pickProposeRpc`. Solo asegurarse de pasar el `recipientId` del `resolvedRecipient` (no del `friend`):

```tsx
const onSubmit = () => {
  if (!resolvedRecipient) return;
  propose.mutate({
    recipientId: resolvedRecipient.id,
    proposerGives: Array.from(givesSet),
    proposerGets: Array.from(getsSet),
    message: message.trim() || undefined
  }, {
    onSuccess: () => {
      showSnackbar(isExistingFriend ? "Trueque enviado" : "Trueque + solicitud enviados");
      router.back();
      router.back(); // si venimos del wizard, volver hasta Trueques
    },
    onError: (e) => {
      const msg = (e as Error).message;
      const human =
        msg.includes("friendship_blocked") ? "No podés contactar a esta persona."
        : msg.includes("cannot_trade_with_self") ? "No podés intercambiar contigo mismo."
        : msg;
      Alert.alert("No se pudo enviar", human);
    }
  });
};
```

- [ ] **Step 4: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/trades/propose/\[username\].tsx
git commit -m "$(cat <<'EOF'
feat(trades): pantalla propose soporta destinatario no-amigo (combo)

Si el username del destinatario no está en useFriends, resuelve el id
via profiles y muestra banner "Solicitud de amistad incluida".
El hook useProposeTrade selecciona internamente entre INSERT directo
y RPC combo. Después de enviar, doble back para volver a Trueques.
EOF
)"
```

---

## Task 12: SOLICITUDES badge "🔄 trueque pendiente"

**Files:**
- Modify: `app/(tabs)/friends.tsx`

- [ ] **Step 1: Modificar el `incoming.data!.map` en `AmigosView` para mostrar el badge**

Buscar el bloque que renderiza solicitudes entrantes (línea aprox. 111). El `r` viene de `usePendingRequests`. Necesitamos saber `r.source` y si hay un trade pendiente del proposer al recipient (yo).

Actualmente `PendingRequest` ya tiene `source`. Verificar la shape leyendo `src/social/friendships.ts`. Si no expone `source`, agregar el campo al SELECT y al type.

Agregar dentro del `<GlowCard>` de cada solicitud entrante, justo después del `<Text>` con el username:

```tsx
{r.source === "trade_combo" && (
  <View
    style={{
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderColor: theme.accent,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      marginTop: 4
    }}
  >
    <Text style={{ color: theme.accent, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 }}>
      🔄 TRUEQUE PENDIENTE
    </Text>
  </View>
)}
```

- [ ] **Step 2: Verificar que `PendingRequest.source` está expuesto**

`PendingRequest` ya tiene `source: FriendshipSource` en `src/domain/types.ts`. Confirmar que `fetchPendingRequests` en `src/social/friendships.ts` lo seleccione del SELECT y lo mapee al objeto que devuelve. Si no lo hace, sumar `source` a la columna del SELECT y al mapping. Ejemplo del cambio si falta:

```ts
.select(`requester_id, source, message, created_at, profiles:requester_id(username, display_name, city_label)`)
// ...
return {
  requesterId: row.requester_id,
  username: row.profiles.username,
  displayName: row.profiles.display_name,
  cityLabel: row.profiles.city_label,
  message: row.message,
  source: row.source as FriendshipSource,
  createdAt: Date.parse(row.created_at)
};
```

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/friends.tsx src/social/friendships.ts src/domain/types.ts
git commit -m "$(cat <<'EOF'
feat(friends): badge "🔄 TRUEQUE PENDIENTE" en solicitudes combo

Cuando una solicitud entrante tiene source = 'trade_combo', muestra un
pill chip arriba con el flag para que el recipient sepa que también hay
un trueque adjunto. La aceptación de la amistad se decide por separado
del trueque (spec Q6 C).
EOF
)"
```

---

## Task 13: TradeCard "esperando amistad"

**Files:**
- Modify: `app/(tabs)/friends.tsx`

- [ ] **Step 1: Recibir la info de friendship dentro de `TradeCard`**

`TradeCard` recibe `trade` + `meId` + `counterpartyUsername` (línea aprox. 331). Sumar `counterpartyFriendshipStatus` como prop:

```tsx
function TradeCard({
  trade,
  meId,
  counterpartyUsername,
  counterpartyFriendshipStatus
}: {
  trade: Trade;
  meId: string;
  counterpartyUsername: string;
  counterpartyFriendshipStatus: "pending" | "accepted" | "blocked" | "rejected" | null;
}) {
```

- [ ] **Step 2: En `TruequesView`, pasar el status**

Donde `TradeCard` se renderiza (línea aprox. 316), calcular el status desde `useFriends` (que ya está cargado):

```tsx
const friendsRaw = useFriends().data ?? [];
// `useFriends` solo devuelve aceptados; para pending necesitamos otra fuente.
// Usar `useOutgoingRequests` para el caso "soy proposer" y `usePendingRequests`
// para el caso "soy recipient":
const outgoingMap = new Map(
  (useOutgoingRequests().data ?? []).map((r) => [r.recipientId, r.status])
);
const incomingMap = new Map(
  (usePendingRequests().data ?? []).map((r) => [r.requesterId, "pending"] as const)
);

// ...
{trades.map((trade) => {
  const counterpartyId = trade.proposerId === user.id ? trade.recipientId : trade.proposerId;
  const isFriend = friendsRaw.some((f) => f.id === counterpartyId);
  const status: "pending" | "accepted" | "blocked" | "rejected" | null =
    isFriend ? "accepted"
    : outgoingMap.get(counterpartyId) ?? incomingMap.get(counterpartyId) ?? null;

  return (
    <TradeCard
      key={trade.id}
      trade={trade}
      meId={user.id}
      counterpartyUsername={...}
      counterpartyFriendshipStatus={status}
    />
  );
})}
```

- [ ] **Step 3: En `TradeCard`, deshabilitar acciones si la amistad está pending**

Adentro de `TradeCard`, justo arriba de `{trade.status === "pending" && iAmProposer && ...}`, agregar:

```tsx
const waitingForFriendship = counterpartyFriendshipStatus === "pending";
const disclaimer = iAmProposer
  ? `⏳ Esperando que @${counterpartyUsername} acepte la solicitud de amistad`
  : `⏳ Aceptá la amistad de @${counterpartyUsername} para responder este trueque`;

// Y al final del bloque que muestra "Le diste / Te dio":
{waitingForFriendship && (
  <View
    style={{
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: 8
    }}
  >
    <Text style={{ color: theme.textMute, fontSize: 12 }}>{disclaimer}</Text>
  </View>
)}
```

Luego, para los botones de accept/reject del recipient, envolver el bloque con `{!waitingForFriendship && ...}` (mismo para los botones del proposer, ya que cancelar el trade sin cancelar la amistad sería raro en este estado):

```tsx
{trade.status === "pending" && iAmProposer && !waitingForFriendship && (
  // ... bloque existing con [Cancelar]
)}

{trade.status === "pending" && !iAmProposer && !waitingForFriendship && (
  // ... bloque existing con [Aceptar] [Rechazar]
)}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/friends.tsx
git commit -m "$(cat <<'EOF'
feat(trades): TradeCard muestra "esperando amistad" cuando aplica

Si el trade está pending y la amistad con la contraparte sigue pending,
la card muestra un disclaimer y los botones Aceptar/Rechazar se ocultan
hasta que la amistad se resuelva. Coherente con Q6 C: la aceptación
del trade es decisión separada que solo se desbloquea con la amistad.
EOF
)"
```

---

## Task 14: Smoke test manual

**Files:** (verificación en device, no toca código)

- [ ] **Step 1: Reload app y verificar Perfil limpio**

```bash
adb shell am broadcast -a com.facebook.react.intent.action.RELOAD
```

Abrir Perfil. Verificar que NO aparece QR ni códigos ni botones de escanear/buscar. Solo: avatar, apariencia, editar, acerca, cerrar sesión, borrar cuenta.

- [ ] **Step 2: Verificar chips en sub-tab Amigos**

Ir a Amigos → sub-tab "Amigos". Verificar que arriba aparecen dos chips: "MI CÓDIGO · ABC-123 📤" + "+ Agregar".
- Tap en MI CÓDIGO (no en 📤) → modal con QR + copiar/compartir.
- Tap en 📤 → Share API directo.
- Tap en "+ Agregar" → bottom sheet con Escanear / Buscar.

- [ ] **Step 3: Verificar FAB en sub-tab Trueques**

Ir a sub-tab "Trueques". Verificar FAB azul/accent grande abajo a la derecha. Cambiar a sub-tab "Amigos" o "Cerca" → el FAB desaparece. Volver a "Trueques" → reaparece.

- [ ] **Step 4: Wizard step 1**

Tap FAB. Verificar pantalla "/trades/new" con header "Nuevo trueque · 1/2", buscador, sección "ALGUIEN NUEVO" con Escanear/Buscar, y sección "MIS AMIGOS" con la lista actual.

- [ ] **Step 5: Trueque con amigo existente**

Desde el wizard, tap un amigo de la lista → llega a `/trades/propose/[username]`. NO debería aparecer el banner "🔄 Solicitud de amistad incluida". Seleccionar stickers a dar/pedir → Enviar. Verificar que el snackbar dice "Trueque enviado" y volvés a Trueques (doble back).

- [ ] **Step 6: Trueque combo con desconocido**

Desde el wizard, tap "Buscar por @". Tipear el username de otro user (idealmente otro device/cuenta). Aceptar. Llegás a `/trades/propose/[ese-username]`. Verificar que aparece el banner "🔄 Solicitud de amistad incluida". Seleccionar stickers → Enviar. Verificar snackbar "Trueque + solicitud enviados".

- [ ] **Step 7: Lado del recipient (otro device/cuenta)**

En el segundo device, refrescar Amigos sub-tab "Amigos". Verificar que la solicitud entrante muestra badge "🔄 TRUEQUE PENDIENTE". Sub-tab Trueques debería mostrar el trade en "Pendientes" con disclaimer "⏳ Esperando que @<proposer> acepte la solicitud de amistad" (espera, ese disclaimer es del lado proposer; del recipient debería ser "⏳ Aceptá la amistad para responder este trueque" — corregir wording si es necesario en Task 13).

- [ ] **Step 8: Aceptar amistad combo**

En el recipient, tap "Aceptar" en la solicitud. Verificar que pasa a Mis Amigos y que el trueque en Pendientes ahora habilita los botones [Aceptar] [Rechazar].

- [ ] **Step 9: Rechazar amistad combo**

Reset: enviar otro trade combo desde proposer device. En recipient, tap "Rechazar" en la solicitud. Verificar que el trueque también desaparece de Pendientes (status cancelled por el trigger).

- [ ] **Step 10: Cancelar combo desde proposer**

Enviar otro trade combo. En proposer device, ir a Amigos sub-tab "Amigos", scrollear a "SOLICITUDES" outgoing, tap "Cancelar". Verificar que el trade asociado en sub-tab Trueques también pasó a cancelled.

---

## Notas de implementación

- El wording exacto del disclaimer en Task 13 puede necesitar ajuste según lado (proposer vs recipient). Verificar en Step 7-8 del smoke test y ajustar si confunde.
- Si al aplicar la migración el `alter type` falla porque Postgres no permite usar el nuevo enum value en la misma transacción, separar en dos migraciones: `20260514000000_friendship_trade_combo_enum.sql` (solo `alter type`) y `20260514000001_friendship_trade_combo_rpc.sql` (RPC + trigger).
- Si `findFriendshipStatusByUserId` (Task 4 Step 3) tiene problemas con el filtro `or(and(...),and(...))` de PostgREST, hacer dos queries en paralelo y mergear el resultado (a lo sumo una de las dos devuelve fila).
- El `Share.share` de RN puede comportarse distinto en iOS vs Android — verificar en ambos antes de declarar terminado.
- Si al hacer doble `router.back()` en Task 11 termina fuera del tab, cambiar a `router.dismissTo("/(tabs)/friends" as never)`.

## Out of scope (recordatorio del spec)

- Sub-tab Cerca sin cambios.
- Trueques sin amistad obligatoria.
- Push notifications.
- Aceptación atómica amistad+trueque.
- Wording change "trueque" → "cambio".
