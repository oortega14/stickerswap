# Filtro "Me faltan" en /album/[id] — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un toggle local en `AlbumScroll` que filtre la grilla a stickers con `count === 0`, con chip de activación arriba a la derecha, FAB inferior "Mostrar todos" y tarjeta "¡Completo!" para equipos al 100%.

**Architecture:** Estado `useState` en `AlbumScroll`. El `useMemo` de `rows` recalcula la lista filtrada cuando cambia el toggle. Nuevo tipo de fila `completedNotice` para equipos al 100% bajo filtro. Tres sub-componentes nuevos (`MissingFilterChip`, `CompletedNotice`, `ShowAllFab`) en el mismo archivo. Sin cambios en datos, hooks ni stores.

**Tech Stack:** React Native 0.81, Expo SDK 54, TypeScript strict, FlashList, expo-router, NativeWind v4.

**Spec:** `docs/superpowers/specs/2026-05-14-album-missing-filter-design.md`.

---

## File Structure

**Archivo único modificado:** `src/ui/AlbumScroll.tsx`.

Razón: el feature es UI puro, contenido a un componente. Los sub-componentes nuevos viven en el mismo archivo siguiendo el patrón actual (`SectionHeader`, `StickerCardImpl`, `StickerCard`). No hay extracción a archivos separados porque el archivo sigue siendo manejable (~470 líneas hoy + ~120 estimadas).

No se tocan:
- `src/hooks/useStickers.ts` — la query `useAlbumStickers` sirve igual.
- `src/domain/albumOrder.ts` — el algoritmo de ordenamiento no cambia.
- `app/album/[id].tsx` — sigue siendo un thin wrapper.
- Datos / SQLite / dataset.

---

## Task 1: Toggle de estado + nueva variante de `Row`

Agregamos el `useState`, extendemos el tipo `Row` con `completedNotice` y prep para que `getItemType` lo reconozca. Sin lógica de filtrado todavía — esta tarea sólo introduce el andamiaje de tipos para que el resto compile.

**Files:**
- Modify: `src/ui/AlbumScroll.tsx`

- [ ] **Step 1: Extender el tipo `Row` con la variante `completedNotice`**

Modificá el tipo `Row` (líneas 25–32 hoy) para que sea:

```tsx
type Row =
  | { kind: "header"; section: AlbumSection<StickerWithStatus> }
  | { kind: "completedNotice"; section: AlbumSection<StickerWithStatus> }
  | {
      kind: "stickerRow";
      section: AlbumSection<StickerWithStatus>;
      stickers: StickerWithStatus[];
      rowIndex: number;
    };
```

- [ ] **Step 2: Agregar el state `onlyMissing` en `AlbumScroll`**

Dentro de `AlbumScroll`, después de `const [showBackToTop, setShowBackToTop] = useState(false);` (línea ~60), agregá:

```tsx
const [onlyMissing, setOnlyMissing] = useState(false);
```

- [ ] **Step 3: Cubrir el caso `completedNotice` en `renderItem` con un placeholder mínimo**

En el `renderItem` (líneas ~139–171), antes del retorno actual para `stickerRow`, agregá:

```tsx
if (item.kind === "completedNotice") {
  return null; // reemplazado en Task 3 por el componente real
}
```

Dejá el resto de la función igual.

- [ ] **Step 4: Cubrir `completedNotice` en `keyExtractor` y `getItemType`**

En la `FlashList` (líneas ~189–194), reemplazá ambos por:

```tsx
keyExtractor={(item) => {
  if (item.kind === "header") return `h-${item.section.id}`;
  if (item.kind === "completedNotice") return `c-${item.section.id}`;
  return `r-${item.section.id}-${item.rowIndex}`;
}}
getItemType={(item) => item.kind}
```

- [ ] **Step 5: Verificar typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: termina sin errores. (Si Metro está corriendo, también recompila sin errores.)

- [ ] **Step 6: Commit**

```bash
git add src/ui/AlbumScroll.tsx
git commit -m "feat(album): andamiaje toggle 'Me faltan' (state + tipo Row)"
```

---

## Task 2: Lógica de filtrado en el `useMemo` de `rows`

Hacemos que el `useMemo` que arma `rows` y `headerIndices` tome en cuenta `onlyMissing`. Cuando está activo, filtra los stickers de cada sección y emite `completedNotice` si la sección queda vacía.

**Files:**
- Modify: `src/ui/AlbumScroll.tsx`

- [ ] **Step 1: Reemplazar el `useMemo` que arma `rows`**

Reemplazá el bloque actual (líneas ~62–83):

```tsx
const { rows, headerIndices, initialIndex } = useMemo(() => {
  if (!data) {
    return {
      rows: [] as Row[],
      headerIndices: new Map<string, number>(),
      initialIndex: 0
    };
  }
  const flat: Row[] = [];
  const headerIdx = new Map<string, number>();
  for (const section of data) {
    headerIdx.set(section.id, flat.length);
    flat.push({ kind: "header", section });
    const visible = onlyMissing
      ? section.stickers.filter((s) => s.count === 0)
      : section.stickers;
    if (onlyMissing && visible.length === 0) {
      flat.push({ kind: "completedNotice", section });
    } else {
      for (const [rowIndex, stickers] of chunk(visible, STICKERS_PER_ROW).entries()) {
        flat.push({ kind: "stickerRow", section, stickers, rowIndex });
      }
    }
  }
  const startIdx = findSectionIndex(data, startId);
  const startSection = startIdx >= 0 ? data[startIdx] : null;
  const initial = startSection ? headerIdx.get(startSection.id) ?? 0 : 0;
  return { rows: flat, headerIndices: headerIdx, initialIndex: initial };
}, [data, startId, onlyMissing]);
```

Cambios respecto al original:
- Calcula `visible` con o sin filtro.
- Emite `completedNotice` cuando filtro activo + sección vacía.
- Agrega `onlyMissing` a las deps.

- [ ] **Step 2: Verificar typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: termina sin errores.

- [ ] **Step 3: Smoke manual (opcional, sin UI todavía)**

Como el chip aún no existe, el filtro no se puede activar desde la UI. Si querés probarlo antes de Task 3, podés cambiar temporalmente `useState(false)` a `useState(true)` en la línea del state y ver que la grilla queda vacía para equipos al 100% (los headers se ven solos porque `completedNotice` todavía renderiza `null`). Si lo hacés, **revertilo antes del commit**.

- [ ] **Step 4: Commit**

```bash
git add src/ui/AlbumScroll.tsx
git commit -m "feat(album): filtrar rows por onlyMissing en useMemo"
```

---

## Task 3: Sub-componente `CompletedNotice`

Implementamos la tarjeta "¡Completo!" y la conectamos en `renderItem` reemplazando el `return null` placeholder de Task 1.

**Files:**
- Modify: `src/ui/AlbumScroll.tsx`

- [ ] **Step 1: Agregar el componente `CompletedNotice` al final del archivo**

Al final de `src/ui/AlbumScroll.tsx`, después de la definición de `StickerCard` (memo), agregá:

```tsx
function CompletedNotice({ section }: { section: AlbumSection<StickerWithStatus> }) {
  const { theme } = useTheme();
  const tint = section.teamCode ? pickTint(getTeamColors(section.teamCode)) : theme.accent;
  const total = section.stickers.length;
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}>
      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: withAlpha(tint, 0.4),
          backgroundColor: withAlpha(tint, 0.1),
          paddingVertical: 22,
          paddingHorizontal: 16,
          alignItems: "center"
        }}
      >
        <Text style={{ color: tint, fontSize: 20, fontWeight: "800", marginBottom: 4 }}>
          ¡Completo!
        </Text>
        <Text style={{ color: theme.textMute, fontSize: 13 }}>
          {total} {total === 1 ? "lámina pegada" : "láminas pegadas"}
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Conectar `CompletedNotice` en `renderItem`**

Reemplazá el placeholder de Task 1 dentro de `renderItem`:

```tsx
if (item.kind === "completedNotice") {
  return <CompletedNotice section={item.section} />;
}
```

(Buscá la línea `if (item.kind === "completedNotice") {` que retorna `null`; cambiá el return.)

- [ ] **Step 3: Verificar typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: termina sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/ui/AlbumScroll.tsx
git commit -m "feat(album): CompletedNotice para equipos 100% bajo filtro"
```

---

## Task 4: Sub-componente `MissingFilterChip`

El chip arriba a la derecha que toggle el filtro. Se posiciona absoluto, espejo del botón ‹ de volver.

**Files:**
- Modify: `src/ui/AlbumScroll.tsx`

- [ ] **Step 1: Agregar el componente `MissingFilterChip` al final del archivo**

Después de `CompletedNotice`:

```tsx
function MissingFilterChip({
  active,
  onToggle
}: {
  active: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? "Mostrar todas las figuritas" : "Filtrar solo las que faltan"}
      style={{
        position: "absolute",
        top: insets.top + 12,
        right: 16,
        zIndex: 20,
        height: 36,
        paddingHorizontal: 14,
        borderRadius: 18,
        backgroundColor: active ? theme.accent : theme.card,
        borderWidth: active ? 0 : 1,
        borderColor: theme.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: theme.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: active ? "#fff" : theme.accent,
          marginRight: 8
        }}
      />
      <Text
        style={{
          color: active ? "#fff" : theme.text,
          fontSize: 13,
          fontWeight: "700"
        }}
      >
        Me faltan
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Renderizar el chip en `AlbumScroll`**

En el return de `AlbumScroll`, ubicá el bloque del botón "Back" (`<Pressable onPress={() => router.back()}` alrededor de la línea ~204). Justo después del cierre de ese `<Pressable>` (después del `</Pressable>` correspondiente al back), antes del bloque `{showBackToTop && ...}`, agregá:

```tsx
<MissingFilterChip
  active={onlyMissing}
  onToggle={() => setOnlyMissing((v) => !v)}
/>
```

- [ ] **Step 3: Verificar typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: termina sin errores.

- [ ] **Step 4: Smoke manual**

Run: `pnpm start` (si no está corriendo).
Abrí el álbum desde Home, tocá una sección y verificá:
- El chip "Me faltan" aparece arriba a la derecha.
- Al tocarlo, cambia a estado activo (fondo `theme.accent`, texto blanco).
- La grilla se filtra: equipos con stickers faltantes muestran sólo esos; equipos al 100% muestran la tarjeta "¡Completo!".
- Tocá un sticker faltante: desaparece de la grilla. Si era el último del equipo, aparece "¡Completo!".
- Tocá el chip otra vez: vuelve a la vista completa.

(El FAB "Mostrar todos" todavía no existe — sale en Task 5.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/AlbumScroll.tsx
git commit -m "feat(album): chip 'Me faltan' para toggle del filtro"
```

---

## Task 5: Sub-componente `ShowAllFab` + coexistencia con "Volver arriba"

El FAB inferior "Mostrar todos" que aparece sólo cuando el filtro está on. Se apila correctamente cuando "Volver arriba" también está visible.

**Files:**
- Modify: `src/ui/AlbumScroll.tsx`

- [ ] **Step 1: Agregar el componente `ShowAllFab` al final del archivo**

Después de `MissingFilterChip`:

```tsx
function ShowAllFab({
  onPress,
  raised
}: {
  onPress: () => void;
  raised: boolean;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Mostrar todas las figuritas"
      style={{
        position: "absolute",
        bottom: insets.bottom + (raised ? 72 : 16),
        alignSelf: "center",
        backgroundColor: theme.card,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 999,
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: theme.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 6
      }}
    >
      <Text style={{ color: theme.text, fontSize: 13, marginRight: 6 }}>✕</Text>
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: "700" }}>
        Mostrar todos
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Renderizar el FAB en `AlbumScroll`**

En el return de `AlbumScroll`, justo después del bloque del FAB "Volver arriba" (el `{showBackToTop && (...)}` alrededor de la línea ~232–261), agregá:

```tsx
{onlyMissing && (
  <ShowAllFab
    onPress={() => setOnlyMissing(false)}
    raised={showBackToTop}
  />
)}
```

- [ ] **Step 3: Verificar typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: termina sin errores.

- [ ] **Step 4: Smoke manual**

Run: `pnpm start` (si no está corriendo).
- Abrí el álbum, tocá el chip "Me faltan" → aparece el FAB inferior "Mostrar todos" en `bottom + 16`.
- Tocá el FAB → el filtro se apaga, FAB desaparece, grilla vuelve a normal.
- Reactivá el filtro, scrolleá hacia abajo dentro de una sección hasta que aparezca "Volver arriba" → "Mostrar todos" queda apilado arriba (en `bottom + 72`), "Volver arriba" en `bottom + 16`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/AlbumScroll.tsx
git commit -m "feat(album): FAB 'Mostrar todos' apilado con 'Volver arriba'"
```

---

## Task 6: Pulido + verificación final

Revisamos todos los casos del spec en un solo barrido manual, corregimos detalles que hayan salido en pruebas.

**Files:**
- Modify: `src/ui/AlbumScroll.tsx` (sólo si se detectan ajustes)

- [ ] **Step 1: Verificación manual contra el spec**

Recorré los 9 casos de la sección "Verificación manual" del spec (`docs/superpowers/specs/2026-05-14-album-missing-filter-design.md`):

1. Entrar al álbum desde Home → filtro off, vista normal.
2. Tocar chip "Me faltan" → activo, FAB aparece.
3. Scrollear hasta equipo completo → "¡Completo!" visible.
4. Scrollear hasta equipo con faltantes → grilla filtrada; contador del header muestra total real.
5. Tap en figurita faltante → desaparece; última del equipo → aparece "¡Completo!".
6. Bulk mark "Pegar equipo entero" con filtro on → grilla del equipo se reemplaza por "¡Completo!".
7. Tocar FAB "Mostrar todos" → filtro off, chip neutro, FAB desaparece, grilla restaurada.
8. Salir del álbum y volver → filtro arranca en off.
9. Scrollear hacia abajo con filtro on → "Volver arriba" aparece debajo del FAB "Mostrar todos".

- [ ] **Step 2: Run typecheck + tests**

Run:

```bash
pnpm exec tsc --noEmit
pnpm test
```

Expected: typecheck limpio y los ~55 tests existentes pasan. No se agregan tests nuevos en este plan.

- [ ] **Step 3: Si todo está OK, commit final vacío opcional**

Si no hubo ajustes en Step 1, no hace falta commit. Si los hubo:

```bash
git add src/ui/AlbumScroll.tsx
git commit -m "fix(album): ajustes finales del filtro 'Me faltan'"
```

---

## Notas finales

- **Sin tests automatizados nuevos:** decisión del spec. La lógica nueva es de UI y filtrado trivial sobre `count === 0`.
- **Sin cambios de datos:** la query `useAlbumStickers` sigue devolviendo todos los stickers; el filtro vive sólo en memoria del componente.
- **Sin persistencia:** confirmado por spec; el filtro arranca en off cada vez que se monta `AlbumScroll`.
- **Riesgo bajo:** todo se contiene en un archivo, no toca rutas, navegación, sync ni auth.
