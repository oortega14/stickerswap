# Home Dashboard + Colapsibles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el Home tab por un dashboard de 13 stats + lista de 51 colapsibles inline, eliminando la ruta `/album/[id]` y el componente `AlbumScroll`.

**Architecture:** Función pura `computeStats` deriva las 13 stats desde las queries existentes (`useAlbumStickers`, `useFriends`, `useMatches`). Tres stores Zustand manejan el view-mode (persist), las secciones expandidas, y los filtros por sección. UI primitiva (`StatCard`, `FlagSvg`, etc.) compone el dashboard y los colapsibles. `FlashList` renderiza las 51 secciones con item-size estimado.

**Tech Stack:** TypeScript strict, Expo SDK 54, React Native 0.81, Zustand (con persist middleware), TanStack Query, `react-native-svg`, FlashList, AsyncStorage, Reanimated v4.

**Spec:** `docs/superpowers/specs/2026-05-18-home-dashboard-collapsibles-design.md`

---

## Pre-requisitos

Antes de empezar, asegurate de que el entorno esté listo:

```bash
eval "$(mise activate zsh)"
pnpm install
pnpm test                    # debería pasar (~55 tests)
pnpm exec tsc --noEmit       # debería pasar sin errores
```

Si algo falla acá, parar y resolver antes de continuar.

---

### Task 1: Agregar `imageUrl` opcional al type `Sticker` y al generator

**Files:**
- Modify: `src/domain/types.ts:1-10`
- Modify: `scripts/gen-stickers.js` (bumpear `version` y agregar `imageUrl: null` al output)

- [ ] **Step 1: Modificar el type `Sticker` para incluir `imageUrl` opcional**

Edit `src/domain/types.ts` — agregar la línea `imageUrl` a la interface `Sticker`:

```ts
export interface Sticker {
  code: string;
  number: number;
  name: string;
  team: string | null;
  section: string;
  type: StickerType;
  imageUrl?: string | null;   // foto del jugador/escudo; null si todavía no la tenemos
}
```

- [ ] **Step 2: Actualizar `scripts/gen-stickers.js` para emitir `imageUrl: null`**

Buscar el lugar donde el script construye cada sticker (suele ser un `push({...})` o similar dentro del loop principal). Agregar `imageUrl: null` al objeto. También bumpear la constante `version` de `6` a `7` al inicio del archivo (debería verse algo como `const VERSION = 6;` o estar en el header del output).

Ejemplo del objeto resultante:
```js
stickers.push({
  code: `${teamCode}-${i}`,
  number: globalNumber,
  name: playerName,
  team: teamCode,
  section: country,
  type: stickerType,
  group: groupLetter,
  imageUrl: null
});
```

Si la `version` del header se construye con `{ version: 6, album: "...", stickers: [...] }`, cambiá a `version: 7`.

- [ ] **Step 3: Regenerar el dataset**

Run: `node scripts/gen-stickers.js`
Expected: `assets/stickers.json` se reescribe, `version: 7`, cada sticker tiene `imageUrl: null`.

Verificar:
```bash
head -20 assets/stickers.json
```
Esperado: ver `"version": 7` y al menos un sticker con `"imageUrl": null`.

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores. El campo es opcional así que ningún consumidor existente se rompe.

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: todos los tests pasan (los existentes no se afectan).

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts scripts/gen-stickers.js assets/stickers.json
git commit -m "feat(types): agregar imageUrl opcional a Sticker

Bumpea version del dataset a 7. La app re-siembra automaticamente
al detectar la version nueva (mecanismo existente).
"
```

---

### Task 2: Función pura `computeStats` con TDD

**Files:**
- Create: `src/domain/stats.ts`
- Create: `tests/domain/stats.test.ts`

- [ ] **Step 1: Escribir tests fallidos**

Create `tests/domain/stats.test.ts`:

```ts
import { computeStats } from "@/domain/stats";
import type { StickerWithStatus, Friend, FriendMatchSummary } from "@/domain/types";

const baseSticker = (overrides: Partial<StickerWithStatus>): StickerWithStatus => ({
  code: "X-1",
  number: 1,
  name: "Player",
  team: null,
  section: "Intro",
  type: "player",
  count: 0,
  ...overrides
});

describe("computeStats", () => {
  it("retorna ceros para un album vacio", () => {
    const s = computeStats([], [], []);
    expect(s.collected).toBe(0);
    expect(s.missing).toBe(0);
    expect(s.duplicates).toBe(0);
    expect(s.pct).toBe(0);
    expect(s.teamsComplete).toBe(0);
    expect(s.teamsOneAway).toBe(0);
    expect(s.teamsZero).toBe(0);
    expect(s.badgesCollected).toBe(0);
    expect(s.legendsCollected).toBe(0);
    expect(s.cokeCollected).toBe(0);
    expect(s.friendsCount).toBe(0);
    expect(s.matchesCount).toBe(0);
    expect(s.lastAdded).toBeNull();
  });

  it("cuenta collected y missing", () => {
    const stickers = [
      baseSticker({ code: "A-1", count: 1 }),
      baseSticker({ code: "A-2", count: 0 }),
      baseSticker({ code: "A-3", count: 2 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.collected).toBe(2);
    expect(s.missing).toBe(1);
    expect(s.pct).toBeCloseTo(2 / 3);
  });

  it("cuenta duplicates como suma de extras (count-1)", () => {
    const stickers = [
      baseSticker({ code: "A-1", count: 3 }),
      baseSticker({ code: "A-2", count: 2 }),
      baseSticker({ code: "A-3", count: 1 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.duplicates).toBe(3); // 2 + 1 + 0
  });

  it("cuenta solo equipos (teamCode != null) en teamsComplete/OneAway/Zero", () => {
    const stickers: StickerWithStatus[] = [
      // ARG completo (2 stickers, count >= 1)
      baseSticker({ code: "ARG-1", team: "ARG", section: "Argentina", count: 1 }),
      baseSticker({ code: "ARG-2", team: "ARG", section: "Argentina", count: 1 }),
      // BRA a uno (2 stickers, uno faltante)
      baseSticker({ code: "BRA-1", team: "BRA", section: "Brasil", count: 1 }),
      baseSticker({ code: "BRA-2", team: "BRA", section: "Brasil", count: 0 }),
      // MEX sin empezar
      baseSticker({ code: "MEX-1", team: "MEX", section: "México", count: 0 }),
      // Intro: NO cuenta como equipo aunque este completo
      baseSticker({ code: "FWC-1", team: null, section: "Intro", count: 1 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.teamsComplete).toBe(1); // ARG
    expect(s.teamsOneAway).toBe(1);  // BRA
    expect(s.teamsZero).toBe(1);     // MEX
  });

  it("cuenta badges por type=team_badge", () => {
    const stickers = [
      baseSticker({ code: "ARG-1", type: "team_badge", count: 1 }),
      baseSticker({ code: "BRA-1", type: "team_badge", count: 0 }),
      baseSticker({ code: "ARG-2", type: "player",     count: 1 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.badgesCollected).toBe(1);
    expect(s.badgesTotal).toBe(48);
  });

  it("cuenta legends por section=Extras", () => {
    const stickers = [
      baseSticker({ code: "L1", section: "Extras", count: 1 }),
      baseSticker({ code: "L2", section: "Extras", count: 0 }),
      baseSticker({ code: "X1", section: "Intro",  count: 1 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.legendsCollected).toBe(1);
    expect(s.legendsTotal).toBe(11);
  });

  it("cuenta coke por section=Coca-Cola", () => {
    const stickers = [
      baseSticker({ code: "CC1", section: "Coca-Cola", count: 1 }),
      baseSticker({ code: "CC2", section: "Coca-Cola", count: 1 }),
      baseSticker({ code: "X1",  section: "Intro",      count: 1 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.cokeCollected).toBe(2);
    expect(s.cokeTotal).toBe(14);
  });

  it("cuenta friends solo accepted", () => {
    const friends: Friend[] = [
      { id: "1", username: "a", displayName: null, avatarUrl: null, status: "accepted", source: "qr_code",         createdAt: 1 },
      { id: "2", username: "b", displayName: null, avatarUrl: null, status: "pending",  source: "username_search", createdAt: 1 },
      { id: "3", username: "c", displayName: null, avatarUrl: null, status: "accepted", source: "qr_code",         createdAt: 1 }
    ];
    const s = computeStats([], friends, []);
    expect(s.friendsCount).toBe(2);
  });

  it("matchesCount cuenta amigos con al menos una lista no vacia", () => {
    const matches: FriendMatchSummary[] = [
      { friendId: "1", username: "a", displayName: null, theyHaveYouNeed: ["X"], youHaveTheyNeed: [],    matchCount: 1, sample: ["X"] },
      { friendId: "2", username: "b", displayName: null, theyHaveYouNeed: [],    youHaveTheyNeed: ["Y"], matchCount: 0, sample: [] },
      { friendId: "3", username: "c", displayName: null, theyHaveYouNeed: [],    youHaveTheyNeed: [],    matchCount: 0, sample: [] }
    ];
    const s = computeStats([], [], matches);
    expect(s.matchesCount).toBe(2);
  });

  it("lastAdded devuelve el sticker con max updatedAt y count>=1", () => {
    const stickers = [
      baseSticker({ code: "A-1", name: "Messi",  count: 1, updatedAt: 100 } as any),
      baseSticker({ code: "A-2", name: "Lautaro", count: 1, updatedAt: 200 } as any),
      baseSticker({ code: "A-3", name: "DiMaria", count: 0, updatedAt: 300 } as any) // ignorado (count 0)
    ];
    const s = computeStats(stickers, [], []);
    expect(s.lastAdded).toEqual({
      stickerCode: "A-2",
      stickerName: "Lautaro",
      updatedAt: 200
    });
  });

  it("lastAdded es null cuando nada esta pegado", () => {
    const stickers = [
      baseSticker({ code: "A-1", count: 0 }),
      baseSticker({ code: "A-2", count: 0 })
    ];
    const s = computeStats(stickers, [], []);
    expect(s.lastAdded).toBeNull();
  });
});
```

> Nota: los tests usan `as any` para `updatedAt` porque `StickerWithStatus` no lo expone hoy. El test asume que `computeStats` lee `updatedAt` directamente del sticker. Si la implementación recibe el dato desde otra fuente (el `StickerStatus`), ajustar la firma. Ver paso 3.

- [ ] **Step 2: Correr tests para ver fallar**

Run: `pnpm test stats.test`
Expected: FAIL — módulo `@/domain/stats` no existe.

- [ ] **Step 3: Implementar `computeStats`**

Create `src/domain/stats.ts`:

```ts
import type {
  StickerWithStatus,
  Friend,
  FriendMatchSummary
} from "./types";

export interface DashboardStats {
  collected: number;
  missing: number;
  duplicates: number;
  pct: number;

  teamsComplete: number;
  teamsOneAway: number;
  teamsZero: number;

  badgesCollected: number;
  badgesTotal: number;
  legendsCollected: number;
  legendsTotal: number;
  cokeCollected: number;
  cokeTotal: number;

  friendsCount: number;
  matchesCount: number;

  lastAdded: {
    stickerCode: string;
    stickerName: string;
    updatedAt: number;
  } | null;
}

interface StickerWithUpdatedAt extends StickerWithStatus {
  updatedAt?: number;
}

const TEAMS_TOTAL = 48;
const LEGENDS_TOTAL = 11;
const COKE_TOTAL = 14;

export function computeStats(
  stickers: StickerWithUpdatedAt[],
  friends: Friend[],
  matches: FriendMatchSummary[]
): DashboardStats {
  let collected = 0;
  let duplicates = 0;
  let badgesCollected = 0;
  let legendsCollected = 0;
  let cokeCollected = 0;

  // Agrupado por seccion para teams stats
  const sectionAgg = new Map<
    string,
    { teamCode: string | null; total: number; collected: number }
  >();

  let lastAdded: DashboardStats["lastAdded"] = null;

  for (const s of stickers) {
    const count = s.count ?? 0;
    if (count >= 1) collected += 1;
    if (count > 1) duplicates += count - 1;
    if (s.type === "team_badge" && count >= 1) badgesCollected += 1;
    if (s.section === "Extras" && count >= 1) legendsCollected += 1;
    if (s.section === "Coca-Cola" && count >= 1) cokeCollected += 1;

    if (count >= 1 && typeof s.updatedAt === "number") {
      if (!lastAdded || s.updatedAt > lastAdded.updatedAt) {
        lastAdded = {
          stickerCode: s.code,
          stickerName: s.name,
          updatedAt: s.updatedAt
        };
      }
    }

    const entry = sectionAgg.get(s.section);
    if (entry) {
      entry.total += 1;
      if (count >= 1) entry.collected += 1;
      if (entry.teamCode !== null && s.team === null) entry.teamCode = null;
    } else {
      sectionAgg.set(s.section, {
        teamCode: s.team ?? null,
        total: 1,
        collected: count >= 1 ? 1 : 0
      });
    }
  }

  let teamsComplete = 0;
  let teamsOneAway = 0;
  let teamsZero = 0;
  for (const [, v] of sectionAgg) {
    if (v.teamCode === null) continue;
    if (v.collected === v.total) teamsComplete += 1;
    if (v.total - v.collected === 1) teamsOneAway += 1;
    if (v.collected === 0) teamsZero += 1;
  }

  const total = stickers.length;
  const missing = total - collected;
  const pct = total === 0 ? 0 : collected / total;

  const friendsCount = friends.filter((f) => f.status === "accepted").length;
  const matchesCount = matches.filter(
    (m) => m.theyHaveYouNeed.length > 0 || m.youHaveTheyNeed.length > 0
  ).length;

  return {
    collected,
    missing,
    duplicates,
    pct,
    teamsComplete,
    teamsOneAway,
    teamsZero,
    badgesCollected,
    badgesTotal: TEAMS_TOTAL,
    legendsCollected,
    legendsTotal: LEGENDS_TOTAL,
    cokeCollected,
    cokeTotal: COKE_TOTAL,
    friendsCount,
    matchesCount,
    lastAdded
  };
}
```

- [ ] **Step 4: Correr tests para ver pasar**

Run: `pnpm test stats.test`
Expected: PASS — los 11 tests pasan.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/domain/stats.ts tests/domain/stats.test.ts
git commit -m "feat(domain): agregar computeStats con 13 metricas

Funcion pura que deriva collected/missing/duplicates/pct, conteos
por equipo (complete/oneAway/zero), tipos especiales (badges/legends/
cocacola), y stats sociales (friends/matches/lastAdded) desde los
stickers + friends + matches existentes.
"
```

---

### Task 3: Helper `filterStickers` con TDD

**Files:**
- Create: `src/domain/stickerFilter.ts`
- Create: `tests/domain/stickerFilter.test.ts`

- [ ] **Step 1: Escribir tests fallidos**

Create `tests/domain/stickerFilter.test.ts`:

```ts
import { filterStickers, countByFilter } from "@/domain/stickerFilter";
import type { StickerWithStatus } from "@/domain/types";

const mk = (code: string, count: number): StickerWithStatus => ({
  code,
  number: 1,
  name: code,
  team: null,
  section: "X",
  type: "player",
  count
});

describe("filterStickers", () => {
  const stickers = [mk("A", 0), mk("B", 1), mk("C", 2), mk("D", 0), mk("E", 3)];

  it("modo 'all' devuelve todo", () => {
    expect(filterStickers(stickers, "all")).toEqual(stickers);
  });

  it("modo 'missing' devuelve solo count === 0", () => {
    expect(filterStickers(stickers, "missing").map((s) => s.code)).toEqual(["A", "D"]);
  });

  it("modo 'dup' devuelve solo count > 1", () => {
    expect(filterStickers(stickers, "dup").map((s) => s.code)).toEqual(["C", "E"]);
  });
});

describe("countByFilter", () => {
  it("retorna conteos por cada modo", () => {
    const stickers = [mk("A", 0), mk("B", 1), mk("C", 2), mk("D", 0), mk("E", 3)];
    expect(countByFilter(stickers)).toEqual({ all: 5, missing: 2, dup: 2 });
  });
});
```

- [ ] **Step 2: Correr tests para ver fallar**

Run: `pnpm test stickerFilter.test`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar el helper**

Create `src/domain/stickerFilter.ts`:

```ts
import type { StickerWithStatus } from "./types";

export type FilterMode = "all" | "missing" | "dup";

export function filterStickers(
  stickers: StickerWithStatus[],
  mode: FilterMode
): StickerWithStatus[] {
  switch (mode) {
    case "all":     return stickers;
    case "missing": return stickers.filter((s) => s.count === 0);
    case "dup":     return stickers.filter((s) => s.count > 1);
  }
}

export function countByFilter(
  stickers: StickerWithStatus[]
): { all: number; missing: number; dup: number } {
  let missing = 0;
  let dup = 0;
  for (const s of stickers) {
    if (s.count === 0) missing += 1;
    else if (s.count > 1) dup += 1;
  }
  return { all: stickers.length, missing, dup };
}
```

- [ ] **Step 4: Correr tests para ver pasar**

Run: `pnpm test stickerFilter.test`
Expected: PASS — los 4 tests pasan.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/domain/stickerFilter.ts tests/domain/stickerFilter.test.ts
git commit -m "feat(domain): agregar filterStickers + countByFilter

Helpers para los modos all/missing/dup que usaran los colapsibles.
"
```

---

### Task 4: Hook `useDashboardStats`

**Files:**
- Create: `src/hooks/useDashboardStats.ts`

- [ ] **Step 1: Implementar el hook**

Create `src/hooks/useDashboardStats.ts`:

```ts
import { useMemo } from "react";
import { useAlbumStickers } from "./useStickers";
import { useFriends } from "./useFriends";
import { useMatches } from "./useMatches";
import { computeStats, type DashboardStats } from "@/domain/stats";

interface Result {
  isLoading: boolean;
  stats: DashboardStats | null;
}

export function useDashboardStats(): Result {
  const stickers = useAlbumStickers();
  const friends = useFriends();
  const matches = useMatches();

  return useMemo(() => {
    if (!stickers.data || !friends.data) {
      return { isLoading: true, stats: null };
    }
    const flat = stickers.data.flatMap((section) => section.stickers);
    const stats = computeStats(flat, friends.data, matches.summary ?? []);
    return { isLoading: false, stats };
  }, [stickers.data, friends.data, matches.summary]);
}
```

> Nota: `useMatches` retorna `{ ...query, summary }` — usamos `.summary` no `.data`. `useFriends` retorna la query directa. Si `useAlbumStickers` no popla `updatedAt` en cada sticker, las stats `lastAdded` quedará null en producción aunque haya datos — eso es OK por ahora; podemos agregarlo después si hace falta (necesita join con `sticker_status`).

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Run all tests**

Run: `pnpm test`
Expected: todos pasan (no agregamos test del hook — composición de hooks ya probados).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDashboardStats.ts
git commit -m "feat(hooks): agregar useDashboardStats

Compone useAlbumStickers + useFriends + useMatches y devuelve las
13 stats memoizadas via computeStats.
"
```

---

### Task 5: Store `useStickerViewMode` (Zustand + persist + AsyncStorage)

**Files:**
- Create: `src/store/stickerViewMode.ts`
- Create: `tests/store/stickerViewMode.test.ts`

- [ ] **Step 1: Confirmar deps**

Run: `pnpm list zustand @react-native-async-storage/async-storage 2>&1 | head -10`
Expected: ambos paquetes instalados. Si falta `zustand`:
```bash
pnpm add zustand
```
Si falta el AsyncStorage:
```bash
pnpm exec expo install @react-native-async-storage/async-storage
```

- [ ] **Step 2: Escribir test fallido**

Create `tests/store/stickerViewMode.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react-native";
import { useStickerViewMode } from "@/store/stickerViewMode";

// Mock AsyncStorage para que persist no rompa en tests
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

describe("useStickerViewMode", () => {
  beforeEach(() => {
    // Reset store entre tests
    useStickerViewMode.setState({ mode: "compact" });
  });

  it("default es 'compact'", () => {
    const { result } = renderHook(() => useStickerViewMode());
    expect(result.current.mode).toBe("compact");
  });

  it("setMode actualiza el mode", () => {
    const { result } = renderHook(() => useStickerViewMode());
    act(() => result.current.setMode("full"));
    expect(result.current.mode).toBe("full");
  });
});
```

> Si `@testing-library/react-native` no está instalado, agregar como devDep:
> ```bash
> pnpm add -D @testing-library/react-native
> ```

- [ ] **Step 3: Correr test para ver fallar**

Run: `pnpm test stickerViewMode.test`
Expected: FAIL — módulo `@/store/stickerViewMode` no existe.

- [ ] **Step 4: Implementar store con persist**

Create `src/store/stickerViewMode.ts`:

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type StickerViewMode = "compact" | "full";

interface Store {
  mode: StickerViewMode;
  setMode: (m: StickerViewMode) => void;
}

export const useStickerViewMode = create<Store>()(
  persist(
    (set) => ({
      mode: "compact",
      setMode: (mode) => set({ mode })
    }),
    {
      name: "panini.album.viewMode",
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);
```

- [ ] **Step 5: Correr test para ver pasar**

Run: `pnpm test stickerViewMode.test`
Expected: PASS — 2 tests pasan.

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/store/stickerViewMode.ts tests/store/stickerViewMode.test.ts
git commit -m "feat(store): agregar useStickerViewMode (compact/full persist)

Persiste el modo de visualizacion entre sesiones via AsyncStorage en
la clave panini.album.viewMode. Default compact.
"
```

---

### Task 6: Store `useExpandedSections` (Set in-memory)

**Files:**
- Create: `src/store/expandedSections.ts`
- Create: `tests/store/expandedSections.test.ts`

- [ ] **Step 1: Escribir tests fallidos**

Create `tests/store/expandedSections.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react-native";
import { useExpandedSections } from "@/store/expandedSections";

describe("useExpandedSections", () => {
  beforeEach(() => {
    useExpandedSections.setState({ expanded: new Set<string>() });
  });

  it("default es Set vacio", () => {
    const { result } = renderHook(() => useExpandedSections());
    expect(result.current.expanded.size).toBe(0);
    expect(result.current.isExpanded("ARG")).toBe(false);
  });

  it("toggle agrega y quita ids", () => {
    const { result } = renderHook(() => useExpandedSections());
    act(() => result.current.toggle("ARG"));
    expect(result.current.isExpanded("ARG")).toBe(true);
    act(() => result.current.toggle("ARG"));
    expect(result.current.isExpanded("ARG")).toBe(false);
  });

  it("permite varias secciones expandidas a la vez", () => {
    const { result } = renderHook(() => useExpandedSections());
    act(() => {
      result.current.toggle("ARG");
      result.current.toggle("BRA");
    });
    expect(result.current.isExpanded("ARG")).toBe(true);
    expect(result.current.isExpanded("BRA")).toBe(true);
    expect(result.current.expanded.size).toBe(2);
  });

  it("collapseAll deja el Set vacio", () => {
    const { result } = renderHook(() => useExpandedSections());
    act(() => {
      result.current.toggle("ARG");
      result.current.toggle("BRA");
    });
    act(() => result.current.collapseAll());
    expect(result.current.expanded.size).toBe(0);
  });
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `pnpm test expandedSections.test`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar store**

Create `src/store/expandedSections.ts`:

```ts
import { create } from "zustand";

interface Store {
  expanded: Set<string>;
  toggle: (sectionId: string) => void;
  isExpanded: (sectionId: string) => boolean;
  collapseAll: () => void;
}

export const useExpandedSections = create<Store>((set, get) => ({
  expanded: new Set<string>(),
  toggle: (sectionId) => {
    const next = new Set(get().expanded);
    if (next.has(sectionId)) next.delete(sectionId);
    else next.add(sectionId);
    set({ expanded: next });
  },
  isExpanded: (sectionId) => get().expanded.has(sectionId),
  collapseAll: () => set({ expanded: new Set<string>() })
}));
```

- [ ] **Step 4: Correr tests**

Run: `pnpm test expandedSections.test`
Expected: PASS — 4 tests pasan.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/store/expandedSections.ts tests/store/expandedSections.test.ts
git commit -m "feat(store): agregar useExpandedSections in-memory

Set de section IDs expandidos. Sin persist — se cierra todo al
reabrir la app para evitar scroll caotico.
"
```

---

### Task 7: Store `useFilterMode` (por sección, in-memory)

**Files:**
- Create: `src/store/filterMode.ts`
- Create: `tests/store/filterMode.test.ts`

- [ ] **Step 1: Escribir tests fallidos**

Create `tests/store/filterMode.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react-native";
import { useFilterMode } from "@/store/filterMode";

describe("useFilterMode", () => {
  beforeEach(() => {
    useFilterMode.setState({ filters: {} });
  });

  it("default es 'all' para secciones no seteadas", () => {
    const { result } = renderHook(() => useFilterMode());
    expect(result.current.getFilter("ARG")).toBe("all");
  });

  it("setFilter cambia el modo para una seccion", () => {
    const { result } = renderHook(() => useFilterMode());
    act(() => result.current.setFilter("ARG", "missing"));
    expect(result.current.getFilter("ARG")).toBe("missing");
    expect(result.current.getFilter("BRA")).toBe("all");
  });
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `pnpm test filterMode.test`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar store**

Create `src/store/filterMode.ts`:

```ts
import { create } from "zustand";
import type { FilterMode } from "@/domain/stickerFilter";

interface Store {
  filters: Record<string, FilterMode>;
  setFilter: (sectionId: string, mode: FilterMode) => void;
  getFilter: (sectionId: string) => FilterMode;
}

export const useFilterMode = create<Store>((set, get) => ({
  filters: {},
  setFilter: (sectionId, mode) =>
    set((state) => ({ filters: { ...state.filters, [sectionId]: mode } })),
  getFilter: (sectionId) => get().filters[sectionId] ?? "all"
}));
```

- [ ] **Step 4: Correr tests**

Run: `pnpm test filterMode.test`
Expected: PASS — 2 tests pasan.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/store/filterMode.ts tests/store/filterMode.test.ts
git commit -m "feat(store): agregar useFilterMode por seccion

Mapa sectionId -> 'all'|'missing'|'dup'. In-memory, default 'all'.
"
```

---

### Task 8: Script para descargar banderas SVG + bundle a TS map

**Files:**
- Create: `scripts/fetch-flags.js`
- Create: `assets/flags/.gitkeep`
- Create: `src/ui/flags/flagMap.ts` (generado por el script)

- [ ] **Step 1: Crear el script de descarga**

Create `scripts/fetch-flags.js`:

```js
#!/usr/bin/env node
// Descarga 48 SVGs de banderas de flagicons.lipis.dev (MIT) y los
// bundlea en src/ui/flags/flagMap.ts.
//
// Mapping FIFA -> ISO-3166-1 alpha-2. Algunos paises tienen codigo FIFA
// distinto al ISO. Esta lista se mantiene a mano.

const fs = require("fs");
const path = require("path");
const https = require("https");

const FIFA_TO_ISO = {
  MEX: "mx", RSA: "za", KOR: "kr", CZE: "cz",
  CAN: "ca", BIH: "ba", QAT: "qa", SUI: "ch",
  BRA: "br", MAR: "ma", HAI: "ht", SCO: "gb-sct",
  USA: "us", PAR: "py", AUS: "au", TUR: "tr",
  GER: "de", CUW: "cw", CIV: "ci", ECU: "ec",
  ESP: "es", FRA: "fr", URU: "uy", COL: "co",
  ARG: "ar", ENG: "gb-eng", JPN: "jp", JOR: "jo",
  POR: "pt", BEL: "be", NED: "nl", SRB: "rs",
  IRN: "ir", ITA: "it", DEN: "dk", IRL: "ie",
  CRC: "cr", EGY: "eg", JAM: "jm", PAN: "pa",
  CRO: "hr", SEN: "sn", SUR: "sr", TRI: "tt",
  WAL: "gb-wls", UZB: "uz", NIR: "gb-nir", NZL: "nz"
};

const BASE_URL = "https://cdn.jsdelivr.net/gh/lipis/flag-icons@latest/flags/4x3";
const OUT_DIR = path.join(__dirname, "..", "assets", "flags");
const OUT_TS = path.join(__dirname, "..", "src", "ui", "flags", "flagMap.ts");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`${url} -> ${res.statusCode}`));
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

(async () => {
  const map = {};
  for (const [fifa, iso] of Object.entries(FIFA_TO_ISO)) {
    const url = `${BASE_URL}/${iso}.svg`;
    process.stdout.write(`Downloading ${fifa} (${iso})... `);
    try {
      const svg = await fetch(url);
      fs.writeFileSync(path.join(OUT_DIR, `${fifa}.svg`), svg);
      map[fifa] = svg.replace(/\s+/g, " ").trim();
      console.log("ok");
    } catch (e) {
      console.log(`FAIL — ${e.message}`);
    }
  }

  // Generar TS map para consumir desde React Native
  const lines = [
    "// Generado por scripts/fetch-flags.js. NO EDITAR A MANO.",
    "// Banderas SVG de flagicons.lipis.dev (MIT License).",
    "",
    "export const FLAG_MAP: Record<string, string> = {"
  ];
  for (const [fifa, svg] of Object.entries(map)) {
    const escaped = svg.replace(/`/g, "\\`").replace(/\$/g, "\\$");
    lines.push(`  ${fifa}: \`${escaped}\`,`);
  }
  lines.push("};");
  lines.push("");

  fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });
  fs.writeFileSync(OUT_TS, lines.join("\n"));
  console.log(`\nWrote ${Object.keys(map).length} flags to ${OUT_TS}`);
})();
```

- [ ] **Step 2: Crear directorios y .gitkeep**

```bash
mkdir -p assets/flags src/ui/flags
touch assets/flags/.gitkeep
```

- [ ] **Step 3: Correr el script**

Run: `node scripts/fetch-flags.js`
Expected: 48 lineas "Downloading XXX (xx)... ok" + "Wrote 48 flags to .../flagMap.ts". Si algun country falla, anotarlo — puede ser que el código ISO sea distinto. Las opciones:
- `gb-sct`, `gb-eng`, `gb-wls`, `gb-nir` son códigos especiales de flag-icons
- Si alguno no existe en el CDN, googlear el ISO real del país

- [ ] **Step 4: Verificar el archivo generado**

```bash
wc -l src/ui/flags/flagMap.ts
head -10 src/ui/flags/flagMap.ts
```
Expected: ~52 líneas, con FIFA codes y SVGs embedded.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-flags.js assets/flags/ src/ui/flags/flagMap.ts
git commit -m "data(flags): descargar 48 banderas FIFA y bundlear a TS map

Script reproducible que baja SVGs de flagicons.lipis.dev (MIT) por
codigo FIFA y los expone en FLAG_MAP. Para regenerar:
  node scripts/fetch-flags.js
"
```

---

### Task 9: Componente `FlagSvg` (renderer)

**Files:**
- Create: `src/ui/flags/FlagSvg.tsx`

- [ ] **Step 1: Implementar el componente**

Create `src/ui/flags/FlagSvg.tsx`:

```tsx
import React from "react";
import { View, Text } from "react-native";
import { SvgXml } from "react-native-svg";
import { FLAG_MAP } from "./flagMap";

interface Props {
  code: string | null;          // FIFA code, o null para especiales
  section?: string;             // requerido si code === null
  size?: number;                // ancho/alto en px; default ocupa el contenedor
}

export function FlagSvg({ code, section, size }: Props) {
  if (code && FLAG_MAP[code]) {
    return (
      <SvgXml
        xml={FLAG_MAP[code]}
        width={size ?? "100%"}
        height={size ?? "100%"}
        preserveAspectRatio="xMidYMid slice"
      />
    );
  }
  // Fallback visual mientras el badge especial todavia no esta listo
  return (
    <View
      style={{
        width: size ?? "100%",
        height: size ?? "100%",
        backgroundColor: "#a8a29e",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
        {code ?? section?.slice(0, 3).toUpperCase() ?? "?"}
      </Text>
    </View>
  );
}
```

> Nota: este componente no muestra los badges especiales (Intro/Extras/Coke) todavía — los agregamos en Task 10. Por ahora, secciones sin `code` mostrarán un placeholder gris con el nombre.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/ui/flags/FlagSvg.tsx
git commit -m "feat(ui): agregar FlagSvg renderer

Renderea SVG de bandera segun codigo FIFA usando react-native-svg.
Especiales (Intro/Extras/Coke) tienen fallback temporal hasta que
agreguemos los badges custom.
"
```

---

### Task 10: Badges especiales (Intro, Extras, Coca-Cola)

**Files:**
- Create: `src/ui/flags/specialBadges/IntroBadge.tsx`
- Create: `src/ui/flags/specialBadges/ExtrasBadge.tsx`
- Create: `src/ui/flags/specialBadges/CokeBadge.tsx`
- Modify: `src/ui/flags/FlagSvg.tsx` (rutearlos)

- [ ] **Step 1: Crear IntroBadge**

Create `src/ui/flags/specialBadges/IntroBadge.tsx`:

```tsx
import React from "react";
import { Svg, Defs, LinearGradient, Stop, Rect, Path } from "react-native-svg";

interface Props { size?: number | string }

export function IntroBadge({ size = "100%" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="introBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fef3c7" />
          <Stop offset="1" stopColor="#f59e0b" />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill="url(#introBg)" />
      {/* Trofeo simplificado */}
      <Path
        d="M30 25 L70 25 L65 55 Q50 65 35 55 Z"
        fill="#92400e"
      />
      <Rect x="44" y="62" width="12" height="10" fill="#92400e" />
      <Rect x="38" y="72" width="24" height="6" fill="#78350f" />
    </Svg>
  );
}
```

- [ ] **Step 2: Crear ExtrasBadge**

Create `src/ui/flags/specialBadges/ExtrasBadge.tsx`:

```tsx
import React from "react";
import { Svg, Rect, Path } from "react-native-svg";

interface Props { size?: number | string }

export function ExtrasBadge({ size = "100%" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width="100" height="100" fill="#1e3a8a" />
      {/* Estrella dorada */}
      <Path
        d="M50 20 L58 42 L82 42 L62 56 L70 78 L50 64 L30 78 L38 56 L18 42 L42 42 Z"
        fill="#fbbf24"
        stroke="#92400e"
        strokeWidth="1"
      />
    </Svg>
  );
}
```

- [ ] **Step 3: Crear CokeBadge**

Create `src/ui/flags/specialBadges/CokeBadge.tsx`:

```tsx
import React from "react";
import { Svg, Rect, Text as SvgText } from "react-native-svg";

interface Props { size?: number | string }

export function CokeBadge({ size = "100%" }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect width="100" height="100" fill="#e60026" />
      <SvgText
        x="50"
        y="60"
        textAnchor="middle"
        fill="#fff"
        fontWeight="700"
        fontStyle="italic"
        fontSize="16"
      >
        Coca-Cola
      </SvgText>
    </Svg>
  );
}
```

- [ ] **Step 4: Rutear desde FlagSvg**

Edit `src/ui/flags/FlagSvg.tsx`:

```tsx
import React from "react";
import { View, Text } from "react-native";
import { SvgXml } from "react-native-svg";
import { FLAG_MAP } from "./flagMap";
import { IntroBadge } from "./specialBadges/IntroBadge";
import { ExtrasBadge } from "./specialBadges/ExtrasBadge";
import { CokeBadge } from "./specialBadges/CokeBadge";

interface Props {
  code: string | null;
  section?: string;
  size?: number;
}

export function FlagSvg({ code, section, size }: Props) {
  if (code && FLAG_MAP[code]) {
    return (
      <SvgXml
        xml={FLAG_MAP[code]}
        width={size ?? "100%"}
        height={size ?? "100%"}
        preserveAspectRatio="xMidYMid slice"
      />
    );
  }
  if (section === "Intro")     return <IntroBadge size={size} />;
  if (section === "Extras")    return <ExtrasBadge size={size} />;
  if (section === "Coca-Cola") return <CokeBadge size={size} />;

  return (
    <View
      style={{
        width: size ?? "100%",
        height: size ?? "100%",
        backgroundColor: "#a8a29e",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
        {code ?? section?.slice(0, 3).toUpperCase() ?? "?"}
      </Text>
    </View>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/ui/flags/specialBadges/ src/ui/flags/FlagSvg.tsx
git commit -m "feat(ui): badges para Intro/Extras/Coca-Cola

SVGs custom hechos a mano para las secciones que no son paises.
Intro: trofeo en gradiente dorado. Extras: estrella sobre navy.
Coca-Cola: logo blanco sobre rojo.
"
```

---

### Task 11: Componente `StatCard` primitiva

**Files:**
- Create: `src/ui/dashboard/StatCard.tsx`

- [ ] **Step 1: Implementar StatCard**

Create `src/ui/dashboard/StatCard.tsx`:

```tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

interface Props {
  label: string;
  value: string;
  sub?: string;
  size?: "sm" | "md";
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function StatCard({ label, value, sub, size = "sm", onPress, accessibilityLabel }: Props) {
  const { theme } = useTheme();
  const Wrapper: any = onPress ? Pressable : View;
  const valueSize = size === "md" ? 26 : 20;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      style={{
        flex: 1,
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 12,
        padding: 10
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: theme.textMute,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 4
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: valueSize,
          fontWeight: "800",
          color: theme.text,
          lineHeight: valueSize * 1.05
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      {sub && (
        <Text
          style={{ fontSize: 11, color: theme.textMute, marginTop: 2 }}
          numberOfLines={1}
        >
          {sub}
        </Text>
      )}
    </Wrapper>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/ui/dashboard/StatCard.tsx
git commit -m "feat(ui): agregar StatCard primitiva

Card reutilizable para el dashboard. Soporta size sm/md, opcional
onPress, sub-text, accessibility.
"
```

---

### Task 12: Componente `DashboardHero`

**Files:**
- Create: `src/ui/dashboard/DashboardHero.tsx`

- [ ] **Step 1: Implementar DashboardHero**

Create `src/ui/dashboard/DashboardHero.tsx`:

```tsx
import React from "react";
import { View, Text } from "react-native";
import { ProgressBar } from "@/ui/ProgressBar";
import { useTheme } from "@/theme/ThemeProvider";
import { progressColor } from "@/theme/progress";

interface Props {
  pct: number;
  collected: number;
  total: number;
}

export function DashboardHero({ pct, collected, total }: Props) {
  const { theme } = useTheme();
  const accent = progressColor(pct, theme);
  const pctLabel = `${Math.round(pct * 100)}%`;

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: theme.textMute,
          textTransform: "uppercase",
          letterSpacing: 0.5
        }}
      >
        Progreso del album
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, marginTop: 4 }}>
        <Text
          style={{
            fontSize: 38,
            fontWeight: "800",
            color: theme.text,
            lineHeight: 42
          }}
        >
          {pctLabel}
        </Text>
        <Text style={{ fontSize: 13, color: theme.textMute }}>
          {collected} / {total} laminas
        </Text>
      </View>
      <View style={{ marginTop: 10 }}>
        <ProgressBar pct={pct} height={6} from={accent} to={accent} />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/ui/dashboard/DashboardHero.tsx
git commit -m "feat(ui): agregar DashboardHero

Card grande con porcentaje 38pt, conteo, y barra de progreso de 6px
con color dinamico segun progresion (rojo->ambar->verde).
"
```

---

### Task 13: Componente `DashboardGrid` (compone todo)

**Files:**
- Create: `src/ui/dashboard/DashboardGrid.tsx`

- [ ] **Step 1: Implementar el grid**

Create `src/ui/dashboard/DashboardGrid.tsx`:

```tsx
import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { DashboardHero } from "./DashboardHero";
import { StatCard } from "./StatCard";
import type { DashboardStats } from "@/domain/stats";

interface Props {
  stats: DashboardStats;
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ms).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function DashboardGrid({ stats }: Props) {
  const router = useRouter();

  const lastAddedValue = stats.lastAdded ? formatRelative(stats.lastAdded.updatedAt) : "—";
  const lastAddedSub = stats.lastAdded?.stickerName ?? "Sin actividad";

  return (
    <View>
      <DashboardHero
        pct={stats.pct}
        collected={stats.collected}
        total={stats.collected + stats.missing}
      />

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <StatCard size="md" label="Me faltan" value={String(stats.missing)} sub="unicas" />
        <StatCard size="md" label="Repes" value={String(stats.duplicates)} sub="extras" />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <StatCard label="Completos" value={String(stats.teamsComplete)} sub="/ 48" />
        <StatCard label="A 1 cromo" value={String(stats.teamsOneAway)} />
        <StatCard label="Sin empezar" value={String(stats.teamsZero)} sub="/ 48" />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <StatCard label="Escudos" value={String(stats.badgesCollected)} sub={`/ ${stats.badgesTotal}`} />
        <StatCard label="Leyendas" value={String(stats.legendsCollected)} sub={`/ ${stats.legendsTotal}`} />
        <StatCard label="Coca-Cola" value={String(stats.cokeCollected)} sub={`/ ${stats.cokeTotal}`} />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <StatCard
          label="Amigos"
          value={String(stats.friendsCount)}
          onPress={() => router.push("/(tabs)/friends" as never)}
        />
        <StatCard
          label="Matches"
          value={String(stats.matchesCount)}
          onPress={() => router.push("/(tabs)/friends" as never)}
        />
        <StatCard label="Ultima" value={lastAddedValue} sub={lastAddedSub} />
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/ui/dashboard/DashboardGrid.tsx
git commit -m "feat(ui): agregar DashboardGrid con las 13 stats

Compone Hero + 2-col (faltan/repes) + 3 filas de 3-col
(equipos/especiales/sociales). Amigos y Matches navegan al tab
de amigos.
"
```

---

### Task 14: `ViewModeToggle` (Compacto/Completo global)

**Files:**
- Create: `src/ui/album/ViewModeToggle.tsx`

- [ ] **Step 1: Implementar el toggle**

Create `src/ui/album/ViewModeToggle.tsx`:

```tsx
import React from "react";
import { View, Pressable, Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { StickerViewMode } from "@/store/stickerViewMode";

interface Props {
  mode: StickerViewMode;
  onChange: (m: StickerViewMode) => void;
}

const OPTIONS: { value: StickerViewMode; label: string }[] = [
  { value: "compact", label: "● Compacto" },
  { value: "full",    label: "▦ Completo" }
];

export function ViewModeToggle({ mode, onChange }: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: theme.surface ?? theme.card,
        borderRadius: 10,
        padding: 3,
        marginVertical: 12
      }}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === mode;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: active ? theme.card : "transparent",
              alignItems: "center"
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: active ? theme.text : theme.textMute
              }}
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

> Nota: si `theme.surface` no existe (no lo verificamos antes), usar `theme.card` directamente. Ajustar si el typecheck o el visual lo requiere.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores. Si falla por `theme.surface`, reemplazar por `theme.card` y un color hardcoded muy similar.

- [ ] **Step 3: Commit**

```bash
git add src/ui/album/ViewModeToggle.tsx
git commit -m "feat(ui): agregar ViewModeToggle (Compacto/Completo)

Toggle horizontal estilo segmented. Se conecta al store
useStickerViewMode (persiste entre sesiones).
"
```

---

### Task 15: `FilterChips` (Todos/Faltan/Repes por colapsible)

**Files:**
- Create: `src/ui/album/FilterChips.tsx`

- [ ] **Step 1: Implementar chips**

Create `src/ui/album/FilterChips.tsx`:

```tsx
import React from "react";
import { View, Pressable, Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import type { FilterMode } from "@/domain/stickerFilter";

interface Props {
  counts: { all: number; missing: number; dup: number };
  active: FilterMode;
  onChange: (mode: FilterMode) => void;
}

export function FilterChips({ counts, active, onChange }: Props) {
  const { theme } = useTheme();

  const chips: { mode: FilterMode; label: string; count: number }[] = [
    { mode: "all",     label: "Todos",  count: counts.all },
    { mode: "missing", label: "Faltan", count: counts.missing },
    { mode: "dup",     label: "Repes",  count: counts.dup }
  ];

  return (
    <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
      {chips.map((c) => {
        const isActive = c.mode === active;
        return (
          <Pressable
            key={c.mode}
            onPress={() => onChange(c.mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${c.label}, ${c.count} cromos`}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: isActive ? theme.text : theme.card,
              borderWidth: 1,
              borderColor: isActive ? theme.text : theme.border
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: isActive ? theme.bg : theme.textMute
              }}
            >
              {c.label} · {c.count}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/ui/album/FilterChips.tsx
git commit -m "feat(ui): agregar FilterChips para colapsibles

Tres chips Todos/Faltan/Repes con conteo. Active usa theme.text como
background; inactive theme.card.
"
```

---

### Task 16: `StickerBolita` (modo compacto)

**Files:**
- Create: `src/ui/album/StickerBolita.tsx`

- [ ] **Step 1: Implementar la bolita**

Create `src/ui/album/StickerBolita.tsx`:

```tsx
import React, { useCallback } from "react";
import { View, Pressable, Text } from "react-native";
import { FlagSvg } from "@/ui/flags/FlagSvg";
import { haptics } from "@/lib/haptics";
import { useIncrement, useDecrement } from "@/hooks/useStickers";
import type { StickerWithStatus } from "@/domain/types";

interface Props {
  sticker: StickerWithStatus;
  teamCode: string | null;
}

export function StickerBolita({ sticker, teamCode }: Props) {
  const inc = useIncrement();
  const dec = useDecrement();

  const handlePress = useCallback(() => {
    haptics.light();
    inc.mutate(sticker.code);
  }, [sticker.code, inc]);

  const handleLongPress = useCallback(() => {
    if (sticker.count === 0) return;
    haptics.medium();
    dec.mutate(sticker.code);
  }, [sticker.code, sticker.count, dec]);

  const isMissing = sticker.count === 0;
  const hasDups = sticker.count > 1;

  return (
    <View style={{ width: "20%", padding: 4 }}>
      <View style={{ position: "relative", aspectRatio: 1 }}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={`${sticker.name}, ${
            isMissing ? "falta" : hasDups ? `repetida ${sticker.count}` : "pegada"
          }`}
          accessibilityHint="Toca para sumar, manten para restar"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 9999,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: "rgba(0,0,0,0.1)"
          }}
        >
          <FlagSvg code={teamCode} section={sticker.section} />
          {isMissing && (
            <View
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(120, 113, 108, 0.55)"
              }}
              pointerEvents="none"
            />
          )}
          <View
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: [{ translateX: -22 }, { translateY: -9 }],
              backgroundColor: "#fff",
              borderRadius: 999,
              paddingHorizontal: 6,
              paddingVertical: 2,
              minWidth: 44,
              alignItems: "center"
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: "800", color: "#1c1917" }}>
              {sticker.code}
            </Text>
          </View>
        </Pressable>
        {hasDups && (
          <View
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              backgroundColor: "#ea580c",
              borderRadius: 999,
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderWidth: 2,
              borderColor: "#fff",
              zIndex: 2
            }}
          >
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
              ×{sticker.count}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores. Si `haptics.medium` no existe, usar `haptics.light` o agregarlo a `src/lib/haptics.ts` (1 línea).

- [ ] **Step 3: Commit**

```bash
git add src/ui/album/StickerBolita.tsx
git commit -m "feat(ui): agregar StickerBolita (modo compacto)

Circulo con bandera SVG de fondo + pill blanco al centro con el
codigo. Tap = +1, long press 350ms = -1. Estados: full color (have),
overlay gris (missing), badge xN (dups). Badge fuera del overflow
para que sobresalga.
"
```

---

### Task 17: `StickerFullCard` (modo completo con foto/iniciales)

**Files:**
- Create: `src/ui/album/StickerFullCard.tsx`

- [ ] **Step 1: Implementar la card**

Create `src/ui/album/StickerFullCard.tsx`:

```tsx
import React, { useCallback } from "react";
import { View, Pressable, Text, Image } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { haptics } from "@/lib/haptics";
import { useIncrement, useDecrement } from "@/hooks/useStickers";
import { getInitials } from "@/domain/playerInitials";
import { getTeamColors } from "@/theme/teamColors";
import type { StickerWithStatus } from "@/domain/types";

interface Props {
  sticker: StickerWithStatus;
  teamCode: string | null;
}

export function StickerFullCard({ sticker, teamCode }: Props) {
  const { theme } = useTheme();
  const inc = useIncrement();
  const dec = useDecrement();

  const handlePress = useCallback(() => {
    haptics.light();
    inc.mutate(sticker.code);
  }, [sticker.code, inc]);

  const handleLongPress = useCallback(() => {
    if (sticker.count === 0) return;
    haptics.medium();
    dec.mutate(sticker.code);
  }, [sticker.code, sticker.count, dec]);

  const isMissing = sticker.count === 0;
  const hasDups = sticker.count > 1;
  const teamColors = teamCode ? getTeamColors(teamCode) : null;
  const photoBg = teamColors?.bg ?? theme.accent;

  return (
    <View style={{ width: "33.333%", padding: 3 }}>
      <View style={{ position: "relative" }}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={`${sticker.name}, ${
            isMissing ? "falta" : hasDups ? `repetida ${sticker.count}` : "pegada"
          }`}
          accessibilityHint="Toca para sumar, manten para restar"
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            padding: 6,
            aspectRatio: 3 / 4,
            alignItems: "center",
            opacity: isMissing ? 0.45 : 1
          }}
        >
          <Text
            style={{
              fontSize: 9,
              color: theme.textMute,
              fontWeight: "700",
              alignSelf: "flex-start"
            }}
            numberOfLines={1}
          >
            {sticker.code}
          </Text>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              backgroundColor: photoBg,
              alignItems: "center",
              justifyContent: "center",
              marginVertical: 6,
              overflow: "hidden"
            }}
          >
            {sticker.imageUrl ? (
              <Image
                source={{ uri: sticker.imageUrl }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>
                {getInitials(sticker.name)}
              </Text>
            )}
          </View>
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: theme.text,
              textAlign: "center",
              lineHeight: 12
            }}
            numberOfLines={2}
          >
            {sticker.name}
          </Text>
        </Pressable>
        {hasDups && (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              backgroundColor: "#ea580c",
              borderRadius: 999,
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderWidth: 2,
              borderColor: "#fff",
              zIndex: 2
            }}
          >
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
              ×{sticker.count}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/ui/album/StickerFullCard.tsx
git commit -m "feat(ui): agregar StickerFullCard (modo completo)

Card 3:4 con codigo arriba, foto/iniciales 56x56 con fondo del color
del equipo, nombre abajo. Mismos gestures que la bolita. Si
imageUrl != null usa la foto, si no usa getInitials().
"
```

---

### Task 18: `SectionCollapsible` (compone todo)

**Files:**
- Create: `src/ui/album/SectionCollapsible.tsx`

- [ ] **Step 1: Implementar el colapsible**

Create `src/ui/album/SectionCollapsible.tsx`:

```tsx
import React, { useMemo } from "react";
import { View, Pressable, Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { ProgressBar } from "@/ui/ProgressBar";
import { FlagSvg } from "@/ui/flags/FlagSvg";
import { FilterChips } from "./FilterChips";
import { StickerBolita } from "./StickerBolita";
import { StickerFullCard } from "./StickerFullCard";
import { filterStickers, countByFilter, type FilterMode } from "@/domain/stickerFilter";
import { haptics } from "@/lib/haptics";
import { getTeamColors } from "@/theme/teamColors";
import type { StickerViewMode } from "@/store/stickerViewMode";
import type { StickerWithStatus } from "@/domain/types";
import type { AlbumSection } from "@/domain/albumOrder";

interface Props {
  section: AlbumSection<StickerWithStatus>;
  expanded: boolean;
  filterMode: FilterMode;
  viewMode: StickerViewMode;
  onToggle: () => void;
  onChangeFilter: (mode: FilterMode) => void;
}

export function SectionCollapsible({
  section,
  expanded,
  filterMode,
  viewMode,
  onToggle,
  onChangeFilter
}: Props) {
  const { theme } = useTheme();

  const teamColors = section.teamCode ? getTeamColors(section.teamCode) : null;
  const bandColor = teamColors?.bg ?? theme.accent;

  const counts = useMemo(() => countByFilter(section.stickers), [section.stickers]);
  const filtered = useMemo(
    () => filterStickers(section.stickers, filterMode),
    [section.stickers, filterMode]
  );

  const collected = counts.all - counts.missing;

  return (
    <View style={{ marginBottom: 8 }}>
      <Pressable
        onPress={() => {
          haptics.light();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${section.name}, ${collected} de ${counts.all}, ${
          expanded ? "expandido" : "colapsado"
        }`}
        style={{
          flexDirection: "row",
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: expanded ? 10 : 10,
          borderBottomLeftRadius: expanded ? 0 : 10,
          borderBottomRightRadius: expanded ? 0 : 10,
          overflow: "hidden",
          alignItems: "center"
        }}
      >
        <View style={{ width: 5, height: 48, backgroundColor: bandColor }} />
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            overflow: "hidden",
            marginHorizontal: 10
          }}
        >
          <FlagSvg code={section.teamCode} section={section.name} />
        </View>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700" }} numberOfLines={1}>
            {section.name}
          </Text>
          <View style={{ marginTop: 4 }}>
            <ProgressBar pct={collected / counts.all} height={2} from={bandColor} to={bandColor} />
          </View>
        </View>
        <Text style={{ color: theme.textMute, fontSize: 12, marginRight: 12 }}>
          {collected}/{counts.all} {expanded ? "⌄" : "›"}
        </Text>
      </Pressable>

      {expanded && (
        <View
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderTopWidth: 0,
            borderColor: theme.border,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            padding: 10
          }}
        >
          <FilterChips counts={counts} active={filterMode} onChange={onChangeFilter} />

          {filtered.length === 0 ? (
            <Text
              style={{
                color: theme.textMute,
                fontSize: 13,
                textAlign: "center",
                paddingVertical: 12
              }}
            >
              {filterMode === "missing"
                ? "¡Sin faltantes! Equipo completo."
                : filterMode === "dup"
                ? "Sin repes de este equipo."
                : "No hay cromos para mostrar."}
            </Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 }}>
              {filtered.map((s) =>
                viewMode === "compact" ? (
                  <StickerBolita key={s.code} sticker={s} teamCode={section.teamCode} />
                ) : (
                  <StickerFullCard key={s.code} sticker={s} teamCode={section.teamCode} />
                )
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/ui/album/SectionCollapsible.tsx
git commit -m "feat(ui): agregar SectionCollapsible

Header con banda lateral + bandera circular + nombre + contador +
mini barra. Body (si expanded) con FilterChips + grid de Bolita o
FullCard segun viewMode. Empty state cuando el filtro no matchea.
"
```

---

### Task 19: Reescribir `app/(tabs)/index.tsx` con dashboard + FlashList

**Files:**
- Modify: `app/(tabs)/index.tsx` (reescritura completa)

- [ ] **Step 1: Reescribir Home**

Replace contents of `app/(tabs)/index.tsx`:

```tsx
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { Skeleton } from "@/ui/Skeleton";
import { DashboardGrid } from "@/ui/dashboard/DashboardGrid";
import { ViewModeToggle } from "@/ui/album/ViewModeToggle";
import { SectionCollapsible } from "@/ui/album/SectionCollapsible";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useAlbumStickers } from "@/hooks/useStickers";
import { useStickerViewMode } from "@/store/stickerViewMode";
import { useExpandedSections } from "@/store/expandedSections";
import { useFilterMode } from "@/store/filterMode";
import { useTheme } from "@/theme/ThemeProvider";
import type { AlbumSection } from "@/domain/albumOrder";
import type { StickerWithStatus } from "@/domain/types";

export default function Home() {
  const insets = useSafeAreaInsets();
  const { theme, mode, setMode } = useTheme();
  const dashboard = useDashboardStats();
  const album = useAlbumStickers();
  const viewMode = useStickerViewMode((s) => s.mode);
  const setViewMode = useStickerViewMode((s) => s.setMode);

  const expanded = useExpandedSections((s) => s.expanded);
  const toggleSection = useExpandedSections((s) => s.toggle);

  const filters = useFilterMode((s) => s.filters);
  const setFilter = useFilterMode((s) => s.setFilter);
  const getFilter = useFilterMode((s) => s.getFilter);

  // Deep link: /?expand=ARG
  const params = useLocalSearchParams<{ expand?: string }>();
  const listRef = useRef<FlashListRef<AlbumSection<StickerWithStatus>>>(null);
  useEffect(() => {
    if (!params.expand || !album.data) return;
    const idx = album.data.findIndex((s) => s.id === params.expand);
    if (idx >= 0) {
      const id = album.data[idx].id;
      if (!expanded.has(id)) toggleSection(id);
      listRef.current?.scrollToIndex({ index: idx, animated: true });
    }
  }, [params.expand, album.data]);

  const sections = useMemo(() => album.data ?? [], [album.data]);

  const renderHeader = useCallback(
    () => (
      <View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12
          }}
        >
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800" }}>Mi Album</Text>
          <Pressable
            onPress={() => setMode(mode === "dark" ? "light" : "dark")}
            accessibilityRole="button"
            accessibilityLabel="Cambiar tema"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text style={{ color: theme.text, fontSize: 16 }}>
              {mode === "dark" ? "☾" : "☀"}
            </Text>
          </Pressable>
        </View>

        {dashboard.stats ? (
          <DashboardGrid stats={dashboard.stats} />
        ) : (
          <View>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ height: 60, marginBottom: 8 }} />
            ))}
          </View>
        )}

        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </View>
    ),
    [theme, mode, setMode, dashboard.stats, viewMode, setViewMode]
  );

  if (album.isLoading || sections.length === 0) {
    return (
      <ThemedBackground>
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16 }}>
          {renderHeader()}
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 60, marginBottom: 8 }} />
          ))}
        </View>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground>
      <FlashList
        ref={listRef}
        data={sections}
        keyExtractor={(s) => s.id}
        estimatedItemSize={64}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <SectionCollapsible
            section={item}
            expanded={expanded.has(item.id)}
            filterMode={getFilter(item.id)}
            viewMode={viewMode}
            onToggle={() => toggleSection(item.id)}
            onChangeFilter={(m) => setFilter(item.id, m)}
          />
        )}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 32
        }}
      />
    </ThemedBackground>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Smoke test manual**

Run: `pnpm start` y abrir en el simulador iOS o device físico:

```bash
pnpm start
```

Verificar:
- Dashboard se ve con todas las 13 stats (algunas en 0 si la base está vacía).
- Lista de 51 colapsibles aparece bajo el ViewModeToggle.
- Tap en un colapsible lo expande, muestra bolitas con bandera (modo compacto).
- Toggle a "Completo" → grid de cards con iniciales en vez de fotos.
- Tap en una bolita → suma +1 (badge ×2 aparece).
- Long press → resta.
- Chips Todos/Faltan/Repes filtran solo ese equipo.
- Cerrar y reabrir app → toggle Completo/Compacto se mantuvo, secciones cerradas, filtros reseteados.

Si todo OK, continuar.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat(home): reescribir Home con dashboard + colapsibles FlashList

Dashboard de 13 stats arriba, ViewModeToggle, y FlashList con 51
SectionCollapsibles. Acepta deep link /?expand=<sectionId>.
Reemplaza la grilla/lista navegable anterior.
"
```

---

### Task 20: Migrar referencias a `/album/[code]` con deep link `?expand=`

**Files:**
- Modify: `app/friends/[username].tsx:195` y `:202`

- [ ] **Step 1: Encontrar y reemplazar referencias**

Run primero:
```bash
grep -rn "router.push.*album/" app src --include="*.tsx" --include="*.ts"
```
Expected: solo aparece en `app/friends/[username].tsx` (las 2 referencias en index.tsx ya las eliminamos al reescribirla).

- [ ] **Step 2: Reemplazar en `app/friends/[username].tsx`**

Buscar las dos líneas que tienen `router.push(\`/album/${code}\` as never)` y reemplazar por:

```tsx
onTeamPress={(code) => router.push(`/?expand=${encodeURIComponent(code)}` as never)}
```

Hacer este reemplazo en las dos ocurrencias (línea 195 y 202 aproximadamente).

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Smoke test manual**

`pnpm start`, ir a tab Amigos → tap en un amigo → tocar un equipo en su lista → debería volver al Home con ese equipo expandido y scroll hasta él.

- [ ] **Step 5: Commit**

```bash
git add app/friends/\[username\].tsx
git commit -m "fix(friends): redirigir onTeamPress a /?expand=

Reemplaza las navegaciones a /album/[code] (que ya no existe) por el
deep link del nuevo Home. encodeURIComponent porque seccion especiales
pueden tener caracteres especiales (Coca-Cola tiene guion).
"
```

---

### Task 21: Cleanup — borrar archivos obsoletos

**Files:**
- Delete: `app/album/[id].tsx`
- Delete: `app/album/` (directorio si queda vacío)
- Delete: `src/ui/AlbumScroll.tsx`
- Delete: `src/domain/albumOrder.ts`
- Delete: `tests/domain/albumOrder.test.ts`
- Delete: `src/ui/ViewToggle.tsx`
- Modify: `src/hooks/useStickers.ts` (mover `buildAlbumOrder` inline o reescribirlo)

> Atención: `src/domain/albumOrder.ts` exporta `buildAlbumOrder` que **sí** sigue usándose en `useAlbumStickers` (hook activo). NO borrar este archivo todavía. Solo borrar `findSectionIndex` que solo usa AlbumScroll.

- [ ] **Step 1: Verificar uso actual de `findSectionIndex`**

Run: `grep -rn "findSectionIndex" src app`
Expected: solo en `src/ui/AlbumScroll.tsx` y `src/domain/albumOrder.ts`. Si aparece en otro lugar, NO borrar.

- [ ] **Step 2: Borrar `AlbumScroll`, `app/album/`**

```bash
rm src/ui/AlbumScroll.tsx
rm -rf app/album/
```

- [ ] **Step 3: Limpiar `albumOrder.ts` — sacar `findSectionIndex`**

Edit `src/domain/albumOrder.ts` — eliminar la función `findSectionIndex` y su comentario JSDoc. Dejar solo `AlbumSection` interface y `buildAlbumOrder` function.

- [ ] **Step 4: Borrar `ViewToggle`**

Run: `grep -rn "ViewToggle\b" src app --include="*.tsx" --include="*.ts"`
Expected: vacío (ya borramos index.tsx que lo usaba). Si aparece, eliminar también esos usos.

```bash
rm src/ui/ViewToggle.tsx
rm -f src/lib/viewMode.ts   # si existe — ver paso 5
```

- [ ] **Step 5: Borrar `useViewMode` si quedó huérfano**

Run: `grep -rn "useViewMode" src app --include="*.tsx" --include="*.ts"`
Expected: vacío. Si aparece, ese helper no se elimina; revisar.

Si `src/lib/viewMode.ts` no existe ya, ignorar.

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: sin errores. Si falla por algo importado pero borrado, revisar el grep del paso anterior — algo quedó referenciando.

- [ ] **Step 7: Tests**

Run: `pnpm test`
Expected: pasan todos (excepto `albumOrder.test.ts` que vamos a borrar a continuación).

- [ ] **Step 8: Borrar test obsoleto**

Run: `grep -rn "findSectionIndex" tests` — verificar si el test lo cubre.
Si el test cubre tanto `buildAlbumOrder` como `findSectionIndex`, refactor — sacar solo los tests de `findSectionIndex`.
Si cubre solo `findSectionIndex`, borrar el archivo. Caso típico: dejarlo, ya cubre `buildAlbumOrder` que aún se usa.

Verificar nuevamente:
```bash
pnpm test albumOrder.test
```
Expected: pasa (verifica `buildAlbumOrder`).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore(cleanup): borrar AlbumScroll, ruta /album/[id], ViewToggle

El Home reescrito reemplaza estas vistas con colapsibles inline.
buildAlbumOrder queda porque lo sigue usando useAlbumStickers;
findSectionIndex se elimina (solo lo usaba AlbumScroll).
"
```

---

### Task 22: Bumpear versión y validar final

**Files:**
- Modify: `app.json` (version + android.versionCode)
- Modify: `package.json` (version)

- [ ] **Step 1: Bumpear `app.json`**

Edit `app.json` — cambiar:
```json
{
  "expo": {
    "version": "1.0.2",
    ...
    "android": {
      "versionCode": 7,
      ...
    }
  }
}
```
A:
```json
{
  "expo": {
    "version": "1.1.0",
    ...
    "android": {
      "versionCode": 8,
      ...
    }
  }
}
```

- [ ] **Step 2: Bumpear `package.json`**

Edit `package.json` — cambiar `"version": "1.0.2"` (o el valor actual) a `"version": "1.1.0"`.

- [ ] **Step 3: Validar final**

```bash
pnpm test                  # ~55 tests + los nuevos pasan
pnpm exec tsc --noEmit     # sin errores
```

- [ ] **Step 4: Smoke test completo**

`pnpm start` y verificar el checklist completo del Section 12 del spec:

- [ ] Tap rápido sobre bolitas en cadena → counters se actualizan, no se traba.
- [ ] Long press sobre bolita en `count === 0` → no-op, no baja a -1.
- [ ] Toggle Compacto ↔ Completo → cambia todas las bolitas/cards a la vez.
- [ ] Cerrar app y reabrir → toggle se mantiene; colapsibles vuelven a cerrados.
- [ ] Filtro "Faltan" en equipo completo → muestra mensaje vacío sin romper.
- [ ] Deep link `/?expand=ARG` (desde MatchCard o navegar manualmente) → abre Argentina expandido y scrollea a él.
- [ ] App offline → tap/long press siguen funcionando (cache local), encolan a sync_queue.
- [ ] Modo light y dark — verificar visualmente que ambos se ven bien.

- [ ] **Step 5: Commit final de release**

```bash
git add app.json package.json
git commit -m "chore(release): 1.1.0 — home dashboard + colapsibles

Cambio de UI mayor en el Home tab. Ver spec
docs/superpowers/specs/2026-05-18-home-dashboard-collapsibles-design.md
"
```

---

## Checklist final

Antes de mergear/desplegar:

- [ ] Todos los tests pasan (`pnpm test`)
- [ ] TypeScript clean (`pnpm exec tsc --noEmit`)
- [ ] Smoke test manual completo (Task 22 Step 4)
- [ ] No quedan referencias a `/album/[id]` o `/album/[code]`:
  ```bash
  grep -rn "album/\[" app src
  grep -rn "/album/" app src
  ```
- [ ] No quedan referencias a `AlbumScroll`, `findSectionIndex`, `ViewToggle`:
  ```bash
  grep -rn "AlbumScroll\|findSectionIndex\|ViewToggle" app src
  ```
- [ ] iOS: reinstalar desde Xcode con signing free.
- [ ] (Opcional) recortar 4-5 fotos de jugadores del PDF leaked para probar el modo Completo con `imageUrl` real — actualizar en `gen-stickers.js` o directamente en `assets/stickers.json`, bumpear version a 8 para que la app re-siembre.
