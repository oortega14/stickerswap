# Compartir lista — Formato por equipo con banderas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el formato actual de lista para compartir (agrupado por section, sin UI conectada) por uno agrupado por código FIFA + emoji bandera, accesible vía FAB en la pestaña Amigos que abre un modal con preview + Copiar/Compartir.

**Architecture:** El dominio se queda con dos funciones puras (`buildTradeList` extendida con `team`, `formatTradeListByTeam` nueva) más un nuevo módulo `teamFlags.ts` con el mapa estático FIFA→emoji. La UI vive en dos componentes presentacionales (`ShareListFab`, `ShareListModal`) montados en `app/(tabs)/friends.tsx` por fuera del ScrollView. Un hook `useShareList` (reemplaza `useMyList`) compone los datos.

**Tech Stack:** TypeScript strict, React Native 0.81 (Share API nativo), Expo SDK 54, NativeWind v4, Zustand (no se agrega — se borra `useTradePrefs`), TanStack Query, expo-clipboard (ya instalado), Jest + jest-expo.

**Spec:** `docs/superpowers/specs/2026-05-13-share-trade-list-redesign-design.md`

---

## File Structure

**Crear:**
- `src/domain/teamFlags.ts` — mapa estático `FIFA_TO_FLAG: Record<string,string>` + `flagFor(code)` helper.
- `src/hooks/useShareList.ts` — query hook que arma `text` listo para compartir.
- `src/ui/ShareListFab.tsx` — botón flotante "Compartir lista" para la pestaña Amigos.
- `src/ui/ShareListModal.tsx` — modal con preview + botones Copiar/Compartir.
- `tests/domain/teamFlags.test.ts` — tests del mapa + función.

**Modificar:**
- `src/domain/types.ts` — agregar `team: string | null` a `TradeListEntry`; borrar `TradeFormatOptions`.
- `src/domain/tradeList.ts` — `buildTradeList` puebla `team`; reemplazar `formatTradeListAsText` por `formatTradeListByTeam`.
- `tests/domain/tradeList.test.ts` — actualizar tests existentes; agregar suite para `formatTradeListByTeam`.
- `app/(tabs)/friends.tsx` — montar FAB + Modal; ajustar `paddingBottom` del ScrollView.

**Borrar:**
- `src/hooks/useMyList.ts` (sin consumidores tras Task 5).
- `src/store/tradePreferences.ts` (sin consumidores tras Task 4).

---

## Task 1: Extender `TradeListEntry` con `team` y actualizar `buildTradeList`

**Files:**
- Modify: `src/domain/types.ts:38-43`
- Modify: `src/domain/tradeList.ts:3-23`
- Modify: `tests/domain/tradeList.test.ts` (suite `describe("buildTradeList")`)

- [ ] **Step 1: Actualizar el test existente para esperar `team` en cada entry**

Editar `tests/domain/tradeList.test.ts`. Dentro del bloque `describe("buildTradeList")`, reemplazar el test `"classifies as duplicates when count > 1"` por esta versión que también verifica `team`:

```ts
  it("classifies as duplicates when count > 1 and propagates team", () => {
    const statuses: StickerStatus[] = [
      { stickerCode: "ARG-1", count: 2, updatedAt: 1 },
      { stickerCode: "ARG-2", count: 1, updatedAt: 1 }
    ];
    const r = buildTradeList(stickers, statuses);
    expect(r.needed.map((e) => e.code).sort()).toEqual(["ARG-3", "BRA-1", "STAD-1"]);
    expect(r.duplicates.map((e) => e.code)).toEqual(["ARG-1"]);
    expect(r.duplicates[0].count).toBe(2);
    expect(r.duplicates[0].team).toBe("ARG");
    const stad = r.needed.find((e) => e.code === "STAD-1")!;
    expect(stad.team).toBeNull();
  });
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm test tests/domain/tradeList.test.ts -t "propagates team"`
Expected: FAIL — `r.duplicates[0].team` será `undefined` (la propiedad no existe en el tipo todavía).

- [ ] **Step 3: Agregar `team` al tipo `TradeListEntry`**

En `src/domain/types.ts`, reemplazar el bloque actual de `TradeListEntry`:

```ts
export interface TradeListEntry {
  code: string;
  number: number;
  section: string;
  team: string | null;
  count: number;     // 0 si falta, >1 si es repetida
}
```

- [ ] **Step 4: Poblar `team` en `buildTradeList`**

En `src/domain/tradeList.ts`, dentro del loop `for (const s of stickers)`, reemplazar la construcción del entry:

```ts
    const entry: TradeListEntry = {
      code: s.code,
      number: s.number,
      section: s.section,
      team: s.team,
      count
    };
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `pnpm test tests/domain/tradeList.test.ts -t "propagates team"`
Expected: PASS.

- [ ] **Step 6: Correr la suite completa de tradeList**

Run: `pnpm test tests/domain/tradeList.test.ts`
Expected: tests de `buildTradeList` pasan; tests de `formatTradeListAsText` siguen pasando (todavía no los tocamos).

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/tradeList.ts tests/domain/tradeList.test.ts
git commit -m "refactor(domain): TradeListEntry incluye team para agrupar por código FIFA

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Crear `teamFlags.ts` con mapa y helper `flagFor`

**Files:**
- Create: `src/domain/teamFlags.ts`
- Create: `tests/domain/teamFlags.test.ts`

- [ ] **Step 1: Escribir el test que verifica el contenido y el helper**

Crear `tests/domain/teamFlags.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIFA_TO_FLAG, flagFor } from "@/domain/teamFlags";

describe("teamFlags", () => {
  it("incluye una bandera para los 48 códigos FIFA del dataset", () => {
    const raw = readFileSync(join(__dirname, "..", "..", "assets", "stickers.json"), "utf8");
    const data: { stickers: { team: string | null }[] } = JSON.parse(raw);
    const codes = new Set(
      data.stickers.map((s) => s.team).filter((t): t is string => t != null)
    );
    expect(codes.size).toBe(48);
    for (const code of codes) {
      expect(FIFA_TO_FLAG[code]).toBeDefined();
      expect(FIFA_TO_FLAG[code].length).toBeGreaterThan(0);
    }
  });

  it("flagFor devuelve emoji para código conocido", () => {
    expect(flagFor("ARG")).toBe(FIFA_TO_FLAG.ARG);
    expect(flagFor("KOR")).toBe(FIFA_TO_FLAG.KOR);
  });

  it("flagFor devuelve string vacío para código desconocido o null", () => {
    expect(flagFor("XYZ")).toBe("");
    expect(flagFor(null)).toBe("");
    expect(flagFor(undefined)).toBe("");
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm test tests/domain/teamFlags.test.ts`
Expected: FAIL — el módulo `@/domain/teamFlags` no existe.

- [ ] **Step 3: Crear `src/domain/teamFlags.ts`**

```ts
// Mapa estático código FIFA → emoji bandera para los 48 equipos del
// Mundial 2026. Los emojis son secuencias de Regional Indicator Symbols
// (o subtag para ENG/SCO) que renderizan en iOS 14+ y Android 11+.
export const FIFA_TO_FLAG: Record<string, string> = {
  ALG: "🇩🇿", ARG: "🇦🇷", AUS: "🇦🇺", AUT: "🇦🇹",
  BEL: "🇧🇪", BIH: "🇧🇦", BRA: "🇧🇷", CAN: "🇨🇦",
  CIV: "🇨🇮", COD: "🇨🇩", COL: "🇨🇴", CPV: "🇨🇻",
  CRO: "🇭🇷", CUW: "🇨🇼", CZE: "🇨🇿", ECU: "🇪🇨",
  EGY: "🇪🇬", ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ESP: "🇪🇸", FRA: "🇫🇷",
  GER: "🇩🇪", GHA: "🇬🇭", HAI: "🇭🇹", IRN: "🇮🇷",
  IRQ: "🇮🇶", JOR: "🇯🇴", JPN: "🇯🇵", KOR: "🇰🇷",
  KSA: "🇸🇦", MAR: "🇲🇦", MEX: "🇲🇽", NED: "🇳🇱",
  NOR: "🇳🇴", NZL: "🇳🇿", PAN: "🇵🇦", PAR: "🇵🇾",
  POR: "🇵🇹", QAT: "🇶🇦", RSA: "🇿🇦", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  SEN: "🇸🇳", SUI: "🇨🇭", SWE: "🇸🇪", TUN: "🇹🇳",
  TUR: "🇹🇷", URU: "🇺🇾", USA: "🇺🇸", UZB: "🇺🇿"
};

export function flagFor(fifaCode: string | null | undefined): string {
  if (!fifaCode) return "";
  return FIFA_TO_FLAG[fifaCode] ?? "";
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm test tests/domain/teamFlags.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/teamFlags.ts tests/domain/teamFlags.test.ts
git commit -m "feat(domain): mapa FIFA→emoji bandera para los 48 equipos

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Implementar `formatTradeListByTeam` (TDD, múltiples casos)

**Files:**
- Modify: `src/domain/tradeList.ts`
- Modify: `tests/domain/tradeList.test.ts`

- [ ] **Step 1: Escribir el test para el caso "álbum completo"**

Al final de `tests/domain/tradeList.test.ts`, agregar el bloque (debajo del bloque existente de `formatTradeListAsText`):

```ts
import { formatTradeListByTeam } from "@/domain/tradeList";

describe("formatTradeListByTeam", () => {
  it("devuelve mensaje de álbum completo cuando no hay faltantes ni repes", () => {
    const text = formatTradeListByTeam(
      { needed: [], duplicates: [] },
      { username: "oscar" }
    );
    expect(text).toBe("Tu álbum está completo 🎉");
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `pnpm test tests/domain/tradeList.test.ts -t "álbum completo"`
Expected: FAIL — `formatTradeListByTeam` no existe.

- [ ] **Step 3: Crear el esqueleto de la función**

En `src/domain/tradeList.ts`, agregar al final del archivo (después de `formatTradeListAsText`, que todavía no borramos):

```ts
import { flagFor } from "./teamFlags";

const NON_TEAM_SECTION_ORDER = ["Intro", "Extras", "Coca-Cola"] as const;

export function formatTradeListByTeam(
  list: TradeList,
  opts: { username: string | null }
): string {
  if (list.needed.length === 0 && list.duplicates.length === 0) {
    return "Tu álbum está completo 🎉";
  }
  // Resto se completa en pasos siguientes.
  return "";
}
```

Nota: el `import` de `flagFor` debe moverse al top del archivo si TypeScript se queja; en este caso es mejor moverlo arriba de una. Movelo a la zona de imports al inicio del archivo.

- [ ] **Step 4: Correr para verificar que el test pasa**

Run: `pnpm test tests/domain/tradeList.test.ts -t "álbum completo"`
Expected: PASS.

- [ ] **Step 5: Test para header con username**

Agregar dentro del mismo `describe("formatTradeListByTeam", ...)`:

```ts
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
```

- [ ] **Step 6: Correr para verificar que falla**

Run: `pnpm test tests/domain/tradeList.test.ts -t "header con app"`
Expected: FAIL — la función actual retorna `""`.

- [ ] **Step 7: Implementar el header**

Reemplazar el cuerpo de `formatTradeListByTeam` por:

```ts
export function formatTradeListByTeam(
  list: TradeList,
  opts: { username: string | null }
): string {
  if (list.needed.length === 0 && list.duplicates.length === 0) {
    return "Tu álbum está completo 🎉";
  }
  const header = opts.username
    ? `stickerSwap · Mundial 2026 — @${opts.username}`
    : "stickerSwap · Mundial 2026";
  const lines: string[] = [header, ""];

  if (list.needed.length > 0) {
    lines.push("Me faltan*");
    lines.push(...renderBlock(list.needed, "needed"));
  }
  if (list.duplicates.length > 0) {
    if (list.needed.length > 0) lines.push("");
    lines.push("Tengo repes*");
    lines.push(...renderBlock(list.duplicates, "duplicates"));
  }
  return lines.join("\n").trim();
}

function renderBlock(entries: TradeListEntry[], mode: "needed" | "duplicates"): string[] {
  const withTeam = entries.filter((e) => e.team != null);
  const withoutTeam = entries.filter((e) => e.team == null);

  const teamGroups = new Map<string, TradeListEntry[]>();
  for (const e of withTeam) {
    const key = e.team as string;
    if (!teamGroups.has(key)) teamGroups.set(key, []);
    teamGroups.get(key)!.push(e);
  }
  const teamCodes = Array.from(teamGroups.keys()).sort();

  const sectionGroups = new Map<string, TradeListEntry[]>();
  for (const e of withoutTeam) {
    if (!sectionGroups.has(e.section)) sectionGroups.set(e.section, []);
    sectionGroups.get(e.section)!.push(e);
  }

  const out: string[] = [];
  for (const code of teamCodes) {
    const items = teamGroups.get(code)!.slice().sort((a, b) => a.number - b.number);
    const right = items.map((e) => formatItem(e, mode)).join(", ");
    const flag = flagFor(code);
    const prefix = flag ? `${code} ${flag}` : code;
    out.push(`${prefix}: ${right}`);
  }
  for (const section of NON_TEAM_SECTION_ORDER) {
    const items = sectionGroups.get(section);
    if (!items || items.length === 0) continue;
    const sorted = items.slice().sort((a, b) => a.number - b.number);
    const right = sorted.map((e) => formatItem(e, mode)).join(", ");
    out.push(`${section}: ${right}`);
  }
  return out;
}

function formatItem(e: TradeListEntry, mode: "needed" | "duplicates"): string {
  if (mode === "needed") return String(e.number);
  const extras = e.count - 1;
  return extras > 1 ? `${e.number} ×${extras}` : String(e.number);
}
```

Y agregar (si no está) `import { flagFor } from "./teamFlags";` al inicio del archivo.

- [ ] **Step 8: Correr el test del header — verificar que pasa**

Run: `pnpm test tests/domain/tradeList.test.ts -t "header con app"`
Expected: PASS.

- [ ] **Step 9: Test golden — formato completo solo con faltantes**

Agregar al `describe("formatTradeListByTeam", ...)`:

```ts
  it("formatea faltantes agrupados por equipo en orden alfabético + sections sin equipo", () => {
    const text = formatTradeListByTeam(sample, { username: "oscar" });
    const expected = [
      "stickerSwap · Mundial 2026 — @oscar",
      "",
      "Me faltan*",
      "CZE 🇨🇿: 8",
      "FRA 🇫🇷: 3, 8, 12",
      "KOR 🇰🇷: 5, 11",
      "Intro: 2, 5",
      "Coca-Cola: 4"
    ].join("\n");
    expect(text).toBe(expected);
  });
```

- [ ] **Step 10: Correr el test golden — verificar que pasa**

Run: `pnpm test tests/domain/tradeList.test.ts -t "formatea faltantes agrupados"`
Expected: PASS. Si falla por orden o espaciado, revisar `renderBlock` y la lógica de `lines.join("\n").trim()`.

- [ ] **Step 11: Test golden con faltantes + repes**

Agregar:

```ts
  it("incluye bloque de repes con ×N solo cuando extras > 1, y omite ×1", () => {
    const list: TradeList = {
      needed: [
        { code: "KOR-5", number: 5, section: "Corea del Sur", team: "KOR", count: 0 }
      ],
      duplicates: [
        { code: "ARG-6", number: 6, section: "Argentina", team: "ARG", count: 3 }, // ×2
        { code: "ESP-9", number: 9, section: "España", team: "ESP", count: 2 },    // ×1 → sin ×
        { code: "ESP-14", number: 14, section: "España", team: "ESP", count: 4 }   // ×3
      ]
    };
    const text = formatTradeListByTeam(list, { username: "oscar" });
    const expected = [
      "stickerSwap · Mundial 2026 — @oscar",
      "",
      "Me faltan*",
      "KOR 🇰🇷: 5",
      "",
      "Tengo repes*",
      "ARG 🇦🇷: 6 ×2",
      "ESP 🇪🇸: 9, 14 ×3"
    ].join("\n");
    expect(text).toBe(expected);
  });
```

- [ ] **Step 12: Correr y verificar que pasa**

Run: `pnpm test tests/domain/tradeList.test.ts -t "incluye bloque de repes"`
Expected: PASS.

- [ ] **Step 13: Test sin username**

Agregar:

```ts
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
```

- [ ] **Step 14: Correr y verificar que pasa**

Run: `pnpm test tests/domain/tradeList.test.ts -t "omite handle"`
Expected: PASS.

- [ ] **Step 15: Correr toda la suite de tradeList**

Run: `pnpm test tests/domain/tradeList.test.ts`
Expected: todos los tests nuevos PASS; los tests viejos de `formatTradeListAsText` siguen pasando (los borramos en Task 4).

- [ ] **Step 16: Commit**

```bash
git add src/domain/tradeList.ts tests/domain/tradeList.test.ts
git commit -m "feat(domain): formatTradeListByTeam — agrupa faltantes/repes por código FIFA

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Borrar `formatTradeListAsText`, `TradeFormatOptions` y `useTradePrefs`

**Files:**
- Modify: `src/domain/tradeList.ts`
- Modify: `src/domain/types.ts:50-53`
- Delete: `src/store/tradePreferences.ts`
- Modify: `src/hooks/useMyList.ts` (se borra en Task 5)
- Modify: `tests/domain/tradeList.test.ts`

- [ ] **Step 1: Verificar que `useTradePrefs` no se consume fuera de `useMyList`**

Run: `grep -rn "useTradePrefs\|tradePreferences" --include="*.tsx" --include="*.ts" src/ app/`
Expected output (3 líneas, todas dentro del archivo viejo `useMyList.ts` o del propio store):

```
src/hooks/useMyList.ts:6:import { useTradePrefs } from "@/store/tradePreferences";
src/hooks/useMyList.ts:10:  const { groupBySection } = useTradePrefs();
src/store/tradePreferences.ts:8:export const useTradePrefs = create<TradePrefsState>((set) => ({
```

Si aparece cualquier otra ruta, **STOP** — un consumidor adicional invalida el plan; reportar al usuario antes de seguir.

- [ ] **Step 2: Borrar el `describe("formatTradeListAsText", ...)` del archivo de tests**

En `tests/domain/tradeList.test.ts`, eliminar el bloque completo `describe("formatTradeListAsText", () => { ... })` (las ~30 líneas con sus tests). Mantener todo lo demás (la suite de `buildTradeList` y la nueva `formatTradeListByTeam`).

También: actualizar el import al inicio del archivo para que ya no traiga `formatTradeListAsText`:

Reemplazar:
```ts
import { buildTradeList, formatTradeListAsText } from "@/domain/tradeList";
```
por:
```ts
import { buildTradeList, formatTradeListByTeam } from "@/domain/tradeList";
```

Si Task 3 ya agregó un segundo `import { formatTradeListByTeam }` separado, consolidar a un único import.

- [ ] **Step 3: Borrar `formatTradeListAsText`, `groupBy` (si no la usa la nueva función) y el tipo `TradeFormatOptions`**

En `src/domain/tradeList.ts`:
- Borrar la función `formatTradeListAsText` completa (las ~50 líneas).
- Borrar `function groupBy<T>(...)` si no la usa `renderBlock` (lo confirmé: `renderBlock` arma sus propios `Map`s). Si en el archivo ya no se referencia `groupBy`, eliminarlo.
- Actualizar el `import` del archivo para quitar `TradeFormatOptions` y `TradeListEntry` solo si quedan no usados (TS te avisa con `--noEmit`).

En `src/domain/types.ts`, borrar:
```ts
export interface TradeFormatOptions {
  groupBySection: boolean;
  username: string;
}
```

- [ ] **Step 4: Borrar `src/store/tradePreferences.ts`**

```bash
rm src/store/tradePreferences.ts
```

- [ ] **Step 5: Correr typecheck y tests**

Run: `pnpm exec tsc --noEmit && pnpm test tests/domain/tradeList.test.ts`
Expected: typecheck verde (excepto un error en `src/hooks/useMyList.ts` por el import roto de `useTradePrefs` y `formatTradeListAsText`; lo arreglamos en Task 5). Tests verdes.

Si el typecheck reporta otros errores fuera de `useMyList.ts`, **STOP** y reportar — significa que hay un consumidor escondido que el grep no detectó.

- [ ] **Step 6: Commit (parcial — `useMyList.ts` queda momentáneamente roto, lo borramos en Task 5)**

```bash
git add -u src/domain/tradeList.ts src/domain/types.ts src/store/tradePreferences.ts tests/domain/tradeList.test.ts
git commit -m "chore(domain): borrar formatTradeListAsText y useTradePrefs (sin consumidores UI)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Reemplazar `useMyList` por `useShareList`

**Files:**
- Delete: `src/hooks/useMyList.ts`
- Create: `src/hooks/useShareList.ts`

- [ ] **Step 1: Verificar que `useMyList` no se consume**

Run: `grep -rn "useMyList" --include="*.tsx" --include="*.ts" src/ app/`
Expected output: una sola línea (su propio archivo `src/hooks/useMyList.ts`). Si hay consumidores, **STOP** y reportar.

- [ ] **Step 2: Borrar `useMyList.ts`**

```bash
rm src/hooks/useMyList.ts
```

- [ ] **Step 3: Crear `src/hooks/useShareList.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { getAllStickers } from "@/data/stickers";
import { listStatuses } from "@/data/stickerStatus";
import { buildTradeList, formatTradeListByTeam } from "@/domain/tradeList";
import { useSession } from "@/auth/useSession";

export function useShareList() {
  const session = useSession();
  const query = useQuery({
    queryKey: ["shareList"],
    queryFn: async () => {
      const [stickers, statuses] = await Promise.all([getAllStickers(), listStatuses()]);
      return buildTradeList(stickers, statuses);
    }
  });
  const text = query.data
    ? formatTradeListByTeam(query.data, { username: session.user?.username ?? null })
    : "";
  return { ...query, text };
}
```

- [ ] **Step 4: Correr typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useShareList.ts src/hooks/useMyList.ts
git commit -m "feat(hooks): useShareList reemplaza useMyList con el nuevo formato

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Crear `ShareListModal` componente

**Files:**
- Create: `src/ui/ShareListModal.tsx`

- [ ] **Step 1: Crear el archivo del modal**

```tsx
import { Modal, View, Text, Pressable, ScrollView, Share, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "@/theme/ThemeProvider";
import { haptics } from "@/lib/haptics";
import { showSnackbar } from "@/ui/Snackbar";
import { PrimaryButton } from "@/ui/PrimaryButton";

interface Props {
  visible: boolean;
  onClose: () => void;
  text: string;
}

const MONO_FONT = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function ShareListModal({ visible, onClose, text }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const isEmptyState = text === "Tu álbum está completo 🎉";

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

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          {isEmptyState ? (
            <Text
              style={{
                color: theme.text,
                fontSize: 20,
                fontWeight: "600",
                textAlign: "center",
                marginTop: 80
              }}
            >
              {text}
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

        {!isEmptyState && (
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
              <PrimaryButton label="Copiar" onPress={handleCopy} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Compartir" onPress={handleShare} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: verde. Si falla por un `theme.card` o `theme.border` faltante, revisar `src/theme/themes.ts` y usar las propiedades reales que existan ahí (probablemente `theme.card` y `theme.border` ya están; si no, sustituir por las equivalentes).

- [ ] **Step 3: Commit**

```bash
git add src/ui/ShareListModal.tsx
git commit -m "feat(ui): ShareListModal — preview + Copiar/Compartir

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Crear `ShareListFab` componente

**Files:**
- Create: `src/ui/ShareListFab.tsx`

- [ ] **Step 1: Crear el archivo del FAB**

```tsx
import { Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { haptics } from "@/lib/haptics";

interface Props {
  onPress: () => void;
}

export function ShareListFab({ onPress }: Props) {
  const { theme } = useTheme();
  const handlePress = async () => {
    await haptics.light();
    onPress();
  };
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: 24,
        right: 16,
        left: 16,
        alignItems: "flex-end"
      }}
    >
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Compartir lista de figuritas"
        style={{
          backgroundColor: theme.accent,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 999,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4
        }}
      >
        <Text style={{ color: theme.bg, fontSize: 16, fontWeight: "700" }}>↗</Text>
        <Text style={{ color: theme.bg, fontSize: 14, fontWeight: "700" }}>Compartir lista</Text>
      </Pressable>
    </View>
  );
}
```

Nota: `pointerEvents="box-none"` en el wrapper deja que los taps fuera del Pressable pasen al contenido de abajo (importante para no bloquear scroll/refresh en la pestaña Amigos).

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: verde.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ShareListFab.tsx
git commit -m "feat(ui): ShareListFab — botón flotante \"Compartir lista\"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Montar FAB + Modal en la pestaña Amigos

**Files:**
- Modify: `app/(tabs)/friends.tsx`

- [ ] **Step 1: Agregar imports al inicio del archivo**

En `app/(tabs)/friends.tsx`, dentro del bloque de imports existente, agregar:

```ts
import { ShareListFab } from "@/ui/ShareListFab";
import { ShareListModal } from "@/ui/ShareListModal";
import { useShareList } from "@/hooks/useShareList";
```

- [ ] **Step 2: Agregar estado del modal y hook dentro del componente `Friends`**

Justo después de `const [refreshing, setRefreshing] = useState(false);` (línea ~36), agregar:

```ts
  const [shareOpen, setShareOpen] = useState(false);
  const { text: shareText } = useShareList();
```

- [ ] **Step 3: Bumpear `paddingBottom` del ScrollView para que el FAB no tape contenido**

En la línea `contentContainerStyle={{ paddingBottom: 32 }}` del ScrollView principal, cambiar a:

```tsx
        contentContainerStyle={{ paddingBottom: 120 }}
```

- [ ] **Step 4: Renderizar FAB y Modal dentro del `<ThemedBackground>` pero fuera del `<ScrollView>`**

Reemplazar el `return (...)` del componente `Friends` para que tenga esta estructura (mostrando solo la parte relevante; mantener todo lo de adentro del ScrollView tal cual):

```tsx
  return (
    <ThemedBackground>
      <ScrollView
        className="flex-1 px-4 pt-14"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {/* ... contenido existente (tab, AmigosView/TruequesView/CercaView) ... */}
      </ScrollView>
      <ShareListFab onPress={() => setShareOpen(true)} />
      <ShareListModal
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        text={shareText}
      />
    </ThemedBackground>
  );
```

- [ ] **Step 5: Typecheck + tests**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: ambos verdes.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/friends.tsx
git commit -m "feat(friends): FAB \"Compartir lista\" abre modal con preview + acciones

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Smoke test final + verificación

**Files:** ninguno

- [ ] **Step 1: Correr suite completa de tests**

Run: `pnpm test`
Expected: todos los tests pasan (~55 + nuevos = ~63). Si alguno falla, **STOP** y reportar.

- [ ] **Step 2: Typecheck estricto**

Run: `pnpm exec tsc --noEmit`
Expected: cero errores.

- [ ] **Step 3: Levantar Metro y probar manualmente**

Run: `pnpm start`

En la app:
- Abrir pestaña Amigos.
- Verificar que el FAB "↗ Compartir lista" aparece en la esquina inferior derecha.
- Tap → se abre el modal.
- Verificar que el texto coincide con el formato del spec (Variante B): header con `@username`, "Me faltan*", líneas por equipo con bandera, "Tengo repes*" si aplica.
- Tap "Copiar" → snackbar "Copiado ✓" + pegar en otra app (Notes) verifica el contenido.
- Tap "Compartir" → se abre el share sheet del SO con el texto.
- Cerrar el modal con la X y verificar que cierra.
- Cambiar a subtab Trueques y Cerca: el FAB sigue visible.
- Pull-to-refresh en la pestaña sigue funcionando (no bloqueado por el FAB).
- Cambiar a tema oscuro desde Perfil → el modal y el FAB se ven coherentes.

- [ ] **Step 4: Verificación de caso límite "álbum completo"**

Si tenés acceso al perfil de prueba: marcar (temporalmente) todas las figuritas como `count=1`, abrir el modal y verificar que muestra "Tu álbum está completo 🎉" sin los botones Copiar/Compartir. Revertir.

Si no podés probarlo manualmente fácil, dejar el caso cubierto solo por el unit test del Task 3 step 1.

- [ ] **Step 5: Verificación final con git**

Run: `git log --oneline main..HEAD`
Expected: ver los 8 commits de los Tasks 1-8 listados. La rama está lista para PR/merge.

---

## Self-review (post-write)

Verifiqué inline antes de cerrar el plan:

- **Cobertura del spec:** §1 Formato → Task 3. §2 Dominio → Tasks 1, 2, 3, 4. §3 UI → Tasks 6, 7, 8. §4 Hooks → Task 5. §5 Testing → Tasks 1, 2, 3. §6 Migración → orden Tasks 1-8 (matching paso a paso).
- **Sin placeholders:** todo el código aparece literal. Los únicos "STOP y reportar" están en gates de verificación (Tasks 4 y 5) que protegen contra estado inesperado del codebase.
- **Consistencia de tipos:** `TradeListEntry` extendida con `team` en Task 1; usada por nombre en Tasks 3 y 5. `formatTradeListByTeam(list, opts)` con la misma firma en Tasks 3 y 5. `useShareList()` devuelve `{ text, ...query }` y se consume como `{ text: shareText }` en Task 8 — consistente.
- **Decisiones abiertas del spec resueltas con defaults:** literales del dataset (`Intro`, `Extras`, `Coca-Cola`), `×1` omitido, FAB en las 3 subtabs (vive en el componente raíz).
