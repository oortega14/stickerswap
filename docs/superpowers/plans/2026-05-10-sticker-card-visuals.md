# Sticker Card Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el glifo único `⛊`/`▦` que hoy usa la team page por tres visuales SVG distintos según `sticker.type` — camiseta con iniciales para `player`, escudo heater con código FIFA para `team_badge`, y grilla 3×3 de mini-camisetas para `team_photo`.

**Architecture:** Lógica pura nueva en `src/theme/colorUtils.ts` (darkenHex / luminance) y `src/domain/playerInitials.ts` (getInitials), ambas con TDD. Componente RN nuevo `src/ui/StickerCardVisual.tsx` que encapsula los 3 SVGs y hace switch por tipo. `app/team/[code].tsx` reemplaza el bloque inline del glifo por una llamada al componente. `react-native-svg` ya está instalado (lo usa `react-native-qrcode-svg`).

**Tech Stack:** React Native 0.81 + Expo SDK 54, TypeScript strict, Jest + jest-expo, `react-native-svg` 15.x. NativeWind v4 para clases Tailwind. `pnpm` requiere `mise activate` (Node 22). Tests TDD para lógica pura, sin tests UI.

---

## Pre-Flight

### Task 0: Verificar estado limpio

**Files:**
- Read-only verification

- [ ] **Step 1: Confirmar working tree limpio**

```bash
cd ~/projects/stickerswap && git status -s
```

Expected: vacío (nada uncommitted). Si hay cambios de la sesión de brainstorming en `.superpowers/brainstorm/`, ignorarlos (están en .gitignore).

- [ ] **Step 2: Confirmar branch main y typecheck/tests verdes**

```bash
git branch --show-current
eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -3
```

Expected: branch `main`, typecheck silencioso, "Tests: 112 passed".

---

## Lógica pura

### Task 1: `src/theme/colorUtils.ts` + tests

**Files:**
- Create: `src/theme/colorUtils.ts`
- Test: `tests/theme/colorUtils.test.ts`

Helper para derivar las sleeves del jersey y el stroke del shield. `darkenHex` baja la luminosidad HSL un porcentaje. `luminance` detecta colores muy oscuros (caso GER negro).

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/theme/colorUtils.test.ts`:

```ts
import { darkenHex, luminance } from "@/theme/colorUtils";

describe("darkenHex", () => {
  it("darkens a light blue noticeably", () => {
    const out = darkenHex("#75AADB", 0.20);
    expect(out).toMatch(/^#[0-9a-f]{6}$/i);
    expect(luminance(out)).toBeLessThan(luminance("#75AADB"));
  });

  it("does not underflow on black", () => {
    expect(darkenHex("#000000", 0.20)).toBe("#000000");
  });

  it("darkens white into a gray", () => {
    const out = darkenHex("#ffffff", 0.20);
    expect(out).toMatch(/^#[0-9a-f]{6}$/i);
    expect(luminance(out)).toBeLessThan(0.95);
    expect(luminance(out)).toBeGreaterThan(0.5);
  });

  it("returns input unchanged on garbage", () => {
    expect(darkenHex("not-a-color", 0.20)).toBe("not-a-color");
    expect(darkenHex("#xyz", 0.20)).toBe("#xyz");
  });

  it("handles 3-char hex shortcuts", () => {
    const out = darkenHex("#abc", 0.20);
    expect(out).toMatch(/^#[0-9a-f]{6}$/i);
    expect(luminance(out)).toBeLessThan(luminance("#aabbcc"));
  });

  it("handles 8-char hex with alpha (drops alpha)", () => {
    const out = darkenHex("#75AADBff", 0.20);
    expect(out).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("luminance", () => {
  it("black is 0", () => {
    expect(luminance("#000000")).toBe(0);
  });

  it("white is 1", () => {
    expect(luminance("#ffffff")).toBe(1);
  });

  it("monotonic: darker = lower luminance", () => {
    expect(luminance("#000000")).toBeLessThan(luminance("#444444"));
    expect(luminance("#444444")).toBeLessThan(luminance("#888888"));
    expect(luminance("#888888")).toBeLessThan(luminance("#cccccc"));
  });

  it("returns 0 for invalid input", () => {
    expect(luminance("not-a-color")).toBe(0);
  });
});
```

- [ ] **Step 2: Correr tests, verificar fallan**

```bash
eval "$(mise activate zsh)" && pnpm test -- tests/theme/colorUtils.test.ts 2>&1 | tail -10
```

Expected: FAIL con "Cannot find module '@/theme/colorUtils'".

- [ ] **Step 3: Implementar `src/theme/colorUtils.ts`**

```ts
// src/theme/colorUtils.ts
//
// Helpers para derivar variantes de color a partir de hex strings:
// - `darkenHex` baja la luminosidad un % en espacio HSL.
// - `luminance` devuelve un número 0..1 (0 = negro, 1 = blanco) para
//   ramas condicionales tipo "si es muy oscuro, fallback a accent".
//
// Inputs aceptados: #rgb, #rrggbb, #rrggbbaa (alpha se ignora). Para
// inputs no parseables, ambas funciones devuelven valores defensivos
// (input sin cambios, o 0).

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== "string" || !hex.startsWith("#")) return null;
  let h = hex.slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    case bn:
      h = (rn - gn) / d + 4;
      break;
  }
  return { h: h / 6, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function darkenHex(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const newL = Math.max(0, hsl.l - amount);
  const out = hslToRgb(hsl.h, hsl.s, newL);
  return rgbToHex(out.r, out.g, out.b);
}

export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  // Perceptual luminance approx (sRGB → linear → relative luminance)
  const sToLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = sToLinear(rgb.r);
  const g = sToLinear(rgb.g);
  const b = sToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
```

- [ ] **Step 4: Correr tests, verificar pasan**

```bash
pnpm test -- tests/theme/colorUtils.test.ts 2>&1 | tail -15
```

Expected: PASS, todos los `darkenHex` + `luminance` casos verdes.

- [ ] **Step 5: Suite completa + typecheck**

```bash
pnpm test 2>&1 | tail -3
pnpm exec tsc --noEmit
```

Expected: 112+11 = 123 tests pass (los 11 nuevos), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/theme/colorUtils.ts tests/theme/colorUtils.test.ts
git commit -m "feat(theme): darkenHex + luminance helpers para visuales de stickers"
```

---

### Task 2: `src/domain/playerInitials.ts` + tests

**Files:**
- Create: `src/domain/playerInitials.ts`
- Test: `tests/domain/playerInitials.test.ts`

`getInitials` extrae 2 letras de un nombre de jugador para usar como dorsal en la camiseta.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/domain/playerInitials.test.ts`:

```ts
import { getInitials } from "@/domain/playerInitials";

describe("getInitials", () => {
  const cases: Array<[string | null | undefined, string]> = [
    ["Lionel Messi", "LM"],
    ["K. Mbappé", "KM"],
    ["Pedri", "PE"],
    ["Vinicius Jr", "VJ"],
    ["J.J. García", "JG"],
    ["van Dijk", "VD"],
    ["a", "A"],          // single char → padded
    ["", "??"],          // empty
    [null, "??"],        // null
    [undefined, "??"]    // undefined
  ];

  it.each(cases)("getInitials(%p) → %p", (input, expected) => {
    expect(getInitials(input as string)).toBe(expected);
  });

  it("uppercases the result", () => {
    expect(getInitials("kylian mbappé")).toBe("KM");
  });
});
```

- [ ] **Step 2: Correr test, verificar falla**

```bash
pnpm test -- tests/domain/playerInitials.test.ts 2>&1 | tail -10
```

Expected: FAIL con "Cannot find module '@/domain/playerInitials'".

- [ ] **Step 3: Implementar `src/domain/playerInitials.ts`**

```ts
// src/domain/playerInitials.ts
//
// Extrae 2 caracteres en mayúscula del nombre de un jugador para
// renderizarlos como "dorsal" sobre la camiseta de la card.
//
// Algoritmo:
// 1. Split por whitespace.
// 2. Por cada token, strip todo lo que no sea letra ("K." → "K", "J.J." → "JJ").
// 3. Filtrar tokens que quedan vacíos.
// 4. Si quedan ≥2 tokens: primera letra del primero + primera letra del último.
// 5. Si queda 1 token: primeras 2 letras si tiene ≥2, o esa única letra si tiene 1.
// 6. Si quedan 0 tokens (o input null/empty): "??".

export function getInitials(name: string | null | undefined): string {
  if (!name || typeof name !== "string") return "??";
  const tokens = name.split(/\s+/).filter(Boolean);
  const cleaned = tokens.map((t) => t.replace(/[^\p{L}]/gu, "")).filter(Boolean);
  if (cleaned.length === 0) return "??";
  if (cleaned.length === 1) {
    const t = cleaned[0];
    return t.length >= 2 ? t.slice(0, 2).toUpperCase() : t.toUpperCase();
  }
  return (cleaned[0][0] + cleaned[cleaned.length - 1][0]).toUpperCase();
}
```

**Por qué este enfoque y no filtrar tokens por longitud**: si filtráramos tokens cortos (regla "≥2 letras"), `"K. Mbappé"` perdería "K." y devolvería `"MB"` en vez del esperado `"KM"`. El strip-per-token preserva la inicial del primer nombre aunque venga abreviado.

- [ ] **Step 4: Correr test, verificar pasa**

```bash
pnpm test -- tests/domain/playerInitials.test.ts 2>&1 | tail -10
```

Expected: PASS, todos los casos verdes.

- [ ] **Step 5: Suite completa + typecheck**

```bash
pnpm test 2>&1 | tail -3
pnpm exec tsc --noEmit
```

Expected: tests verdes (≈124 totales), typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/domain/playerInitials.ts tests/domain/playerInitials.test.ts
git commit -m "feat(domain): getInitials para extraer dorsal del nombre del jugador"
```

---

## Componente UI

### Task 3: `src/ui/StickerCardVisual.tsx`

**Files:**
- Create: `src/ui/StickerCardVisual.tsx`

Componente que recibe un `Sticker` + el color de fondo del área (para los neck cutouts del jersey) y renderiza el SVG apropiado según el tipo. Sin tests UI (consistente con CLAUDE.md). Verificación es typecheck + smoke test manual en device.

- [ ] **Step 1: Crear el archivo**

```tsx
// src/ui/StickerCardVisual.tsx
//
// Renderiza el visual SVG dentro de la card de un sticker en team page.
// Switch por sticker.type: player → camiseta con iniciales, team_badge →
// escudo heater con código FIFA, team_photo → grilla 3×3 de mini-camisetas.
// Otros tipos (icon/special) no aparecen en team page → render null.

import React from "react";
import Svg, { Path, Circle, G, Text as SvgText } from "react-native-svg";
import type { Sticker } from "@/domain/types";
import { getTeamColors, type TeamColors } from "@/theme/teamColors";
import { darkenHex, luminance } from "@/theme/colorUtils";
import { getInitials } from "@/domain/playerInitials";

interface Props {
  sticker: Sticker;
  // Color del View que envuelve este SVG. Lo usamos para "carve out"
  // visualmente el cuello de la camiseta (que en realidad es un Path
  // sólido encima del body con este color).
  cardBgColor: string;
}

function pickSleeveColor(colors: TeamColors): string {
  return luminance(colors.bg) < 0.10 ? colors.accent : darkenHex(colors.bg, 0.20);
}

function pickShieldDarkColor(colors: TeamColors): string {
  const dark = darkenHex(colors.bg, 0.50);
  return dark === colors.bg ? colors.accent : dark;
}

// Body + sleeves + neck cutout. viewBox 0..100.
function JerseyShape({
  body,
  sleeves,
  neck
}: {
  body: string;
  sleeves: string;
  neck: string;
}) {
  return (
    <>
      <Path d="M 8,28 L 28,18 L 32,40 L 18,42 Z" fill={sleeves} />
      <Path d="M 92,28 L 72,18 L 68,40 L 82,42 Z" fill={sleeves} />
      <Path
        d="M 28,18 Q 38,12 50,16 Q 62,12 72,18 L 78,28 L 78,90 Q 78,94 74,94 L 26,94 Q 22,94 22,90 L 22,28 Z"
        fill={body}
      />
      <Path d="M 38,15 Q 50,22 62,15 L 60,12 Q 50,18 40,12 Z" fill={neck} />
    </>
  );
}

function JerseyVisual({
  initials,
  colors,
  cardBgColor
}: {
  initials: string;
  colors: TeamColors;
  cardBgColor: string;
}) {
  const sleeves = pickSleeveColor(colors);
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      <JerseyShape body={colors.bg} sleeves={sleeves} neck={cardBgColor} />
      <SvgText
        x="50"
        y="62"
        textAnchor="middle"
        fontSize="22"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="3"
        fill={colors.bgText}
      >
        {initials}
      </SvgText>
    </Svg>
  );
}

function ShieldVisual({ code, colors }: { code: string; colors: TeamColors }) {
  const dark = pickShieldDarkColor(colors);
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      {/* Heater shield body */}
      <Path
        d="M 22,18 L 78,18 L 78,55 Q 78,82 50,92 Q 22,82 22,55 Z"
        fill={colors.bg}
        stroke={dark}
        strokeWidth="2.5"
      />
      {/* Top dark band */}
      <Path d="M 22,18 L 78,18 L 78,30 L 22,30 Z" fill={dark} opacity="0.85" />
      {/* 3 stars on band */}
      <SvgText x="32" y="27" fontSize="10" fill={colors.accent}>
        ★
      </SvgText>
      <SvgText x="50" y="27" fontSize="10" fill={colors.accent} textAnchor="middle">
        ★
      </SvgText>
      <SvgText x="68" y="27" fontSize="10" fill={colors.accent} textAnchor="end">
        ★
      </SvgText>
      {/* FIFA code */}
      <SvgText
        x="50"
        y="65"
        textAnchor="middle"
        fontSize="22"
        fontWeight="900"
        fontFamily="Impact, Arial Black, sans-serif"
        letterSpacing="2"
        fill={colors.bgText}
      >
        {code}
      </SvgText>
    </Svg>
  );
}

// 9 mini-camisetas SIN cuello (no haría falta a ese tamaño). Usa el mismo
// JerseyShape pero con neck=sleeves para que el cutout no sea visible.
function SquadGridVisual({ colors }: { colors: TeamColors }) {
  const sleeves = pickSleeveColor(colors);
  const positions: Array<[number, number]> = [
    [14, 14],
    [38, 14],
    [62, 14],
    [14, 38],
    [38, 38],
    [62, 38],
    [14, 62],
    [38, 62],
    [62, 62]
  ];
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      {positions.map(([x, y]) => (
        <G key={`${x}-${y}`} transform={`translate(${x}, ${y}) scale(0.18)`}>
          <JerseyShape body={colors.bg} sleeves={sleeves} neck={sleeves} />
        </G>
      ))}
    </Svg>
  );
}

export function StickerCardVisual({ sticker, cardBgColor }: Props) {
  const teamCode = sticker.team ?? "";
  const colors = getTeamColors(teamCode);

  switch (sticker.type) {
    case "player":
      return (
        <JerseyVisual
          initials={getInitials(sticker.name)}
          colors={colors}
          cardBgColor={cardBgColor}
        />
      );
    case "team_badge":
      return <ShieldVisual code={teamCode || "?"} colors={colors} />;
    case "team_photo":
      return <SquadGridVisual colors={colors} />;
    default:
      return null;
  }
}
```

- [ ] **Step 2: Verificar que `getTeamColors` exporta `TeamColors`**

```bash
grep -n "export.*TeamColors\|export interface TeamColors" src/theme/teamColors.ts
```

Expected: `export interface TeamColors { ... }` debe estar (lo vimos antes en línea 5). Si por alguna razón no está exportado, agregar el `export` y proceder.

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: silencioso. Si aparece error de imports en `react-native-svg` (ej. `Text as SvgText` no exportado), revisar la lista de imports — la lib expone exactamente: `Svg, Path, Rect, Circle, G, Defs, Symbol, Use, Text` (entre otros). El alias `Text as SvgText` evita choque con `Text` de react-native.

- [ ] **Step 4: Correr todos los tests**

```bash
pnpm test 2>&1 | tail -3
```

Expected: PASS (≈124 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/StickerCardVisual.tsx
git commit -m "feat(ui): StickerCardVisual con jersey/escudo/grilla por sticker.type"
```

---

## Wiring

### Task 4: Wire `StickerCardVisual` en team page

**Files:**
- Modify: `app/team/[code].tsx:321-332` (el bloque del glifo `⛊`/`▦`)

- [ ] **Step 1: Localizar el bloque exacto**

```bash
grep -n '⛊\|▦' app/team/\[code\].tsx
```

Expected: una línea ≈331 que contiene el ternary `{s.type === "team_photo" ? "▦" : "⛊"}`.

- [ ] **Step 2: Importar el componente nuevo**

Agregar al bloque de imports al top de `app/team/[code].tsx`:

```tsx
import { StickerCardVisual } from "@/ui/StickerCardVisual";
```

(Mantener orden alfabético entre los imports `@/...`.)

- [ ] **Step 3: Reemplazar el bloque del glifo**

Buscar las líneas:

```tsx
        <View
          style={{
            aspectRatio: 1,
            backgroundColor: collected ? withAlpha(accent, 0.12) : theme.bg,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ fontSize: 36, color: withAlpha(theme.textMute, 0.5) }}>
            {s.type === "team_photo" ? "▦" : "⛊"}
          </Text>
          {/* Badge esquina: ✓ si pegado, ×N si repetido */}
          {collected && (
```

Reemplazar por:

```tsx
        <View
          style={{
            aspectRatio: 1,
            backgroundColor: collected ? withAlpha(accent, 0.12) : theme.bg,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <View style={{ width: "78%", height: "78%" }}>
            <StickerCardVisual
              sticker={s}
              cardBgColor={collected ? withAlpha(accent, 0.12) : theme.bg}
            />
          </View>
          {/* Badge esquina: ✓ si pegado, ×N si repetido */}
          {collected && (
```

(Solo cambia el contenido del bloque visual: el `Text` con el glifo se reemplaza por el View 78% conteniendo `StickerCardVisual`. El badge de abajo y todo el resto del card queda igual.)

- [ ] **Step 4: Typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: silencioso.

- [ ] **Step 5: Tests (sanity check, no debería haber regresión)**

```bash
pnpm test 2>&1 | tail -3
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/team/\[code\].tsx
git commit -m "feat(team): renderizar StickerCardVisual en cada card de la team page"
```

---

## Versionado

### Task 5: Bump versión a 1.2.0-beta.1

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Ver versión actual**

```bash
grep '"version"' package.json
```

Expected: `"version": "1.1.0-beta.1",` (o similar — la actual del proyecto). Si ya está en 1.2.0-beta.1, saltar al Step 4.

- [ ] **Step 2: Modificar `package.json`**

Cambiar la línea de `"version"` a:

```json
"version": "1.2.0-beta.1",
```

- [ ] **Step 3: Verificar pnpm sigue contento**

```bash
pnpm install --frozen-lockfile 2>&1 | tail -3
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 1.2.0-beta.1"
```

---

## Verificación final

### Task 6: Smoke test end-to-end

- [ ] **Step 1: Suite + typecheck completos**

```bash
eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -5
```

Expected: typecheck clean + tests verdes (≈124).

- [ ] **Step 2: Reiniciar Metro (limpia caché por las dudas)**

```bash
pnpm start --clear
```

(En otra terminal o background; mantener corriendo durante la verificación.)

- [ ] **Step 3: En el iPhone, verificar:**

- [ ] Abrir la app, navegar a Home → tap sobre una selección (ej. Argentina).
- [ ] La grilla de stickers ahora muestra:
  - Sticker `#-1` (Escudo): heater shield azul con banda dark + 3 estrellas doradas + texto "ARG".
  - Sticker `#-13` (Argentina Team): grilla 3×3 de mini-camisetas azules.
  - Stickers `#-2` a `#-20` excepto `#-13` (jugadores): camiseta azul con sleeves más oscuras + iniciales blancas tipo dorsal (LM, EM, GS, etc.).
- [ ] Navegar a otro equipo (ej. Brasil): los visuales toman colores verdes.
- [ ] Verificar Alemania: jersey body negro + sleeves doradas (caso edge).
- [ ] Verificar Colombia (#COL): jersey amarillo + iniciales en azul navy (texto contraste).
- [ ] Tap en un sticker → modal de detalle abre normal (no se rompió la nav).
- [ ] El badge ✓/×N sigue apareciendo en esquina cuando el sticker está pegado.

- [ ] **Step 4: Performance check**

Scroll rápido arriba/abajo en la team page. Si hay lag perceptible (drops ≥30fps consistente), agregar `React.memo` a `StickerCardVisual` con un commit chico:

```tsx
export const StickerCardVisual = React.memo(StickerCardVisualImpl);
```

Si el scroll es fluido, no hacer nada.

- [ ] **Step 5: Mostrar log de commits**

```bash
git log --oneline -7
```

Expected: 5-6 commits del plan listos. No push automático (el user decide si pushea).

---

## Notas para el implementador

- **No necesitás crear migraciones SQL ni tocar Supabase.** Esto es 100% cambio de UI cliente.
- **`react-native-svg` ya está instalado** como transitive dependency de `react-native-qrcode-svg` (ver `pnpm-lock.yaml`). No `pnpm install` adicional.
- **`SvgText`** (alias de `Text` de react-native-svg) usa `fontFamily="Impact, Arial Black, sans-serif"`. En iOS, "Impact" puede caer al fallback Arial Black — sigue funcionando estéticamente. No hay que cargar fuente custom.
- **El `letter-spacing="3"`** en SVGText es la forma RN/SVG de pasar `letterSpacing` (no camelCase en este caso porque es prop SVG).
- **Si typecheck falla** en `react-native-svg` con un import específico, comentá en chat y vemos — la API debería ser estable en SDK 54.
- **Recovery si algo se rompe:** cada commit deja el repo en estado verde. `git reset --hard <last-good-sha>` te devuelve.
