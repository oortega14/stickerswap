# P3 — Compartir lista · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la tab "Cambios" en una pantalla real con sub-tab "Mi lista" que genera texto compartible al share sheet del OS, y la tab Profile real con avatar/username/log out.

**Architecture:** Generador puro de TradeList sobre el estado local + sub-tab UI con segmented control + integración con `expo-sharing`. Profile pasa de placeholder a pantalla con datos del session/profile.

**Tech Stack:** Expo SDK 53, expo-sharing, expo-clipboard, Zustand, TanStack Query (todos ya instalados en P1/P2).

**Spec referenciada:** `docs/superpowers/specs/2026-04-28-panini-album-design.md` — sección 8 (Listas de cambios y matches — Mi lista).

**Precondiciones (estado del repo al empezar P3):**
- P1 + P2 mergeados.
- Auth + onboarding funcional (Apple/Google + username).
- Hook `useSession` con `{ session, user, isLoading }`.
- Cliente Supabase con SecureStore.
- Sync worker activo (sticker_status sincroniza entre dispositivos).
- Tab Trades y Profile son placeholders.

**Lo que NO se construye en P3 (queda para P4/P5):**
- Sub-tab "Matches con amigos" — placeholder explícito ("Llega en P4").
- QR / invite_code en Profile — P4.
- Búsqueda de amigos — P4.
- Animaciones avanzadas / pulido visual — P5.

---

## Estructura de archivos a crear/modificar

```
panini-album/
├── src/
│   ├── domain/
│   │   ├── types.ts                  # MODIFY: agregar TradeList, TradeListEntry
│   │   └── tradeList.ts              # CREATE: generador puro + formatter
│   ├── hooks/
│   │   └── useMyList.ts              # CREATE: hook que junta data + format
│   ├── store/
│   │   └── tradePreferences.ts       # CREATE: toggles persistidos
│   └── ui/
│       └── SegmentedControl.tsx      # CREATE: componente reusable
│
├── app/
│   ├── (tabs)/
│   │   ├── trades.tsx                # MODIFY: sub-tabs reales
│   │   └── profile.tsx               # MODIFY: pantalla real
│   └── profile/
│       └── edit.tsx                  # CREATE: modal editar display_name
│
└── tests/
    ├── domain/tradeList.test.ts
    └── store/tradePreferences.test.ts
```

---

## Task 1: Tipos del dominio

**Files:**
- Modify: `src/domain/types.ts`

- [ ] **Step 1.1: Agregar tipos al final de `src/domain/types.ts`**

```ts
export interface TradeListEntry {
  code: string;
  number: number;
  section: string;
  count: number;     // 0 si falta, >1 si es repetida
}

export interface TradeList {
  needed: TradeListEntry[];     // count = 0 — me faltan
  duplicates: TradeListEntry[]; // count > 1 — tengo repetidas (extras = count - 1)
}

export interface TradeFormatOptions {
  groupBySection: boolean;
  username: string;
}
```

- [ ] **Step 1.2: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(domain): add TradeList types"
```

---

## Task 2: Generador puro de TradeList (TDD)

**Files:**
- Create: `src/domain/tradeList.ts`, `tests/domain/tradeList.test.ts`

- [ ] **Step 2.1: Escribir test fallido**

Crear `tests/domain/tradeList.test.ts`:

```ts
import { buildTradeList, formatTradeListAsText } from "@/domain/tradeList";
import type { Sticker, StickerStatus } from "@/domain/types";

const stickers: Sticker[] = [
  { code: "ARG-1", number: 100, name: "Crest", team: "ARG", section: "Argentina", type: "team_badge" },
  { code: "ARG-2", number: 101, name: "Messi", team: "ARG", section: "Argentina", type: "player" },
  { code: "ARG-3", number: 102, name: "De Paul", team: "ARG", section: "Argentina", type: "player" },
  { code: "BRA-1", number: 110, name: "Crest", team: "BRA", section: "Brasil", type: "team_badge" },
  { code: "STAD-1", number: 5, name: "Azteca", team: null, section: "Estadios", type: "stadium" }
];

describe("buildTradeList", () => {
  it("returns empty arrays when nothing collected", () => {
    const r = buildTradeList(stickers, []);
    expect(r.needed).toHaveLength(5);
    expect(r.duplicates).toHaveLength(0);
  });

  it("classifies as duplicates when count > 1", () => {
    const statuses: StickerStatus[] = [
      { stickerCode: "ARG-1", count: 2, updatedAt: 1 },
      { stickerCode: "ARG-2", count: 1, updatedAt: 1 }
    ];
    const r = buildTradeList(stickers, statuses);
    expect(r.needed.map((e) => e.code).sort()).toEqual(["ARG-3", "BRA-1", "STAD-1"]);
    expect(r.duplicates.map((e) => e.code)).toEqual(["ARG-1"]);
    expect(r.duplicates[0].count).toBe(2);
  });

  it("sorts needed and duplicates by number ascending", () => {
    const r = buildTradeList(stickers, []);
    const numbers = r.needed.map((e) => e.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });
});

describe("formatTradeListAsText", () => {
  const list = {
    needed: [
      { code: "ARG-2", number: 101, section: "Argentina", count: 0 },
      { code: "ARG-3", number: 102, section: "Argentina", count: 0 },
      { code: "STAD-1", number: 5, section: "Estadios", count: 0 }
    ],
    duplicates: [
      { code: "ARG-1", number: 100, section: "Argentina", count: 3 }
    ]
  };

  it("groups by section when groupBySection=true", () => {
    const text = formatTradeListAsText(list, { groupBySection: true, username: "oscar" });
    expect(text).toContain("Panini Mundial 2026 — @oscar");
    expect(text).toContain("NECESITO (3)");
    expect(text).toMatch(/Argentina:.*101.*102/);
    expect(text).toContain("Estadios: 5");
    expect(text).toContain("TENGO REPETIDAS (1)");
    expect(text).toMatch(/Argentina: 100 \(×2\)/); // count=3 → 2 extras
  });

  it("flat list when groupBySection=false", () => {
    const text = formatTradeListAsText(list, { groupBySection: false, username: "oscar" });
    expect(text).toContain("NECESITO: 5, 101, 102");
    expect(text).toContain("TENGO REPE: 100 (×2)");
  });

  it("hides empty sections cleanly", () => {
    const empty = { needed: [], duplicates: [] };
    const text = formatTradeListAsText(empty, { groupBySection: true, username: "x" });
    expect(text).toContain("@x");
    expect(text).not.toContain("NECESITO");
    expect(text).not.toContain("TENGO REPE");
  });
});
```

- [ ] **Step 2.2: Verificar que falla**

Run:
```bash
npm test -- tradeList
```
Expected: FAIL — `Cannot find module '@/domain/tradeList'`.

- [ ] **Step 2.3: Implementar `src/domain/tradeList.ts`**

```ts
import type { Sticker, StickerStatus, TradeList, TradeListEntry, TradeFormatOptions } from "./types";

export function buildTradeList(stickers: Sticker[], statuses: StickerStatus[]): TradeList {
  const statusMap = new Map(statuses.map((s) => [s.stickerCode, s.count]));
  const needed: TradeListEntry[] = [];
  const duplicates: TradeListEntry[] = [];

  for (const s of stickers) {
    const count = statusMap.get(s.code) ?? 0;
    const entry: TradeListEntry = {
      code: s.code,
      number: s.number,
      section: s.section,
      count
    };
    if (count === 0) needed.push(entry);
    else if (count > 1) duplicates.push(entry);
  }

  needed.sort((a, b) => a.number - b.number);
  duplicates.sort((a, b) => a.number - b.number);
  return { needed, duplicates };
}

function groupBy<T>(items: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(it);
  }
  return m;
}

export function formatTradeListAsText(list: TradeList, opts: TradeFormatOptions): string {
  const lines: string[] = [];
  lines.push(`Panini Mundial 2026 — @${opts.username}`);
  lines.push("");

  if (list.needed.length > 0) {
    lines.push(`NECESITO (${list.needed.length}):`);
    if (opts.groupBySection) {
      const grouped = groupBy(list.needed, (e) => e.section);
      const sections = Array.from(grouped.keys()).sort();
      for (const sec of sections) {
        const nums = grouped.get(sec)!.map((e) => e.number).join(", ");
        lines.push(`• ${sec}: ${nums}`);
      }
    } else {
      const flat = list.needed.map((e) => e.number).join(", ");
      lines[lines.length - 1] = `NECESITO: ${flat}`;
    }
    lines.push("");
  }

  if (list.duplicates.length > 0) {
    lines.push(`TENGO REPETIDAS (${list.duplicates.length}):`);
    if (opts.groupBySection) {
      const grouped = groupBy(list.duplicates, (e) => e.section);
      const sections = Array.from(grouped.keys()).sort();
      for (const sec of sections) {
        const items = grouped
          .get(sec)!
          .map((e) => `${e.number} (×${e.count - 1})`)
          .join(", ");
        lines.push(`• ${sec}: ${items}`);
      }
    } else {
      const flat = list.duplicates.map((e) => `${e.number} (×${e.count - 1})`).join(", ");
      lines[lines.length - 1] = `TENGO REPE: ${flat}`;
    }
    lines.push("");
  }

  if (list.needed.length > 0 || list.duplicates.length > 0) {
    lines.push("Coordinemos por acá 👋");
  }

  return lines.join("\n").trim();
}
```

- [ ] **Step 2.4: Verificar que pasa**

Run:
```bash
npm test -- tradeList
```
Expected: PASS, 6 tests.

- [ ] **Step 2.5: Commit**

```bash
git add src/domain/tradeList.ts tests/domain/tradeList.test.ts
git commit -m "feat(domain): pure trade list builder and text formatter"
```

---

## Task 3: Store de preferencias de formato

**Files:**
- Create: `src/store/tradePreferences.ts`, `tests/store/tradePreferences.test.ts`

- [ ] **Step 3.1: Escribir test fallido**

Crear `tests/store/tradePreferences.test.ts`:

```ts
import { useTradePrefs } from "@/store/tradePreferences";
import { act } from "@testing-library/react-native";

describe("useTradePrefs", () => {
  it("defaults to groupBySection=true", () => {
    expect(useTradePrefs.getState().groupBySection).toBe(true);
  });

  it("toggles", () => {
    act(() => useTradePrefs.getState().setGroupBySection(false));
    expect(useTradePrefs.getState().groupBySection).toBe(false);
    act(() => useTradePrefs.getState().setGroupBySection(true));
    expect(useTradePrefs.getState().groupBySection).toBe(true);
  });
});
```

- [ ] **Step 3.2: Verificar que falla**

Run:
```bash
npm test -- tradePreferences
```
Expected: FAIL — módulo no existe.

- [ ] **Step 3.3: Implementar `src/store/tradePreferences.ts`**

```ts
import { create } from "zustand";

interface TradePrefsState {
  groupBySection: boolean;
  setGroupBySection: (v: boolean) => void;
}

export const useTradePrefs = create<TradePrefsState>((set) => ({
  groupBySection: true,
  setGroupBySection: (groupBySection) => set({ groupBySection })
}));
```

- [ ] **Step 3.4: Verificar que pasa**

Run:
```bash
npm test -- tradePreferences
```
Expected: PASS, 2 tests.

- [ ] **Step 3.5: Commit**

```bash
git add src/store/tradePreferences.ts tests/store/tradePreferences.test.ts
git commit -m "feat(store): trade list formatting preferences"
```

---

## Task 4: Hook `useMyList`

**Files:**
- Create: `src/hooks/useMyList.ts`

- [ ] **Step 4.1: Crear `src/hooks/useMyList.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { getAllStickers } from "@/data/stickers";
import { listStatuses } from "@/data/stickerStatus";
import { buildTradeList, formatTradeListAsText } from "@/domain/tradeList";
import { useSession } from "@/auth/useSession";
import { useTradePrefs } from "@/store/tradePreferences";

export function useMyList() {
  const session = useSession();
  const { groupBySection } = useTradePrefs();
  const username = session.user?.username ?? "yo";

  const query = useQuery({
    queryKey: ["myList"],
    queryFn: async () => {
      const [stickers, statuses] = await Promise.all([getAllStickers(), listStatuses()]);
      return buildTradeList(stickers, statuses);
    }
  });

  const text = query.data
    ? formatTradeListAsText(query.data, { groupBySection, username })
    : "";

  return { ...query, text };
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/hooks/useMyList.ts
git commit -m "feat(hooks): useMyList combining stickers, status, and prefs"
```

---

## Task 5: Componente SegmentedControl

**Files:**
- Create: `src/ui/SegmentedControl.tsx`

- [ ] **Step 5.1: Crear `src/ui/SegmentedControl.tsx`**

```tsx
import React from "react";
import { Pressable, Text, View } from "react-native";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row bg-space-dark rounded-lg p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`flex-1 py-2 rounded-md ${active ? "bg-space-purple" : ""}`}
          >
            <Text
              className={`text-center text-xs font-semibold ${active ? "text-white" : "text-space-mute"}`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 5.2: Commit**

```bash
git add src/ui/SegmentedControl.tsx
git commit -m "feat(ui): segmented control component"
```

---

## Task 6: Pantalla Cambios real

**Files:**
- Modify: `app/(tabs)/trades.tsx`

- [ ] **Step 6.1: Reemplazar `app/(tabs)/trades.tsx`** completo

```tsx
import { useState } from "react";
import { ScrollView, View, Text, Pressable, Switch, Alert } from "react-native";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { useMyList } from "@/hooks/useMyList";
import { useTradePrefs } from "@/store/tradePreferences";

type Tab = "matches" | "mine";

async function shareText(text: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    const path = `${FileSystem.cacheDirectory}mi-lista.txt`;
    await FileSystem.writeAsStringAsync(path, text, { encoding: "utf8" });
    await Sharing.shareAsync(path, {
      mimeType: "text/plain",
      dialogTitle: "Compartir mi lista"
    });
  } else {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copiado", "Lista copiada al portapapeles.");
  }
}

export default function Trades() {
  const [tab, setTab] = useState<Tab>("mine");
  const { data, text, isLoading } = useMyList();
  const { groupBySection, setGroupBySection } = useTradePrefs();

  return (
    <StarryBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">CAMBIOS</Text>

        <View className="mb-4">
          <SegmentedControl<Tab>
            options={[
              { value: "matches", label: "Matches" },
              { value: "mine", label: "Mi lista" }
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === "matches" ? (
          <GlowCard>
            <Text className="text-space-ink text-center text-base mb-2">🛸</Text>
            <Text className="text-space-mute text-center">
              Los matches con amigos llegan en la próxima versión.
            </Text>
          </GlowCard>
        ) : isLoading || !data ? (
          <Text className="text-space-mute text-center mt-4">Cargando…</Text>
        ) : (
          <>
            <View className="flex-row gap-3 mb-3">
              <GlowCard className="flex-1">
                <Text className="text-space-mute text-xs">NECESITO</Text>
                <Text className="text-space-ink text-2xl font-bold">{data.needed.length}</Text>
              </GlowCard>
              <GlowCard className="flex-1">
                <Text className="text-space-mute text-xs">REPETIDAS</Text>
                <Text className="text-space-ink text-2xl font-bold">{data.duplicates.length}</Text>
              </GlowCard>
            </View>

            <GlowCard className="mb-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-space-ink text-sm">Agrupar por sección</Text>
                <Switch
                  value={groupBySection}
                  onValueChange={setGroupBySection}
                  trackColor={{ false: "#1c1648", true: "#7c5cff" }}
                />
              </View>
            </GlowCard>

            <GlowCard className="mb-4">
              <Text className="text-space-mute text-xs mb-2 tracking-widest">VISTA PREVIA</Text>
              <Text className="text-space-ink text-xs" style={{ fontFamily: "Courier" }}>
                {text || "Sin contenido para compartir aún."}
              </Text>
            </GlowCard>

            <Pressable
              onPress={async () => {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await shareText(text);
              }}
              disabled={!text}
              className={`rounded-xl py-4 items-center ${text ? "bg-space-purple" : "bg-space-mid"}`}
            >
              <Text className="text-white font-semibold">Compartir mi lista</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </StarryBackground>
  );
}
```

- [ ] **Step 6.2: Instalar dependencias faltantes**

Run:
```bash
npx expo install expo-sharing expo-clipboard expo-file-system
```
Expected: instala los tres paquetes en versiones compatibles con SDK 53.

- [ ] **Step 6.3: Verificar typecheck**

Run:
```bash
npm run typecheck
```
Expected: 0 errores.

- [ ] **Step 6.4: Commit**

```bash
git add app/\(tabs\)/trades.tsx package.json package-lock.json
git commit -m "feat(trades): real screen with Mi lista sub-tab and share sheet"
```

---

## Task 7: Pantalla Profile real

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 7.1: Reemplazar `app/(tabs)/profile.tsx`** completo

```tsx
import { ScrollView, View, Text, Pressable, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useSession } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";

function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <View
      className="rounded-full items-center justify-center"
      style={{ width: 80, height: 80, backgroundColor: "#7c5cff" }}
    >
      <Text className="text-white text-2xl font-bold">{initials || "?"}</Text>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { user } = useSession();

  if (!user) return null;

  const onSignOut = () => {
    Alert.alert("Cerrar sesión", "¿Seguro que querés salir?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        }
      }
    ]);
  };

  return (
    <StarryBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">PERFIL</Text>

        <GlowCard className="items-center mb-4">
          {user.avatar_url ? (
            <Image
              source={{ uri: user.avatar_url }}
              style={{ width: 80, height: 80, borderRadius: 40 }}
            />
          ) : (
            <Initials name={user.display_name ?? user.username} />
          )}
          <Text className="text-space-ink text-lg font-bold mt-3">
            {user.display_name ?? user.username}
          </Text>
          <Text className="text-space-mute text-sm">@{user.username}</Text>
        </GlowCard>

        <Pressable
          onPress={() => router.push("/profile/edit")}
          className="bg-space-mid rounded-lg py-3 items-center mb-2"
        >
          <Text className="text-space-ink font-semibold">Editar perfil</Text>
        </Pressable>

        <Pressable
          onPress={onSignOut}
          className="bg-space-dark border border-red-400/30 rounded-lg py-3 items-center"
        >
          <Text className="text-red-300 font-semibold">Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </StarryBackground>
  );
}
```

> **Asunción:** `useSession` (de P2) expone `{ session, user, isLoading }` donde `user` incluye `username`, `display_name`, `avatar_url`. Si la forma exacta del shape difiere, ajustar las referencias antes del commit.

- [ ] **Step 7.2: Verificar typecheck**

Run:
```bash
npm run typecheck
```
Expected: 0 errores. Si hay errores por shape de `user`, ajustar a la forma real definida en P2.

- [ ] **Step 7.3: Commit**

```bash
git add app/\(tabs\)/profile.tsx
git commit -m "feat(profile): real screen with avatar, username, and sign-out"
```

---

## Task 8: Modal editar perfil

**Files:**
- Create: `app/profile/edit.tsx`

- [ ] **Step 8.1: Crear `app/profile/edit.tsx`**

```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useSession } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";
import { colors } from "@/theme/colors";

export default function EditProfile() {
  const router = useRouter();
  const { user } = useSession();
  const [name, setName] = useState(user?.display_name ?? "");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const onSave = async () => {
    if (name.trim().length < 1) {
      Alert.alert("Nombre vacío", "Poné al menos un caracter.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    router.back();
  };

  return (
    <StarryBackground>
      <View className="flex-1 px-4 pt-14">
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">EDITAR</Text>
        <GlowCard className="mb-4">
          <Text className="text-space-mute text-xs mb-1">Nombre para mostrar</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor={colors.dim}
            className="text-space-ink text-base bg-space-mid rounded-md px-3 py-2"
            maxLength={40}
          />
        </GlowCard>

        <Pressable
          onPress={onSave}
          disabled={saving}
          className="bg-space-purple rounded-xl py-4 items-center mb-2"
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Guardar</Text>
          )}
        </Pressable>
        <Pressable onPress={() => router.back()} className="py-3 items-center">
          <Text className="text-space-mute">Cancelar</Text>
        </Pressable>
      </View>
    </StarryBackground>
  );
}
```

- [ ] **Step 8.2: Registrar la ruta como modal en `app/_layout.tsx`**

En `<Stack>`, agregar al lado de `sticker/[code]`:

```tsx
<Stack.Screen name="profile/edit" options={{ presentation: "modal" }} />
```

- [ ] **Step 8.3: Verificar typecheck**

Run:
```bash
npm run typecheck
```
Expected: 0 errores.

- [ ] **Step 8.4: Commit**

```bash
git add app/profile/ app/_layout.tsx
git commit -m "feat(profile): edit display_name modal"
```

---

## Task 9: Smoke test manual

> Tarea manual sin código. Verifica end-to-end que P3 funciona.

- [ ] **Step 9.1: Levantar el dev server y abrir iOS**

Run:
```bash
npm start
```
Presionar `i`.

- [ ] **Step 9.2: Verificar Cambios**

1. Tab Cambios abre con segmented control "Matches | Mi lista". Por defecto está en "Mi lista".
2. Si tu sticker_status está vacío (cuenta nueva), ves "Necesito X · Repetidas 0" y la vista previa con el header "Panini Mundial 2026 — @<tu_username>".
3. Marcar 3 stickers en Álbum y volver a Cambios. La vista previa actualiza.
4. Tap en "Agrupar por sección" off → la vista previa cambia a formato flat ("NECESITO: 1, 2, 5").
5. Tap "Compartir" → abre share sheet del OS. Elegir Notes/Files para verificar contenido.
6. Tap en "Matches" → muestra placeholder con texto "Llega en la próxima versión".

- [ ] **Step 9.3: Verificar Profile**

1. Tab Profile muestra avatar (iniciales si no hay URL), display_name + @username.
2. "Editar perfil" abre el modal con el campo de display_name pre-poblado. Cambiar y guardar → vuelve y muestra el nuevo.
3. "Cerrar sesión" muestra alert. Cancelar mantiene la sesión. Confirmar cierra sesión y redirige a sign-in.

- [ ] **Step 9.4: Repetir en Android**

Presionar `a`. Repetir Steps 9.2 y 9.3.

- [ ] **Step 9.5: Commit (si hubo fixes)**

Si encontraste regresiones y las arreglaste:
```bash
git add .
git commit -m "fix(p3): address smoke test findings"
```

---

## Cierre del P3

Al terminar, el repo tiene:
- Tab Cambios con sub-tab "Mi lista" funcional + share sheet del OS.
- Toggle de formato (agrupado por sección o flat).
- Tab Profile con avatar, username, edit, log out.
- Tests unitarios para el generador de TradeList.

**Próximo plan:** P4 — Amigos (QR + invite_code + búsqueda por @username) + Matches con Realtime.
