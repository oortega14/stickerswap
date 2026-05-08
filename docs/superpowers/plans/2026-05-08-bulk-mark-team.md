# Bulk-mark Team Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Pegar equipo entero" button on team page that bulk-marks all team stickers as owned (count=1 for those at 0, preserves duplicates), then auto-enters a transient "modo destildar" where taps invert (tap=-1, long=+1) until the user dismisses with "Listo".

**Architecture:** New SQLite function for atomic bulk update + sync queue enqueue inside a transaction. New TanStack Query mutation hook. New presentational banner UI component. Team page gets local state for destildar mode and conditionally inverts tap handlers.

**Tech Stack:** React Native (Expo SDK 54), TypeScript strict, expo-sqlite, TanStack Query, NativeWind, Jest with better-sqlite3 in-memory mock for the data layer.

---

## File Structure

- **Modify** `src/data/stickerStatus.ts`: add `bulkSetOwnedForTeam(teamCode: string): Promise<number>`.
- **Create** `tests/data/bulkSetOwnedForTeam.test.ts`: unit tests for the bulk function.
- **Modify** `src/hooks/useStickers.ts`: add `useBulkMarkTeam` mutation hook.
- **Create** `src/ui/DestildarBanner.tsx`: presentational banner with "Listo" button.
- **Modify** `app/team/[code].tsx`: add button, destildar state, banner, invert tap handlers based on mode.

---

## Task 1: `bulkSetOwnedForTeam` data function (TDD)

**Files:**
- Create: `tests/data/bulkSetOwnedForTeam.test.ts`
- Modify: `src/data/stickerStatus.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/data/bulkSetOwnedForTeam.test.ts`:

```ts
/**
 * @jest-environment node
 */
jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());

import { bulkSetOwnedForTeam, incrementStatus, getStatus } from "@/data/stickerStatus";
import { peekBatch } from "@/data/syncQueue";
import { initSchema } from "@/data/schema";
import { getDb, _resetDb } from "@/data/db";
import "../setup-sqlite-mock";

beforeEach(async () => {
  _resetDb();
  await initSchema();
  const db = getDb();
  // 3 stickers del team ARG, 1 de URU, 1 sin team (Intro)
  await db.runAsync(
    `INSERT INTO stickers (code, number, name, team, section, type) VALUES 
     (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)`,
    [
      "ARG-1", 1, "Foo", "ARG", "Argentina", "player",
      "ARG-2", 2, "Bar", "ARG", "Argentina", "player",
      "ARG-3", 3, "Baz", "ARG", "Argentina", "player",
      "URU-1", 1, "Qux", "URU", "Uruguay", "player",
      "FWC-1", 1, "Logo", null, "Intro", "logo"
    ]
  );
});

describe("bulkSetOwnedForTeam", () => {
  it("sets count=1 for all team stickers when all start at 0", async () => {
    const affected = await bulkSetOwnedForTeam("ARG");
    expect(affected).toBe(3);
    expect((await getStatus("ARG-1"))?.count).toBe(1);
    expect((await getStatus("ARG-2"))?.count).toBe(1);
    expect((await getStatus("ARG-3"))?.count).toBe(1);
  });

  it("preserves count when sticker already has count >= 1 (duplicates intact)", async () => {
    await incrementStatus("ARG-1"); // count = 1
    await incrementStatus("ARG-1"); // count = 2 (duplicate)
    const affected = await bulkSetOwnedForTeam("ARG");
    expect(affected).toBe(2); // ARG-2, ARG-3 affected; ARG-1 preserved
    expect((await getStatus("ARG-1"))?.count).toBe(2);
    expect((await getStatus("ARG-2"))?.count).toBe(1);
    expect((await getStatus("ARG-3"))?.count).toBe(1);
  });

  it("does not affect stickers from other teams", async () => {
    await bulkSetOwnedForTeam("ARG");
    expect((await getStatus("URU-1"))?.count ?? 0).toBe(0);
    expect((await getStatus("FWC-1"))?.count ?? 0).toBe(0);
  });

  it("returns 0 when all team stickers already have count >= 1", async () => {
    await incrementStatus("ARG-1");
    await incrementStatus("ARG-2");
    await incrementStatus("ARG-3");
    const affected = await bulkSetOwnedForTeam("ARG");
    expect(affected).toBe(0);
  });

  it("enqueues affected stickers to sync_queue with count=1", async () => {
    await bulkSetOwnedForTeam("ARG");
    const queue = await peekBatch(100);
    expect(queue).toHaveLength(3);
    expect(queue.map((q) => q.stickerCode).sort()).toEqual(["ARG-1", "ARG-2", "ARG-3"]);
    queue.forEach((q) => expect(q.count).toBe(1));
  });

  it("does not enqueue stickers that were already owned", async () => {
    await incrementStatus("ARG-1"); // 1 queue entry from increment
    await bulkSetOwnedForTeam("ARG"); // affects ARG-2, ARG-3 only → 2 more queue entries
    const queue = await peekBatch(100);
    expect(queue).toHaveLength(3);
  });

  it("returns 0 for unknown team code", async () => {
    const affected = await bulkSetOwnedForTeam("XYZ");
    expect(affected).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
eval "$(mise activate zsh)"
pnpm test tests/data/bulkSetOwnedForTeam.test.ts
```

Expected: FAIL with `bulkSetOwnedForTeam is not a function` (or "is not exported").

- [ ] **Step 3: Implement `bulkSetOwnedForTeam`**

Edit `src/data/stickerStatus.ts`. Add after the existing `decrementStatus` function (around line 62), before `applyRemoteStatus`:

```ts
export async function bulkSetOwnedForTeam(teamCode: string): Promise<number> {
  const db = getDb();
  // Cromos del equipo donde no hay row o count = 0
  const rows = await db.getAllAsync<{ code: string }>(
    `SELECT s.code FROM stickers s
     LEFT JOIN sticker_status ss ON ss.sticker_code = s.code
     WHERE s.team = ? AND (ss.count IS NULL OR ss.count = 0)`,
    [teamCode]
  );
  if (rows.length === 0) return 0;

  const now = Date.now();
  await db.execAsync("BEGIN TRANSACTION");
  try {
    for (const { code } of rows) {
      await db.runAsync(
        `INSERT INTO sticker_status (sticker_code, count, updated_at) VALUES (?, 1, ?)
         ON CONFLICT(sticker_code) DO UPDATE SET count = 1, updated_at = excluded.updated_at`,
        [code, now]
      );
      await enqueue(code, 1);
    }
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
  return rows.length;
}
```

(The `enqueue` import is already at the top of the file — `import { enqueue } from "./syncQueue";`)

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test tests/data/bulkSetOwnedForTeam.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
pnpm test
```

Expected: All ~62 tests PASS.

- [ ] **Step 6: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/data/stickerStatus.ts tests/data/bulkSetOwnedForTeam.test.ts
git commit -m "$(cat <<'EOF'
feat(data): add bulkSetOwnedForTeam (transactional bulk-mark)

Sets count=1 for all team stickers currently at 0 in a single SQLite
transaction. Preserves duplicates (count >= 1) untouched. Encola cada
cromo afectado al sync_queue. Devuelve cantidad de cromos modificados.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `useBulkMarkTeam` hook

**Files:**
- Modify: `src/hooks/useStickers.ts`

This is a thin wrapper around the tested data function — no new tests; the data layer is already covered.

- [ ] **Step 1: Add hook**

Edit `src/hooks/useStickers.ts`. Update the import at line 3:

```ts
import { incrementStatus, decrementStatus, bulkSetOwnedForTeam } from "@/data/stickerStatus";
```

And append after `useDecrement` (after line 53):

```ts
export function useBulkMarkTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamCode: string) => bulkSetOwnedForTeam(teamCode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickers"] });
    }
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStickers.ts
git commit -m "$(cat <<'EOF'
feat(hooks): add useBulkMarkTeam mutation

Wraps bulkSetOwnedForTeam y invalida queries de stickers (incluye home,
álbum, team page, progress) al éxito.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `DestildarBanner` component

**Files:**
- Create: `src/ui/DestildarBanner.tsx`

Banner flotante absolute-positioned debajo del header de navegación, sobre el contenido scrolleable. Mantiene visible el botón "back" del header de la pantalla.

- [ ] **Step 1: Create the component**

Create `src/ui/DestildarBanner.tsx`:

```tsx
import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

interface Props {
  onDone: () => void;
  accent: string;
}

export function DestildarBanner({ onDone, accent }: Props) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        top: 100,
        left: 16,
        right: 16,
        backgroundColor: accent,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 10,
        shadowColor: theme.text,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 6
      }}
    >
      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600", flex: 1, marginRight: 12 }}>
        Modo destildar · tocá las que te falten
      </Text>
      <Pressable
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel="Salir del modo destildar"
        hitSlop={8}
        style={{
          backgroundColor: "rgba(255,255,255,0.22)",
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 999
        }}
      >
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>Listo</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/DestildarBanner.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add DestildarBanner component

Banner flotante con texto y botón "Listo". Recibe color de acento del
equipo. Posicionado absolute debajo del header del team page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire team page

**Files:**
- Modify: `app/team/[code].tsx`

Agregar botón "Pegar equipo entero" debajo de la progress bar; agregar state `destildarMode`; mostrar banner condicional; invertir handlers de tap/long cuando el modo está activo.

- [ ] **Step 1: Add imports and state**

In `app/team/[code].tsx`, update imports (line 1-14):

Replace line 6:
```ts
import { useTeamStickers, useIncrement, useDecrement } from "@/hooks/useStickers";
```
with:
```ts
import { useTeamStickers, useIncrement, useDecrement, useBulkMarkTeam } from "@/hooks/useStickers";
```

Add this import after line 13:
```ts
import { DestildarBanner } from "@/ui/DestildarBanner";
```

Replace line 1:
```ts
import { useMemo } from "react";
```
with:
```ts
import { useMemo, useState } from "react";
```

- [ ] **Step 2: Add hook + state inside `TeamDetail` component**

Inside `TeamDetail` (after line 32 `const dec = useDecrement();`), add:

```ts
  const bulkMark = useBulkMarkTeam();
  const [destildarMode, setDestildarMode] = useState(false);
```

- [ ] **Step 3: Add tap handlers that invert based on mode**

Before the `return (...)` (around line 56, just after `const sorted = ...`), add:

```ts
  const handleTap = (stickerCode: string) => {
    haptics.light();
    if (destildarMode) {
      dec.mutate(stickerCode);
    } else {
      inc.mutate(stickerCode);
    }
  };
  const handleLong = (stickerCode: string) => {
    haptics.medium();
    if (destildarMode) {
      inc.mutate(stickerCode);
    } else {
      dec.mutate(stickerCode);
    }
  };
```

- [ ] **Step 4: Replace card handlers to use the new functions**

Find the grid block (lines 117-133):

```tsx
{sorted.map((s) => (
  <StickerCard
    key={s.code}
    s={s}
    accent={tint}
    onTap={() => {
      haptics.light();
      inc.mutate(s.code);
    }}
    onLong={() => {
      haptics.medium();
      dec.mutate(s.code);
    }}
  />
))}
```

Replace with:

```tsx
{sorted.map((s) => (
  <StickerCard
    key={s.code}
    s={s}
    accent={tint}
    onTap={() => handleTap(s.code)}
    onLong={() => handleLong(s.code)}
  />
))}
```

Find the list block (lines 135-152):

```tsx
{sorted.map((s) => (
  <StickerRow
    key={s.code}
    s={s}
    accent={tint}
    onTap={() => {
      haptics.light();
      inc.mutate(s.code);
    }}
    onLong={() => {
      haptics.medium();
      dec.mutate(s.code);
    }}
  />
))}
```

Replace with:

```tsx
{sorted.map((s) => (
  <StickerRow
    key={s.code}
    s={s}
    accent={tint}
    onTap={() => handleTap(s.code)}
    onLong={() => handleLong(s.code)}
  />
))}
```

- [ ] **Step 5: Add "Pegar equipo entero" button below progress bar**

Find the block ending the header section (around lines 109-113):

```tsx
{/* Progress fino con el color del equipo como acento */}
<View className="mt-4">
  <ProgressBar pct={summary.pct} height={3} from={tint} to={tint} />
</View>
```

Replace with (adds button after progress bar):

```tsx
{/* Progress fino con el color del equipo como acento */}
<View className="mt-4">
  <ProgressBar pct={summary.pct} height={3} from={tint} to={tint} />
</View>

{/* Bulk-mark: marca todos los faltantes del equipo como pegados */}
<Pressable
  onPress={() => {
    haptics.medium();
    bulkMark.mutate(code ?? "", {
      onSuccess: () => setDestildarMode(true)
    });
  }}
  disabled={bulkMark.isPending}
  accessibilityRole="button"
  accessibilityLabel="Marcar todo el equipo como pegado"
  style={{
    marginTop: 16,
    backgroundColor: tint,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    opacity: bulkMark.isPending ? 0.6 : 1
  }}
>
  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
    ✓  Pegar equipo entero
  </Text>
</Pressable>
```

- [ ] **Step 6: Render the banner conditionally**

Find the outer wrapper (line 58):

```tsx
return (
  <View style={{ flex: 1, backgroundColor: theme.bg }}>
    {/* Tint sutil del color del equipo, gradient arriba → fade abajo */}
    <LinearGradient
```

Insert the banner just after the LinearGradient closes (after line 72 `/>`). Change from:

```tsx
      <LinearGradient
        colors={[withAlpha(tint, tintAlpha), withAlpha(tint, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 360,
          pointerEvents: "none"
        }}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
```

to:

```tsx
      <LinearGradient
        colors={[withAlpha(tint, tintAlpha), withAlpha(tint, 0)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 360,
          pointerEvents: "none"
        }}
      />

      {destildarMode && (
        <DestildarBanner accent={tint} onDone={() => setDestildarMode(false)} />
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
```

- [ ] **Step 7: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Run tests**

```bash
pnpm test
```

Expected: All tests PASS (no UI tests changed; the data tests from Task 1 still pass).

- [ ] **Step 9: Commit**

```bash
git add app/team/\[code\].tsx
git commit -m "$(cat <<'EOF'
feat(team): bulk-mark + modo destildar en página de equipo

Botón "Pegar equipo entero" debajo de la progress bar dispara el
bulk de cromos en 0 → 1 (preservando duplicados) y entra en "modo
destildar" donde tap=-1 / long=+1. Salida con botón "Listo".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Manual smoke test

El proyecto no testea UI con snapshots ni integration. Validación manual en device/simulador.

**Files:** None (no code changes; this is verification).

- [ ] **Step 1: Start Metro and run on iOS**

```bash
eval "$(mise activate zsh)"
pnpm start
```

Abrir en simulador iOS o device. Si no rebuildea automáticamente y necesitás recompilar nativo (poco probable porque solo cambian archivos JS/TS):

```bash
pnpm exec expo prebuild --platform ios --clean
# luego ▶ Play en Xcode
```

- [ ] **Step 2: Smoke test del flujo principal**

Validar paso a paso:

1. Desde Home, tap a un equipo (ej. Argentina). Anotá cuántos cromos están "pegados" antes (debería verse en "X/20" del header).
2. En la página del equipo, ver botón **"✓ Pegar equipo entero"** debajo de la progress bar.
3. Tap al botón. Esperado:
   - Hap medio.
   - Cards reaccionan: las que estaban "falta" pasan a "pegado".
   - Cards con duplicados (×2, ×3) NO cambian.
   - Banner aparece: "Modo destildar · tocá las que te falten · [Listo]".
   - Header refleja "20/20" (o el número correcto).
4. Tap a una card en modo destildar. Esperado: count baja a 0 (visualmente pasa a "falta").
5. Long-press a esa misma card. Esperado: count vuelve a 1 (revertir).
6. Tap "Listo". Esperado: banner desaparece.
7. Tap a una card (ahora fuera de destildar). Esperado: count sube a 2 (badge ×2 = duplicado).
8. Long-press a esa card. Esperado: count baja a 1.
9. Back. Home muestra el progreso del equipo actualizado.

- [ ] **Step 3: Smoke test edge cases**

1. **Equipo ya 100% (todos pegados con count=1)**:
   - Tap "Pegar equipo entero" → no cambian counts. Banner igual aparece. Tap "Listo" sale.
2. **Equipo con duplicados pre-existentes (algún cromo en count=2 o 3)**:
   - Tap "Pegar equipo entero" → los que estaban en 0 pasan a 1. Los duplicados quedan intactos (×2, ×3 sigue ahí).
3. **Navegar fuera durante destildar**:
   - Activar destildar → tap a algunos cromos → tap back. Volver al equipo. Banner NO está (estado limpio). Cromos destildados quedaron persistidos.
4. **Offline**:
   - Activar avión mode → tap "Pegar equipo entero" → banner aparece → cards reaccionan (writes locales OK). Esperar reconexión, sync drain debería sincronizar al backend (ver indicador de pendientes en Home).

- [ ] **Step 4: Reportar resultado**

Si todo pasa: anunciar éxito. Si falla algún caso: documentar (qué paso, qué se esperaba, qué se observó) — no hace falta commitear nada en este step, solo confirmar.

---

## Verification

Tras completar todas las tasks:

- [ ] `pnpm test` → all tests PASS (incluye los 7 nuevos de bulkSetOwnedForTeam).
- [ ] `pnpm exec tsc --noEmit` → no errors.
- [ ] Manual smoke test (Task 5) → todos los pasos OK.
- [ ] `git log --oneline -5` muestra los 4 commits del feature en orden:
  1. `feat(data): add bulkSetOwnedForTeam ...`
  2. `feat(hooks): add useBulkMarkTeam ...`
  3. `feat(ui): add DestildarBanner component`
  4. `feat(team): bulk-mark + modo destildar en página de equipo`
