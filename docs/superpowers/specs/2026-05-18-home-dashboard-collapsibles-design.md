# Home Dashboard + colapsibles inline

**Fecha:** 2026-05-18
**Estado:** Aprobado, listo para implementación

## Contexto

Hoy el Home tab (`app/(tabs)/index.tsx`) muestra:

- Header `"Mi Álbum"` con stats mínimas en una línea de subtítulo (`X / Y láminas · N repes`).
- Barra de progreso fina global.
- Buscador + view toggle (grid/lista).
- Sort segmentado (Álbum / Más pegados / Menos pegados).
- Grilla o lista de equipos. Cada equipo es un card clickeable que navega a `app/album/[code].tsx`, donde vive `AlbumScroll` — un scroll continuo de las secciones con los 20 cromos cada una.

El feedback es que esto subexplota la pantalla principal: las stats relevantes están condensadas en una línea, y para ver/marcar cromos hay que entrar a otra vista, perdiendo contexto del progreso global.

## Objetivos

- Convertir Home en un **dashboard con 13 stats** organizadas por jerarquía visual.
- Reemplazar la grilla/lista navegable por **colapsibles inline** de las 51 secciones del álbum.
- Permitir marcar/desmarcar cromos sin abandonar el Home.
- Soportar dos modos visuales (compacto con bandera + completo con foto del jugador).
- Filtrado por colapsible (Todos / Faltan / Repes) sin afectar a otros equipos.

## No-objetivos

- No se toca el esquema de Supabase ni las tablas locales SQLite.
- No se toca el sync engine ni la sync_queue.
- No se cambian las hooks de increment/decrement existentes.
- No se cambia la pantalla `app/sticker/[code].tsx` (queda viva si algún flujo la usa).
- No se reemplaza la lista de amigos, trades, ni perfil.
- No se agrega "marcar todo el equipo" en este iteración (el hook `useBulkMarkTeam` queda disponible para una futura).

## Decisiones tomadas durante brainstorming

| Decisión | Resolución |
|---|---|
| Scope | Reemplazo total. Se elimina la ruta `/album/[code]` y `AlbumScroll`. |
| Stats elegidas | 13 (ver Sección 2). |
| Layout dashboard | Hero card + grid mixto (4 zonas: globales / equipos / especiales / sociales). |
| Comportamiento de colapsibles | Multi-expand. Tap en header alterna abierto/cerrado. |
| Modo Compacto/Completo | Toggle global arriba de la lista. Persiste en AsyncStorage. |
| Vista compacta | Bolitas circulares con bandera SVG de fondo, código en pill blanco al centro. |
| Vista completa | Cards rectangulares con foto del jugador (placeholder de iniciales si no hay imagen). |
| Filtro por colapsible | Chips Todos · Faltan · Repes, no persiste entre sesiones. |
| Tap en cromo | `+1` (incrementa count). |
| Long press en cromo | `−1` (decrementa, no baja de 0). |
| Estados visuales | Color normal = tengo, gris+opacity = falta, badge naranja "×N" = repe. |
| Banderas | SVG vía librería MIT (`country-flag-icons`) o copias locales — decisión al implementar. |
| Especiales (Intro/Extras/Coca-Cola) | SVGs custom hechos a mano. |
| Imágenes de jugadores | Campo opcional `imageUrl` en `Sticker`. Mientras `null`, fallback a iniciales. |
| Sticker detail modal | Sigue existiendo, ya no se navega desde Home. |

## Arquitectura

### Archivos nuevos

```
app/(tabs)/index.tsx              REESCRITO completo
src/domain/
  └─ stats.ts                     NUEVO  — función pura computeStats()
src/hooks/
  └─ useDashboardStats.ts         NUEVO  — derivado de hooks existentes
src/store/
  ├─ stickerViewMode.ts           NUEVO  — Zustand persist (compact|full)
  ├─ expandedSections.ts          NUEVO  — Zustand in-memory (Set<id>)
  └─ filterMode.ts                NUEVO  — Zustand in-memory (por sección)
src/ui/dashboard/
  ├─ DashboardHero.tsx            NUEVO
  ├─ StatCard.tsx                 NUEVO
  └─ DashboardGrid.tsx            NUEVO
src/ui/album/
  ├─ SectionCollapsible.tsx       NUEVO
  ├─ StickerBolita.tsx            NUEVO
  ├─ StickerFullCard.tsx          NUEVO
  ├─ FilterChips.tsx              NUEVO
  └─ ViewModeToggle.tsx           NUEVO
src/ui/flags/
  ├─ FlagSvg.tsx                  NUEVO
  └─ specialBadges/
      ├─ IntroBadge.tsx           NUEVO  — logo FIFA
      ├─ ExtrasBadge.tsx          NUEVO  — estrella dorada
      └─ CokeBadge.tsx            NUEVO  — logo Coca-Cola
assets/flags/                     NUEVO  — SVGs país (si elegimos local en vez de npm)
```

### Archivos a eliminar

```
app/album/[code].tsx
src/ui/AlbumScroll.tsx
src/domain/albumOrder.ts
src/ui/ViewToggle.tsx
tests/albumOrder.test.ts
```

### Archivos a tocar (no reescribir)

- `src/domain/types.ts` — agregar `imageUrl?: string | null` a `Sticker`.
- `scripts/gen-stickers.js` — incluir `imageUrl: null` en el output, bumpear `version`.
- `src/ui/MatchCard.tsx` (y similares que naveguen a `/album/[code]`) — redirigir a `/?expand=<sectionId>` para mantener UX.

**Verificar al implementar**: el `sectionId` esperado por el deep link (`?expand=`) debe coincidir con el `id` que devuelve `useAlbumStickers` para cada sección. Para equipos suele ser el `teamCode` FIFA (`ARG`, `BRA`); para especiales puede ser el nombre (`Intro`) o un slug (`intro`). Decidir el formato concreto antes de tocar las referencias en MatchCard.

### Flujo de datos

```
SQLite (stickers + sticker_status)
    ↓
useAlbumStickers + useFriends + useFriendMatches  (existentes, sin cambios)
    ↓
useDashboardStats  →  computeStats(...)  →  DashboardStats
    ↓
DashboardGrid renders cards
    ↓
                              useStickerViewMode (persist)
                              useExpandedSections (in-memory)
                              useFilterMode (in-memory)
    ↓
FlashList de SectionCollapsible[]
    ↓
Al expandir, render de StickerBolita[] o StickerFullCard[]
    ↓
Tap/LongPress → useIncrement / useDecrement (existentes)
    → SQLite local + sync_queue → worker drena en _layout.tsx
```

## 1. Las 13 stats del dashboard

### Tipo de retorno

```ts
// src/domain/stats.ts
export interface DashboardStats {
  // Globales
  collected: number;          // pegadas únicas
  missing: number;            // total - collected
  duplicates: number;         // Σ max(0, count - 1)
  pct: number;                // collected / total

  // Equipos (cuenta solo secciones con teamCode != null)
  teamsComplete: number;      // equipos con pct === 1
  teamsOneAway: number;       // equipos con (total - collected) === 1
  teamsZero: number;          // equipos con collected === 0

  // Por tipo / sección especial
  badgesCollected: number;    // type === "team_badge" && count >= 1
  badgesTotal: number;        // 48
  legendsCollected: number;   // section === "Extras" && count >= 1
  legendsTotal: number;       // 11
  cokeCollected: number;      // section === "Coca-Cola" && count >= 1
  cokeTotal: number;          // 14

  // Sociales
  friendsCount: number;       // status === "accepted"
  matchesCount: number;       // amigos con (theyHaveYouNeed.length > 0 || youHaveTheyNeed.length > 0)

  // Actividad
  lastAdded: {
    stickerCode: string;
    stickerName: string;
    updatedAt: number;        // epoch ms
  } | null;
}
```

### Firma de la función pura

```ts
export function computeStats(
  stickers: StickerWithStatus[],
  friends: Friend[],
  matches: FriendMatchSummary[]
): DashboardStats
```

### Reglas de cálculo

- `collected`, `missing`, `duplicates`, `pct`: como hoy en `computeProgress`.
- `teamsComplete | teamsOneAway | teamsZero`: solo considera secciones cuyo `teamCode != null`. Las secciones Intro, Extras y Coca-Cola **no cuentan** como "equipos".
- `lastAdded`: max `updatedAt` entre stickers con `count >= 1`. Si todos en 0, retorna `null`.
- `matchesCount`: un amigo cuenta si tiene **al menos una** lista no vacía (no requiere bidireccionalidad estricta).

**Nota**: los nombres exactos de las secciones especiales (`"Extras"`, `"Coca-Cola"`) en `assets/stickers.json` deben verificarse al implementar — son los que vienen del generator. Si difieren (ej. `"Extras FWC"`), ajustar las comparaciones en `computeStats`.

### Visualización de `lastAdded`

- Si `null` → la card muestra `"Sin actividad"` en value y label `"Última pegada"`.
- Si `now - updatedAt < 7 días` → formato relativo (`"hace 2h"`, `"hace 1d"`) con `Intl.RelativeTimeFormat`.
- Si `>= 7 días` → fecha corta (`"3 may"`, `"15 abr"`).

### Performance

- `computeStats` es O(n) sobre los 994 cromos + O(m) sobre 48 equipos + O(k) sobre amigos.
- Memoizada con `useMemo` por referencia de inputs. Recomputa solo cuando cambia el cache de queries.

## 2. Layout del dashboard

```
┌─────────────────────────────────────────┐
│  Progreso del álbum                     │
│         34%                             │
│  342 / 994 láminas                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  ← Hero (color)
├─────────────────────────────────────────┤
│  Me faltan       │  Repes               │  ← Medianas (2 col)
│  652             │  127                 │
│  únicas          │  extras              │
├──────────┬──────────┬──────────────────┤
│ Compl.   │ A 1      │ Sin emp.         │  ← Equipos (3 col)
│ 3 /48    │ 5 cromo  │ 17 /48           │
├──────────┼──────────┼──────────────────┤
│ Escudos  │ Leyendas │ Coca-Cola        │  ← Especiales (3 col)
│ 38 /48   │ 4 /11    │ 7 /14            │
├──────────┼──────────┼──────────────────┤
│ Amigos   │ Matches  │ Última           │  ← Sociales (3 col)
│ 12       │ 8        │ 2h · Lautaro     │
└──────────┴──────────┴──────────────────┘
```

- Sin labels de sección entre grids — la jerarquía visual la dan tamaños y orden.
- Cards "Amigos" y "Matches" navegan al tab Amigos (`router.push("/(tabs)/friends")`).
- Card "Compl./A 1/Sin emp." son **decorativas** — no navegan (no hay vista filtrada para esos sets).

### Componentes

**`DashboardHero`**
```ts
interface Props {
  pct: number;
  collected: number;
  total: number;
}
```
- Fondo: gradiente suave usando colores del theme (cream→honey en light, espresso→cocoa en dark).
- Tipografía: label 11pt mute, value 38pt extrabold, sub 13pt.
- Barra: alto 6px, color dinámico via `progressColor(pct, theme)`.

**`StatCard`**
```ts
interface Props {
  label: string;
  value: string;
  sub?: string;
  size?: "sm" | "md";        // sm=20pt value, md=26pt value
  onPress?: () => void;
}
```
- Fondo `theme.card`, borde 1px `theme.border`, radius 12.
- Si `onPress` definido: `accessibilityRole="button"` + ripple feedback.

**`DashboardGrid`**
- Compone Hero + 2-col (medianas) + 3-col × 3 (equipos/especiales/sociales).
- Gap 8px entre cards, 8px entre filas.

## 3. Lista de colapsibles

### Orden

El orden viene de `useAlbumStickers` (que ya retorna secciones ordenadas):

```
Intro (FIFA)
GRUPO A — equipos del grupo A en orden de aparición
GRUPO B
...
GRUPO L
Extras (FWC históricos)
Coca-Cola
```

**Total: 51 colapsibles** (1 + 48 + 1 + 1).

### Comportamiento

- Multi-expand: varios pueden estar abiertos simultáneamente.
- Estado de expansión: en memoria (Set\<sectionId\>), se resetea al cerrar la app.
- Filtro: por sección, en memoria, se resetea al cerrar.
- Modo visual: global (Compacto/Completo), persiste en AsyncStorage.

### Componente `SectionCollapsible`

```ts
interface Props {
  section: SectionData;
  expanded: boolean;
  filterMode: "all" | "missing" | "dup";
  viewMode: "compact" | "full";
  onToggle: () => void;
  onChangeFilter: (mode) => void;
}
```

**Header (siempre visible):**

```
┌─────────────────────────────────────────┐
│ ┃ 🇦🇷  Argentina       12/20  ⌄         │   altura ~64px
└─────────────────────────────────────────┘
```

- Banda lateral 5px con color de equipo (`getTeamColors(teamCode).bg`).
- Bandera circular ~28px (reutiliza `FlagSvg`).
- Nombre del equipo en bold.
- Contador `X/Y` a la derecha.
- Chevron rotado 0°/180° según `expanded`.
- Toda el área es `<Pressable>` que llama `onToggle()` + `haptics.light()`.

**Body (solo si `expanded`):**

```
┌─────────────────────────────────────────┐
│ [Todos · 20]  [Faltan · 5]  [Repes · 2] │   FilterChips
│                                          │
│ ⬤ ⬤ ⬤ ⬤ ⬤                              │   Grid de cromos
│ ⬤ ⬤ ⬤ ⬤ ⬤                              │
│ ⬤ ⬤ ⬤ ⬤ ⬤                              │
│ ⬤ ⬤ ⬤ ⬤ ⬤                              │
└─────────────────────────────────────────┘
```

- En `viewMode === "compact"`: grid de 5 columnas de `StickerBolita`.
- En `viewMode === "full"`: grid de 3 columnas de `StickerFullCard`.
- Animación de altura con Reanimated 4 al expandir/colapsar (~200ms).

### Filtrado

El filtro decide qué stickers renderizar:

```ts
function filterStickers(stickers, mode) {
  switch (mode) {
    case "all": return stickers;
    case "missing": return stickers.filter(s => s.count === 0);
    case "dup": return stickers.filter(s => s.count > 1);
  }
}
```

Los conteos en los chips (`Faltan · 5`, `Repes · 2`) se calculan en el componente con la misma lógica.

**Caso especial: filtro vacío.** Si el equipo está completo y el usuario selecciona "Faltan", aparece un mensaje inline: `"¡Equipo completo! No te falta ninguno."`. Mismo patrón para "Repes" vacío.

## 4. Componentes de cromo

### `StickerBolita` (modo compacto)

```ts
interface Props {
  sticker: StickerWithStatus;
  teamCode: string | null;
}
```

**Layout:**

```
        ┌─────────────┐
        │   bandera   │   círculo con overflow:hidden
        │  ┌───────┐  │   tamaño: width 20% con aspectRatio 1
        │  │ARG-5  │  │   pill blanco al centro (Variante B)
        │  └───────┘  │   borde 2px rgba(0,0,0,0.1)
        └─────────────┘
              [×2]         badge naranja FUERA del overflow
```

**Estructura JSX:**

```tsx
<View style={{ position: "relative" }}>
  <Pressable
    onPress={handleIncrement}
    onLongPress={handleDecrement}
    style={{
      borderRadius: 9999,
      overflow: "hidden",
      borderWidth: 2,
      borderColor: "rgba(0,0,0,0.1)",
      aspectRatio: 1,
    }}
  >
    <FlagSvg code={teamCode} section={sticker.section} />
    <View style={pillStyle}>
      <Text>{sticker.code}</Text>
    </View>
  </Pressable>
  {sticker.count > 1 && <BadgeX2 count={sticker.count} />}
</View>
```

**Por qué el badge va fuera del Pressable**: el círculo necesita `overflow: hidden` para clipear la bandera al borde circular, pero eso clipearía también el badge si estuviera adentro. Solución: badge en un contenedor exterior absolutamente posicionado.

**Estados:**

| Estado | Efecto visual |
|---|---|
| `count === 0` | `<View style={{ filter: grayscale }}>` wrap o `opacity: 0.4 + tintColor` (depende del soporte RN) |
| `count === 1` | Full color, sin badge |
| `count > 1` | Full color + badge `"×${count}"` |

**Implementación de grayscale en RN**: `react-native-svg` permite aplicar `<Defs><Filter>` con desaturación, o más simple: un overlay `<View style={{ position: 'absolute', backgroundColor: 'rgba(120,113,108,0.5)' }}>` sobre la bandera. Probar ambas y elegir la más limpia visualmente.

### `StickerFullCard` (modo completo)

```ts
interface Props {
  sticker: StickerWithStatus;
  teamCode: string | null;
}
```

**Layout:**

```
┌──────────┐
│  ARG-5   │   código arriba, 9pt mute
│ ┌──────┐ │
│ │ FOTO │ │   60×60 foto o iniciales
│ └──────┘ │
│ Lo Celso │   nombre abajo, 10pt bold
└──────────┘    aspect 3/4, radius 8
        [×2]
```

- Si `sticker.imageUrl != null` → `<Image source={{ uri: imageUrl }} />`.
- Si `null` → placeholder con iniciales sobre fondo del color del equipo (`getTeamColors(teamCode).bg`).
- Iniciales vienen de `getInitials(sticker.name)` — la función ya existe en `src/domain/playerInitials.ts`.
- Mismo gesture handler que `StickerBolita`.
- Mismo badge ×N fuera del overflow.

## 5. Estado

### `useStickerViewMode` — Zustand persist

```ts
// src/store/stickerViewMode.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Store {
  mode: "compact" | "full";
  setMode: (m: "compact" | "full") => void;
}

export const useStickerViewMode = create<Store>()(
  persist(
    (set) => ({
      mode: "compact",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "panini.album.viewMode",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

- Default: `"compact"` para usuarios nuevos.
- Hidrata de AsyncStorage al boot.

### `useExpandedSections` — in-memory

```ts
// src/store/expandedSections.ts
interface Store {
  expanded: Set<string>;
  toggle: (sectionId: string) => void;
  isExpanded: (sectionId: string) => boolean;
  collapseAll: () => void;
}
```

- No persiste. Todos colapsados al abrir la app.
- `toggle`: agrega o quita del Set.
- `collapseAll`: util para futuro botón (no en esta iteración).

### `useFilterMode` — in-memory

```ts
// src/store/filterMode.ts
interface Store {
  filters: Record<string, "all" | "missing" | "dup">;
  setFilter: (sectionId: string, mode) => void;
  getFilter: (sectionId: string) => "all" | "missing" | "dup"; // default "all"
}
```

- No persiste. Reseteo al cerrar.
- Mantener separado de expandedSections permite recordar filtro por sección mientras la app está abierta.

## 6. Renderizado con FlashList

```tsx
// app/(tabs)/index.tsx
<FlashList
  ListHeaderComponent={
    <>
      <DashboardGrid stats={stats} />
      <ViewModeToggle mode={viewMode} onChange={setViewMode} />
    </>
  }
  data={sections}                        // 51 entradas
  renderItem={({ item }) => (
    <SectionCollapsible
      section={item}
      expanded={isExpanded(item.id)}
      filterMode={getFilter(item.id)}
      viewMode={viewMode}
      onToggle={() => toggle(item.id)}
      onChangeFilter={(m) => setFilter(item.id, m)}
    />
  )}
  estimatedItemSize={64}                 // alto del header colapsado
  keyExtractor={(s) => s.id}
  ListEmptyComponent={<LoadingSkeleton />}
/>
```

- `estimatedItemSize` = altura del header colapsado.
- Cuando una sección se expande, su altura crece y FlashList se ajusta.
- 51 items en total → manejable, incluso con varios expandidos.

### Deep linking `?expand=<sectionId>`

El Home acepta query param `expand` para abrir un colapsible específico y hacer scroll a él:

```ts
const params = useLocalSearchParams<{ expand?: string }>();
useEffect(() => {
  if (params.expand) {
    addExpanded(params.expand);
    scrollToSection(params.expand);
  }
}, [params.expand]);
```

Útil para que `MatchCard` y otros flujos sigan funcionando después de borrar `/album/[code]`.

## 7. Banderas y assets

### Banderas país

Decisión a tomar en el primer paso del plan de implementación. Hay varias opciones de librerías SVG de banderas en npm con licencia MIT/Apache (ej. `country-flag-icons`, `react-native-svg-flagkit`, derivados de `flagicons.lipis.dev`). Comparar al implementar:

| Opción | Pro | Contra |
|---|---|---|
| Librería npm | una línea, mantenida por terceros | dependencia extra, hay que verificar compat con `react-native-svg` |
| Copiar 48 SVGs en `assets/flags/` desde `flagicons.lipis.dev` (MIT) o similar | zero deps, control total | mantener a mano |

**Default recomendado**: copiar localmente los 48 SVGs necesarios (no la librería entera). Es más simple, más liviano en bundle, y evita depender de que la librería soporte exactamente nuestros 48 códigos FIFA.

### Especiales (no países)

Tres SVGs hechos a mano, en `assets/flags/special/`:

- **Intro / FIFA**: logo World Cup 2026 estilizado, o copa dorada genérica.
- **Extras (FWC históricos)**: estrella dorada sobre fondo navy.
- **Coca-Cola**: logo Coca-Cola sobre fondo rojo.

### Mapeo

```ts
// src/ui/flags/FlagSvg.tsx
interface Props {
  code: string | null;     // FIFA code, o null para especiales
  section?: string;        // requerido si code === null
  size?: number;           // default 64
}

export function FlagSvg({ code, section, size = 64 }: Props) {
  if (code) return <CountryFlag code={code} size={size} />;
  switch (section) {
    case "Intro":     return <IntroBadge size={size} />;
    case "Extras":    return <ExtrasBadge size={size} />;
    case "Coca-Cola": return <CokeBadge size={size} />;
    default:          return <Fallback size={size} />;
  }
}
```

### Fotos de jugadores

- Agregar campo opcional `imageUrl?: string | null` a `Sticker` en `src/domain/types.ts`.
- `scripts/gen-stickers.js`: incluir `imageUrl: null` por default, bumpear `version`.
- App detecta version mayor al boot y re-siembra `stickers` sin tocar `sticker_status` (mecanismo ya existente).
- A futuro, cuando el usuario recorte fotos del PDF y las suba a algún host, va poblando el campo. Las fotos aparecen automáticamente.

## 8. Estados de loading y empty

- **Inicial** (queries no listas): `<Skeleton>` para el hero (estructura ghost) + 3-4 colapsibles fake colapsados.
- **Álbum vacío** (recién instalado): dashboard muestra ceros, lista colapsada normalmente. `lastAdded` card dice "Sin actividad".
- **Filtro vacío** (ej. equipo completo + filtro "Faltan"): mensaje inline en el body del colapsible: `"¡Equipo completo! No te falta ninguno."`.

## 9. Theming

Usa `useTheme()` existente. Colores que se referencian:

- `theme.bg` / `theme.card` / `theme.border`
- `theme.text` / `theme.textMute`
- `theme.accent` para acentos
- `progressColor(pct, theme)` para barras dinámicas
- `getTeamColors(teamCode)` para bandas laterales y backgrounds de iniciales

Tanto modo light (cream/coffee) como dark (espresso) deben verse bien — las cards usan tokens del theme, no colores hardcoded.

## 10. Accesibilidad

- Cada `StickerBolita` / `StickerFullCard`:
  - `accessibilityLabel`: `"${sticker.name}, ${stateLabel}"` (donde stateLabel es "pegada"/"falta"/"repetida ×N")
  - `accessibilityRole`: `"button"`
  - `accessibilityHint`: `"Toca para sumar, mantén para restar"`
- Header de colapsible: `accessibilityState={{ expanded }}`, `accessibilityRole={"button"}`.
- StatCards interactivas: `accessibilityRole="button"`.
- Toggle Compacto/Completo: `accessibilityRole="adjustable"`, `accessibilityState={{ selected }}`.

## 11. Performance esperada

Objetivos de performance (a verificar con measurement, no asumir):

| Métrica | Objetivo |
|---|---|
| Cold start render del Home | comparable al actual (~300ms en device físico) |
| Tap → feedback visual | <16ms (cache local + optimistic) |
| Toggle expand de un colapsible | <100ms + animación 200ms |
| Cambio de filtro | <50ms (solo re-renderiza ese colapsible) |
| Scroll con 5 colapsibles expandidos | 60fps sostenido en device físico |

Plan de fallback si la perf es mala: medir con Reanimated profiler / DevTools antes de envolver en optimizaciones prematuras.

## 12. Testing

### Tests unitarios nuevos

| Archivo | Cobertura |
|---|---|
| `tests/computeStats.test.ts` | Función pura `computeStats` — los 13 stats, edge cases |
| `tests/stickerViewMode.test.ts` | Hidrata correcta de AsyncStorage, default `compact` |
| `tests/filterStickers.test.ts` | Helper de filtrado por modo |
| `tests/expandedSections.test.ts` | Toggle / collapseAll / isExpanded |

### Cobertura mínima de `computeStats`

- Álbum vacío → todo en 0, `lastAdded: null`.
- Álbum 100% completo → `pct: 1`, `teamsComplete: 48`, `teamsZero: 0`, `missing: 0`.
- Solo Intro y Coca-Cola completos → `teamsComplete: 0` (no se cuentan como equipos).
- Equipo con 19/20 → `teamsOneAway: 1`.
- 3 cromos con count=3 → `duplicates: 6`.
- `lastAdded` ignora stickers con `count === 0`.
- Amigo sin matches → `matchesCount: 0`.

### Tests a eliminar

- `tests/albumOrder.test.ts`.

### Tests sin cambios

- Tests de `useProgress`, `useIncrement`, `useDecrement`, `tradeList`, `friendMatchBuilder`, `conflict`, `backoff`, `inviteCode` — todos siguen pasando.

### Smoke tests manuales (no automatizados)

- Tap rápido sobre bolitas en cadena → counters se actualizan, no se traba.
- Long press sobre bolita en `count === 0` → no-op, no baja a -1.
- Toggle Compacto ↔ Completo → cambia todas las bolitas/cards a la vez.
- Cerrar app y reabrir → toggle se mantiene; colapsibles vuelven a cerrados.
- Filtro "Faltan" en equipo completo → muestra mensaje vacío sin romper.
- Deep link `/?expand=ARG` desde MatchCard → abre Argentina expandido y scrollea a él.

## 13. Migración

### Estrategia

Single commit, single branch. Las dependencias son demasiado entrelazadas para hacer phased (sacar la grilla actual sin reemplazo deja el Home roto en el intermedio).

### Pre-checks

```bash
# Verificar referencias a borrar antes de eliminar
grep -rn "album/\[code\]"  src app
grep -rn "AlbumScroll"      src app
grep -rn "albumOrder"       src
grep -rn "ViewToggle"       src app
```

Cualquier referencia fuera de Home y album/ debe redirigirse a `/?expand=<sectionId>`.

### Versionado

- `app.json` → bumpear `version` de `1.0.2` a `1.1.0`.
- `app.json` → bumpear `android.versionCode`.

### Despliegue

- Beta personal — no requiere TestFlight ni Play Store.
- iOS: reinstalar desde Xcode (signing free).
- Sin migraciones de Supabase (no se tocan tablas).

## 14. Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| FlashList con items de altura muy variable da scroll glitchy | `estimatedItemSize` ajustado, fallback a `ScrollView` si la perf es mala |
| Bundle crece por SVGs (48 banderas + 3 especiales) | medir antes/después, lazy-load por equipo si suma >500KB |
| Algún flujo (MatchCard, friend detail) usaba `/album/[code]` | grep previo + redirect al Home con query `?expand=` |
| Long press conflicta con scroll de FlashList | tunear `delayLongPress` si hace falta |
| Modal `/sticker/[code]` queda huérfano | revisar referencias; si solo lo usaba Home, considerar eliminarlo en otra iteración |
| Animación de expand causa repaint costoso con muchos hijos | usar `LayoutAnimation` simple antes de Reanimated, medir |

## 15. Resumen ejecutivo

Reemplazamos el Home tab por un dashboard de 13 stats (Hero card + 2 cards medianas + 9 cards chicas en 3 grupos de 3) y una lista de 51 colapsibles inline que reemplazan la navegación a `/album/[code]`. Los colapsibles muestran los cromos en uno de dos modos (compacto con bolitas circulares + bandera SVG, o completo con foto/iniciales del jugador) controlado por un toggle global persistente. Cada colapsible tiene su propio filtro Todos/Faltan/Repes. Tap = +1, long press = -1. Sin cambios en sync, schema, ni auth.
