# Visuales de cards en team page (camiseta + escudo + grilla)

**Fecha**: 2026-05-10
**Estado**: Aprobado
**Alcance**: `app/team/[code].tsx`, nuevos `src/ui/StickerCardVisual.tsx`, `src/theme/colorUtils.ts`, `src/domain/playerInitials.ts`, tests asociados.

## Problema

`app/team/[code].tsx:321-332` renderiza la zona visual de cada card con un glifo Unicode genérico — `⛊` para todos los `player` y `team_badge`, y `▦` solo para `team_photo`. El usuario reportó que el escudo se ve plano y sin personalidad por equipo, y los `team_badge` y `player` se confunden visualmente porque comparten el mismo glifo.

```tsx
{/* Estado actual */}
<Text style={{ fontSize: 36, color: withAlpha(theme.textMute, 0.5) }}>
  {s.type === "team_photo" ? "▦" : "⛊"}
</Text>
```

## Goal

Diferenciar visualmente los tres tipos de sticker que aparecen en team page (`player`, `team_badge`, `team_photo`) con un sistema gráfico que herede los colores de la selección via el `getTeamColors(team)` ya existente, y que sea reutilizable a futuro en otras pantallas (modal de detalle, mini-thumbs).

## Decisiones de diseño

### Player (18/equipo) — camiseta sólida con iniciales

- Silueta SVG de camiseta de fútbol (body + sleeves trapezoidales + neck cutout).
- Body = `colors.bg` del equipo.
- Sleeves = `darkenHex(colors.bg, 0.20)`. Excepción: si la luminancia del bg es muy baja (negro o casi-negro, ej. GER `#000000`), sleeves usan `colors.accent` (porque "más oscuro que negro" no existe).
- Iniciales del nombre tipo dorsal centradas, color = `colors.bgText`, font Impact, `letter-spacing: 3px`, font-size proporcional al tamaño.
- Ejemplos: "Lionel Messi" → `LM`, "K. Mbappé" → `KM`, "Pedri" → `PE`.

### team_badge (sticker `#-1`, 1/equipo) — escudo heater

- Forma SVG de escudo medieval (heater shape: lados curvos, punta inferior).
- Body fill = `colors.bg`.
- Stroke del contorno **y** fill de la banda superior dark = `darkenHex(colors.bg, 0.50)` (mismo color para ambos para coherencia). No usar `bgText` aquí: para equipos con `bgText: "#ffffff"` el stroke sería invisible contra el cream del card bg.
- Banda superior (~15% del alto del escudo) con 3 estrellas en `colors.accent`.
- Código FIFA del equipo en `colors.bgText`, centrado, font Impact, `letter-spacing: 2px`, grande (≈22px en viewBox 100).
- Las 3 estrellas son decorativas fijas — no representan campeonatos reales (eso requeriría dato adicional). Justificación: visualmente reconocible como "escudo deportivo" y consistente entre equipos.

**Edge case**: si `darkenHex` devuelve igual al `bg` (caso de bg ya completamente oscuro como `#000000`), usar `colors.accent` para stroke + banda — mismo fallback que sleeves del player.

### team_photo (sticker `#-13`, 1/equipo) — grilla 3×3 de mini-camisetas

- 9 mini-camisetas SVG (mismo `<symbol>` reutilizado) dispuestas en grid 3×3 dentro del área visual.
- Cada mini-camiseta usa los mismos colores que el visual del `player` (body bg + sleeves darker), sin iniciales (son siluetas chicas).
- Visualmente lee al instante: "11+ camisetas = el plantel".

### Tipos no manejados

- `icon` (9 stickers de Intro / FWC) — no aparecen filtrados por team, viven en `app/(tabs)/index.tsx` y otras pantallas. Fuera de alcance.
- `special` (25 — Coca-Cola y FWC retros) — mismo motivo. Fuera de alcance.

## Cambios técnicos

### 1. Nuevo: `src/theme/colorUtils.ts`

```ts
/** Devuelve `hex` oscurecido el `amount` (0..1) en HSL. */
export function darkenHex(hex: string, amount: number): string;

/** Luminancia perceptual 0..1 (0 = negro puro, 1 = blanco puro). */
export function luminance(hex: string): number;
```

Implementación: parse hex → rgb → hsl → `l = max(0, l - amount)` → hsl → rgb → hex. Acepta `#rgb`, `#rrggbb`, `#rrggbbaa`. Si el input no parsea, devuelve el input sin cambios.

### 2. Nuevo: `src/domain/playerInitials.ts`

```ts
export function getInitials(name: string): string;
```

Reglas:
- Split por whitespace, filtra tokens que no tengan al menos 2 chars alfabéticos contiguos (ignora "K.", "Jr.", "Jr").
- Si quedan ≥2 tokens válidos: primera letra del primero + primera letra del último.
- Si queda 1 token: primeras 2 letras (uppercase).
- Si quedan 0 tokens válidos: `??`.
- Output siempre en uppercase.

Ejemplos:
| Input | Output |
|---|---|
| `"Lionel Messi"` | `LM` |
| `"K. Mbappé"` | `KM` |
| `"Pedri"` | `PE` |
| `"Vinicius Jr"` | `VJ` |
| `"J.J. García"` | `JG` |
| `""` o `null` | `??` |

### 3. Nuevo: `src/ui/StickerCardVisual.tsx`

```tsx
import Svg, { Path, Rect, Circle, Text as SvgText, G, Defs, Symbol, Use } from "react-native-svg";
import type { Sticker } from "@/domain/types";
import { getTeamColors } from "@/theme/teamColors";
import { darkenHex, luminance } from "@/theme/colorUtils";
import { getInitials } from "@/domain/playerInitials";

interface Props {
  sticker: Sticker;
}

export function StickerCardVisual({ sticker }: Props) { /* ... */ }
```

- Switch por `sticker.type`:
  - `"player"` → `<JerseyVisual code={sticker.team} initials={getInitials(sticker.name)} />`
  - `"team_badge"` → `<ShieldVisual code={sticker.team} />`
  - `"team_photo"` → `<SquadGridVisual code={sticker.team} />`
  - default → null (no debería pasar en team page).
- Las 3 sub-funciones son privadas al archivo (no se exportan).
- Cada SVG es viewBox `0 0 100 100`, ancho/alto 100%. El parent controla las dimensiones.
- `react-native-svg` ya está instalado (lo usa `react-native-qrcode-svg`), no requiere nueva dependencia.

**Sleeves logic** (interna a `JerseyVisual` y `SquadGridVisual`):

```ts
const sleeveColor = luminance(colors.bg) < 0.10
  ? colors.accent          // black/near-black: usa accent
  : darkenHex(colors.bg, 0.20);
```

Umbral `0.10` cubre solo `#000000` y muy pocos casos. El resto de bgs (incluyendo amarillos/oranges) cae al darkenHex normal.

**Visual de referencia**: el HTML del brainstorm en `.superpowers/brainstorm/<session>/content/jersey-multi-team.html` y `badge-photo.html` son fuente de verdad para proporciones, posiciones de paths SVG y tamaños de texto. El implementer debe portar esos paths viewBox 100×100 a `<Path>` de `react-native-svg` 1:1.

### 4. Modificación: `app/team/[code].tsx`

- Reemplazar el bloque inline `<Text>{ "▦" : "⛊" }</Text>` (líneas 321-332) por:

```tsx
<View
  style={{
    aspectRatio: 1,
    backgroundColor: collected ? withAlpha(accent, 0.12) : theme.bg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  }}
>
  <View style={{ width: "78%", height: "78%" }}>
    <StickerCardVisual sticker={s} />
  </View>
  {collected && (/* el badge ✓/×N actual queda igual */)}
</View>
```

- El `78%` da padding visual entre el SVG y los bordes de la card.
- El `backgroundColor` con tinte accent en estado pegado se mantiene (ya existe).

Resto del archivo (lista, header, modo destildar, etc.) no se toca.

### 5. Tests

- `tests/theme/colorUtils.test.ts`
  - `darkenHex("#75AADB", 0.20)` → un hex válido y más oscuro (verificar luminance menor)
  - `darkenHex("#000000", 0.20)` → "#000000" (no underflow)
  - `darkenHex("#fff", 0.20)` → un gris razonable
  - `darkenHex("not-a-color", 0.20)` → input sin cambios
  - `luminance("#000000")` ≈ 0, `luminance("#ffffff")` ≈ 1
  - Casos edge: `#abc` (3-char), `#abcdef00` (8-char con alpha)

- `tests/domain/playerInitials.test.ts`
  - Tabla de inputs/outputs de la sección 2 arriba.
  - Empty string y `null` devuelven `??`.

**No tests para SVG visuals** — consistente con CLAUDE.md ("no testeamos UI con snapshots").

### 6. Versionado

`package.json`: `1.1.0-beta.1` → `1.2.0-beta.1`.

## Riesgos y mitigaciones

- **Performance del SVG en grilla 2-col con muchos stickers**: cada card renderiza un SVG. La página de equipo muestra 20 stickers visibles. `react-native-svg` maneja esto bien en práctica (lo confirma QRCode que renderiza diariamente). Mitigación si emergiera lag: memoizar `StickerCardVisual` con `React.memo` (cheap, no rompe nada).
- **Iniciales raras** para nombres con caracteres especiales (acentos, ñ): el `getInitials` toma la primera letra raw — "Á" → "Á", "Ñ" → "Ñ". Cubierto por `text` del SVG sin transformación adicional.
- **Equipos sin entrada en `teamColors.ts`**: `getTeamColors(code)` ya devuelve un `DEFAULT` sensato. Los visuales seguirán renderizando con el default sin romper.
- **Datasets futuros con jugadores cuyo nombre venga raro**: `getInitials` siempre devuelve algo (mínimo `??`). No hay path que rompa el render.

## Plan de implementación

Pendiente — se redacta en `docs/superpowers/plans/2026-05-10-sticker-card-visuals.md` después de aprobar este spec.
