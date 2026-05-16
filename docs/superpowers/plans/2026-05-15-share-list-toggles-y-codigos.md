# Share List Toggles + Códigos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cambiar el formato del texto compartido para usar `code` en vez de `number`, y agregar dos chips toggleables en `ShareListModal` que permiten incluir/excluir las secciones "Me faltan" y "Tengo repes" antes de copiar/compartir.

**Architecture:** `formatTradeListByTeam` recibe un nuevo opcional `include: { needed, duplicates }` que decide qué bloques renderizar; `formatItem` ahora emite `code` en vez de `number`. El estado de los chips vive en `ShareListModal`, que recibe `list` cruda y formatea localmente con `useMemo`. `useShareList` se simplifica a exponer solo `list`. `friends.tsx` pasa `list` + `username` al modal.

**Tech Stack:** React Native (Expo SDK 54), TypeScript strict, Jest, TanStack Query, NativeWind.

**Spec:** `docs/superpowers/specs/2026-05-15-share-list-toggles-y-codigos-design.md`

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `src/domain/tradeList.ts` | Build + formato del texto. Acepta filtro `include`. Emite items como `code`. | Modificar |
| `src/hooks/useShareList.ts` | Wrapper de TanStack Query que entrega `list` cruda. | Modificar (simplificar) |
| `src/ui/ShareListModal.tsx` | UI del modal: chips, render condicional, copiar/compartir. Computa el texto localmente. | Modificar (refactor de API + chips) |
| `app/(tabs)/friends.tsx` | Pasa `list` + `username` al modal. | Modificar (ajuste de props) |
| `tests/domain/tradeList.test.ts` | Tests del formatter y builder. Migrar a expectativas con `code` + agregar tests de `include`. | Modificar |

---

## Task 1: Formato con `code` + parámetro `include` en `formatTradeListByTeam`

**Files:**
- Modify: `src/domain/tradeList.ts:30-94`
- Test: `tests/domain/tradeList.test.ts`

Migramos los tests existentes a expectativas con `code`, agregamos tests para `include`, después implementamos el cambio.

- [ ] **Step 1.1: Actualizar tests existentes para esperar `code` en vez de `number`**

Reemplazar el contenido del bloque `describe("formatTradeListByTeam", ...)` en `tests/domain/tradeList.test.ts` (líneas 42-121). El bloque `describe("buildTradeList", ...)` (líneas 13-39) no se toca.

Nuevo contenido del `describe("formatTradeListByTeam", ...)`:

```ts
describe("formatTradeListByTeam", () => {
  it("devuelve mensaje de álbum completo cuando no hay faltantes ni repes", () => {
    const text = formatTradeListByTeam(
      { needed: [], duplicates: [] },
      { username: "oscar" }
    );
    expect(text).toBe("Tu álbum está completo 🎉");
  });

  it("devuelve mensaje de álbum completo aunque include esté en false", () => {
    const text = formatTradeListByTeam(
      { needed: [], duplicates: [] },
      { username: "oscar", include: { needed: false, duplicates: false } }
    );
    expect(text).toBe("Tu álbum está completo 🎉");
  });

  const sample: TradeList = {
    needed: [
      { code: "KOR-5", number: 5, section: "Corea del Sur", team: "KOR", count: 0 },
      { code: "KOR-11", number: 11, section: "Corea del Sur", team: "KOR", count: 0 },
      { code: "FRA-3", number: 3, section: "Francia", team: "FRA", count: 0 },
      { code: "FRA-8", number: 8, section: "Francia", team: "FRA", count: 0 },
      { code: "FRA-12", number: 12, section: "Francia", team: "FRA", count: 0 },
      { code: "CZE-8", number: 8, section: "República Checa", team: "CZE", count: 0 },
      { code: "INTRO-2", number: 2, section: "Intro", team: null, count: 0 },
      { code: "INTRO-5", number: 5, section: "Intro", team: null, count: 0 },
      { code: "CC-4", number: 4, section: "Coca-Cola", team: null, count: 0 }
    ],
    duplicates: []
  };

  it("incluye header con app y handle cuando hay username", () => {
    const text = formatTradeListByTeam(sample, { username: "oscar" });
    expect(text.startsWith("stickerSwap · Mundial 2026 — @oscar\n")).toBe(true);
  });

  it("formatea faltantes con código por equipo en orden alfabético + sections sin equipo", () => {
    const text = formatTradeListByTeam(sample, { username: "oscar" });
    const expected = [
      "stickerSwap · Mundial 2026 — @oscar",
      "",
      "Me faltan*",
      "CZE 🇨🇿: CZE-8",
      "FRA 🇫🇷: FRA-3, FRA-8, FRA-12",
      "KOR 🇰🇷: KOR-5, KOR-11",
      "Intro: INTRO-2, INTRO-5",
      "Coca-Cola: CC-4"
    ].join("\n");
    expect(text).toBe(expected);
  });

  it("incluye bloque de repes con código + ×N (incluso ×1)", () => {
    const list: TradeList = {
      needed: [
        { code: "KOR-5", number: 5, section: "Corea del Sur", team: "KOR", count: 0 }
      ],
      duplicates: [
        { code: "ARG-6", number: 6, section: "Argentina", team: "ARG", count: 3 },
        { code: "ESP-9", number: 9, section: "España", team: "ESP", count: 2 },
        { code: "ESP-14", number: 14, section: "España", team: "ESP", count: 4 }
      ]
    };
    const text = formatTradeListByTeam(list, { username: "oscar" });
    const expected = [
      "stickerSwap · Mundial 2026 — @oscar",
      "",
      "Me faltan*",
      "KOR 🇰🇷: KOR-5",
      "",
      "Tengo repes*",
      "ARG 🇦🇷: ARG-6 ×2",
      "ESP 🇪🇸: ESP-9 ×1, ESP-14 ×3"
    ].join("\n");
    expect(text).toBe(expected);
  });

  it("omite handle cuando username es null", () => {
    const list: TradeList = {
      needed: [{ code: "KOR-5", number: 5, section: "Corea del Sur", team: "KOR", count: 0 }],
      duplicates: []
    };
    const text = formatTradeListByTeam(list, { username: null });
    expect(text.startsWith("stickerSwap · Mundial 2026\n")).toBe(true);
    expect(text).not.toContain("—");
    expect(text).not.toContain("@");
  });

  it("omite bloque 'Me faltan' cuando include.needed === false", () => {
    const list: TradeList = {
      needed: [
        { code: "KOR-5", number: 5, section: "Corea del Sur", team: "KOR", count: 0 }
      ],
      duplicates: [
        { code: "ARG-6", number: 6, section: "Argentina", team: "ARG", count: 2 }
      ]
    };
    const text = formatTradeListByTeam(list, {
      username: "oscar",
      include: { needed: false, duplicates: true }
    });
    expect(text).not.toContain("Me faltan*");
    expect(text).not.toContain("KOR");
    expect(text).toContain("Tengo repes*");
    expect(text).toContain("ARG 🇦🇷: ARG-6 ×1");
  });

  it("omite bloque 'Tengo repes' cuando include.duplicates === false", () => {
    const list: TradeList = {
      needed: [
        { code: "KOR-5", number: 5, section: "Corea del Sur", team: "KOR", count: 0 }
      ],
      duplicates: [
        { code: "ARG-6", number: 6, section: "Argentina", team: "ARG", count: 2 }
      ]
    };
    const text = formatTradeListByTeam(list, {
      username: "oscar",
      include: { needed: true, duplicates: false }
    });
    expect(text).toContain("Me faltan*");
    expect(text).toContain("KOR 🇰🇷: KOR-5");
    expect(text).not.toContain("Tengo repes*");
    expect(text).not.toContain("ARG");
  });

  it("retorna string vacío cuando include excluye todo pero la lista no está vacía", () => {
    const list: TradeList = {
      needed: [
        { code: "KOR-5", number: 5, section: "Corea del Sur", team: "KOR", count: 0 }
      ],
      duplicates: [
        { code: "ARG-6", number: 6, section: "Argentina", team: "ARG", count: 2 }
      ]
    };
    const text = formatTradeListByTeam(list, {
      username: "oscar",
      include: { needed: false, duplicates: false }
    });
    expect(text).toBe("");
  });
});
```

- [ ] **Step 1.2: Correr tests para verificar que fallan**

```bash
pnpm test -- tradeList
```

Expected: tests del describe `formatTradeListByTeam` FAIL — los existentes porque ahora esperan `code` y la implementación sigue emitiendo `number`; los nuevos fallan porque `include` no existe aún. Los del `buildTradeList` siguen pasando.

- [ ] **Step 1.3: Implementar cambios en `src/domain/tradeList.ts`**

Reemplazar las funciones `formatTradeListByTeam` y `formatItem` (no tocar `buildTradeList`, `renderBlock`, ni `NON_TEAM_SECTION_ORDER`).

```ts
export function formatTradeListByTeam(
  list: TradeList,
  opts: {
    username: string | null;
    include?: { needed?: boolean; duplicates?: boolean };
  }
): string {
  if (list.needed.length === 0 && list.duplicates.length === 0) {
    return "Tu álbum está completo 🎉";
  }
  const includeNeeded = opts.include?.needed ?? true;
  const includeDuplicates = opts.include?.duplicates ?? true;
  if (!includeNeeded && !includeDuplicates) return "";

  const header = opts.username
    ? `stickerSwap · Mundial 2026 — @${opts.username}`
    : "stickerSwap · Mundial 2026";
  const lines: string[] = [header, ""];

  const renderedNeeded = includeNeeded && list.needed.length > 0;
  const renderedDuplicates = includeDuplicates && list.duplicates.length > 0;

  if (renderedNeeded) {
    lines.push("Me faltan*");
    lines.push(...renderBlock(list.needed, "needed"));
  }
  if (renderedDuplicates) {
    if (renderedNeeded) lines.push("");
    lines.push("Tengo repes*");
    lines.push(...renderBlock(list.duplicates, "duplicates"));
  }
  return lines.join("\n").trim();
}

function formatItem(e: TradeListEntry, mode: "needed" | "duplicates"): string {
  if (mode === "needed") return e.code;
  const extras = e.count - 1;
  return `${e.code} ×${extras}`;
}
```

- [ ] **Step 1.4: Correr tests para verificar que pasan**

```bash
pnpm test -- tradeList
```

Expected: PASS — todos los tests de `tradeList` (los del describe `buildTradeList` y los del describe `formatTradeListByTeam`, incluidos los 3 nuevos).

- [ ] **Step 1.5: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: sin errores. (Si aparecen errores en consumers — `useShareList.ts` o `ShareListModal.tsx` —, dejarlos para las tasks 2-4.)

Si el typecheck falla solo en archivos que vamos a tocar en tasks siguientes, está OK seguir. Si falla en algún otro lado, investigar.

- [ ] **Step 1.6: Commit**

```bash
git add src/domain/tradeList.ts tests/domain/tradeList.test.ts
git commit -m "$(cat <<'EOF'
feat(tradeList): formato con código + parámetro include para filtrar bloques

formatItem ahora emite e.code (ARG-1) en vez de e.number (1), eliminando
ambigüedad cuando el texto se copia fuera de contexto. formatTradeListByTeam
acepta opts.include = { needed?, duplicates? } para omitir bloques; ambos
default true (back-compat). Si include excluye todo y la lista no está vacía,
retorna string vacío; el caso "álbum completo" sigue priorizando sobre include.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Simplificar `useShareList` para exponer `list` cruda

**Files:**
- Modify: `src/hooks/useShareList.ts` (rewrite)

El hook ahora devuelve solo `list` (`TradeList | null`) y las flags de query. El formateo se mueve al modal.

- [ ] **Step 2.1: Reemplazar contenido de `src/hooks/useShareList.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { getAllStickers } from "@/data/stickers";
import { listStatuses } from "@/data/stickerStatus";
import { buildTradeList } from "@/domain/tradeList";

export function useShareList() {
  const query = useQuery({
    queryKey: ["shareList"],
    queryFn: async () => {
      const [stickers, statuses] = await Promise.all([getAllStickers(), listStatuses()]);
      return buildTradeList(stickers, statuses);
    }
  });
  return { ...query, list: query.data ?? null };
}
```

Cambios respecto al original:
- Se elimina el import de `formatTradeListByTeam`.
- Se elimina el import de `useSession`.
- Se elimina el cálculo y export de `text`.
- Se agrega `list` derivado de `query.data`.

- [ ] **Step 2.2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: errores en `app/(tabs)/friends.tsx` (usa `const { text: shareText } = useShareList();`). Está OK — lo arreglamos en Task 4. Si hay errores en otro archivo, investigar.

- [ ] **Step 2.3: Commit**

```bash
git add src/hooks/useShareList.ts
git commit -m "$(cat <<'EOF'
refactor(useShareList): exponer list cruda en vez de text formateado

El formateo a string se mueve al componente consumer (ShareListModal),
que necesita re-formatear según el estado de los chips de toggle. El hook
queda como wrapper simple de la query.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `ShareListModal` recibe `list` + chips toggleables + cómputo local del texto

**Files:**
- Modify: `src/ui/ShareListModal.tsx` (rewrite completo)

Refactor del modal: nueva API de props, estado de chips, useMemo del texto, render condicional con tres estados (álbum completo, ambos toggles off, normal).

- [ ] **Step 3.1: Reemplazar contenido de `src/ui/ShareListModal.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView, Share, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "@/theme/ThemeProvider";
import { haptics } from "@/lib/haptics";
import { showSnackbar } from "@/ui/Snackbar";
import { PrimaryButton } from "@/ui/PrimaryButton";
import { formatTradeListByTeam } from "@/domain/tradeList";
import type { TradeList } from "@/domain/types";

interface Props {
  visible: boolean;
  onClose: () => void;
  list: TradeList | null;
  username: string | null;
}

const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function ShareListModal({ visible, onClose, list, username }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [showNeeded, setShowNeeded] = useState(true);
  const [showDuplicates, setShowDuplicates] = useState(true);

  useEffect(() => {
    if (visible) {
      setShowNeeded(true);
      setShowDuplicates(true);
    }
  }, [visible]);

  const isComplete = list != null && list.needed.length === 0 && list.duplicates.length === 0;
  const hasNeeded = (list?.needed.length ?? 0) > 0;
  const hasDuplicates = (list?.duplicates.length ?? 0) > 0;
  const bothOff = !showNeeded && !showDuplicates;
  const showToggles = !isComplete && list != null && (hasNeeded || hasDuplicates);

  const text = useMemo(() => {
    if (!list) return "";
    return formatTradeListByTeam(list, {
      username,
      include: { needed: showNeeded, duplicates: showDuplicates }
    });
  }, [list, username, showNeeded, showDuplicates]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text);
    await haptics.success();
    showSnackbar("Copiado ✓");
  };

  const handleShare = async () => {
    await haptics.light();
    try {
      await Share.share({ message: text });
    } catch {
      // usuario canceló el share sheet — no es error
    }
  };

  const toggle = async (which: "needed" | "duplicates") => {
    await haptics.light();
    if (which === "needed") setShowNeeded((v) => !v);
    else setShowDuplicates((v) => !v);
  };

  const buttonsDisabled = bothOff || text.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingBottom: 12
          }}
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>
            Mi lista para compartir
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            hitSlop={12}
          >
            <Text style={{ color: theme.text, fontSize: 22 }}>✕</Text>
          </Pressable>
        </View>

        {showToggles && (
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              paddingHorizontal: 16,
              paddingBottom: 12
            }}
          >
            {hasNeeded && (
              <ToggleChip
                label="Me faltan"
                active={showNeeded}
                onPress={() => toggle("needed")}
                accessibilityLabel={showNeeded ? "Ocultar faltantes" : "Mostrar faltantes"}
              />
            )}
            {hasDuplicates && (
              <ToggleChip
                label="Tengo repes"
                active={showDuplicates}
                onPress={() => toggle("duplicates")}
                accessibilityLabel={showDuplicates ? "Ocultar repetidas" : "Mostrar repetidas"}
              />
            )}
          </View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          {isComplete ? (
            <Text
              style={{
                color: theme.text,
                fontSize: 20,
                fontWeight: "600",
                textAlign: "center",
                marginTop: 80
              }}
            >
              Tu álbum está completo 🎉
            </Text>
          ) : bothOff ? (
            <Text
              style={{
                color: theme.textMute,
                fontSize: 14,
                textAlign: "center",
                marginTop: 40
              }}
            >
              Activá al menos una sección.
            </Text>
          ) : (
            <View
              style={{
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 14
              }}
            >
              <Text
                selectable
                style={{
                  color: theme.text,
                  fontSize: 13,
                  lineHeight: 20,
                  fontFamily: MONO_FONT
                }}
              >
                {text}
              </Text>
            </View>
          )}
        </ScrollView>

        {!isComplete && (
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              paddingHorizontal: 16,
              paddingBottom: Math.max(insets.bottom, 16),
              paddingTop: 12,
              borderTopColor: theme.border,
              borderTopWidth: 1,
              backgroundColor: theme.bg
            }}
          >
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Copiar" onPress={handleCopy} disabled={buttonsDisabled} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Compartir" onPress={handleShare} disabled={buttonsDisabled} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function ToggleChip({
  label,
  active,
  onPress,
  accessibilityLabel
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
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
}
```

- [ ] **Step 3.2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: errores solo en `app/(tabs)/friends.tsx` (sigue pasándole `text` al modal). Los arreglamos en Task 4. Si hay errores en otro archivo, investigar.

- [ ] **Step 3.3: Commit**

```bash
git add src/ui/ShareListModal.tsx
git commit -m "$(cat <<'EOF'
feat(ShareListModal): chips de toggle faltantes/repes + cómputo local del texto

El modal ahora recibe la lista cruda (TradeList) y formatea el texto
internamente con useMemo según el estado de dos chips toggleables.
Cada chip se muestra solo si su sección tiene contenido. Si el usuario
apaga ambos, se muestra un hint y los botones quedan disabled. El estado
se reinicia cada vez que se abre el modal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Conectar `friends.tsx` a la nueva API

**Files:**
- Modify: `app/(tabs)/friends.tsx:32-94`

- [ ] **Step 4.1: Actualizar imports y uso de `useShareList`**

En `app/(tabs)/friends.tsx`, cambiar:

```tsx
// Antes (línea 46):
const { text: shareText } = useShareList();
```

por:

```tsx
const { list: shareListData } = useShareList();
```

- [ ] **Step 4.2: Actualizar props del `ShareListModal`**

En `app/(tabs)/friends.tsx`, cambiar (línea 94):

```tsx
<ShareListModal visible={shareOpen} onClose={() => setShareOpen(false)} text={shareText} />
```

por:

```tsx
<ShareListModal
  visible={shareOpen}
  onClose={() => setShareOpen(false)}
  list={shareListData}
  username={user?.username ?? null}
/>
```

⚠️ `user` ya está en scope: viene de `useSession()` que se importa en la línea 6 pero no se invoca en el componente raíz `Friends`. Hay que agregarlo. Justo después de `const router = useRouter();` (línea 44), agregar:

```tsx
const { user } = useSession();
```

- [ ] **Step 4.3: Typecheck completo**

```bash
pnpm exec tsc --noEmit
```

Expected: PASS sin errores.

- [ ] **Step 4.4: Correr suite completa de tests**

```bash
pnpm test
```

Expected: PASS — la suite completa (~55 tests existentes + 4 nuevos casos en `formatTradeListByTeam`).

- [ ] **Step 4.5: Commit**

```bash
git add app/\(tabs\)/friends.tsx
git commit -m "$(cat <<'EOF'
feat(friends): pasar list + username al ShareListModal

Adapta el callsite del modal a la nueva API: useShareList expone list
(TradeList), y el modal formatea el texto internamente según los chips.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Verificación visual en el simulador

**Files:** (sin cambios de código — solo verificación manual)

- [ ] **Step 5.1: Iniciar Metro**

```bash
pnpm start
```

Dejar corriendo en background o en otra terminal.

- [ ] **Step 5.2: Probar en device/simulator**

Flujo de verificación (en este orden):

1. **Caso normal — ambos toggles on:**
   - Abrir app → tab "Amigos" → tap en el FAB "Compartir lista".
   - Confirmar que el texto muestra códigos (`ARG-1, ARG-4` etc.), no números.
   - Confirmar que header tiene `stickerSwap · Mundial 2026 — @<tu_username>`.
   - Confirmar que aparecen los dos chips ("Me faltan", "Tengo repes") activos (color accent, texto blanco).

2. **Toggle faltantes off:**
   - Tap en "Me faltan" → debe quedar inactivo (card + textMute).
   - El texto pierde el bloque "Me faltan*", queda solo "Tengo repes*".
   - Botones Copiar/Compartir siguen habilitados.

3. **Toggle repes off (ambos off):**
   - Volver a tap "Me faltan" (re-activarlo), luego tap "Tengo repes" → activar.
   - Ahora tap "Me faltan" + "Tengo repes" → ambos off.
   - El área de texto muestra "Activá al menos una sección.".
   - Botones quedan visibles pero deshabilitados (opacity 0.5).

4. **Cerrar y reabrir:**
   - Tap "✕" para cerrar el modal.
   - Tap el FAB de nuevo → ambos chips deben volver a estar activos por defecto.

5. **Copiar:**
   - Con ambos toggles on, tap "Copiar" → snackbar "Copiado ✓".
   - Pegar en notas / WhatsApp y confirmar que el texto contiene códigos.

6. **Compartir:**
   - Tap "Compartir" → abre share sheet nativo con el texto.

7. **Caso "solo faltantes" sin repes:**
   - Si tu álbum tiene solo cromos faltantes y ninguno duplicado, debe verse solo el chip "Me faltan" (no aparece "Tengo repes" porque no hay datos).
   - (Si no es tu caso, dejá esta verificación pendiente.)

8. **Caso "álbum completo":**
   - (Probablemente no aplicable a tu álbum real. Saltable.)
   - Si querés verificarlo, marcar todos los cromos como `count = 1` temporalmente. Abrir modal → ver "Tu álbum está completo 🎉" sin chips ni botones.

- [ ] **Step 5.3: Si todo funciona, no hay commit (no hubo cambios). Si encontrás bugs, fix + commit con `fix(...)`.**

---

## Verificación final

- [ ] **Suite completa pasa:** `pnpm test` → todos verdes.
- [ ] **Typecheck pasa:** `pnpm exec tsc --noEmit` → sin errores.
- [ ] **Verificación visual:** los 8 escenarios del Step 5.2 funcionan.
- [ ] **Git log limpio:** 4 commits, mensajes convencionales con co-author trailer.

```bash
git log --oneline -5
```

Debe mostrar los 4 commits (Task 1-4) más el commit del spec.
