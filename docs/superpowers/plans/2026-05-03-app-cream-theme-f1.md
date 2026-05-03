# Cream/Coffee Theme — F1 Implementation Plan (light only)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el tema dark/starry de la app por una paleta cream/coffee con barras de progreso dinámicas (rojo→ámbar→verde por porcentaje), dejando preparado el sistema de theming para que F2 sume el dark mode.

**Architecture:** Introduce un `ThemeProvider` con tokens en `src/theme/themes.ts` y un hook `useTheme()`. Para F1 sólo existe `lightTheme`. Las pantallas reemplazan `<StarryBackground>` por un `<ThemedBackground>` que lee del provider. Las barras de progreso reciben un único color por barra calculado por `progressColor(pct, theme)` (interpolación RGB lineal entre red/amber/green). Para mantener el resto de la app coherente sin migrar cada NativeWind class manualmente, se remapean los valores de la paleta legacy (`src/theme/colors.ts` y `tailwind.config.js`) a tonos cream/coffee — los nombres `space.*`/`colors.dim` se conservan (técnicamente misnombre tras el cambio, F2 puede renombrar) pero los valores resultan en cream.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript strict, NativeWind v4 (Tailwind), Reanimated v4, react-native-svg, expo-status-bar, Jest.

**Spec:** `docs/superpowers/specs/2026-05-03-app-cream-theme-design.md` (F1 = pasos 1-8 de la sección "Fases de implementación")

---

## File Structure

**Create:**
- `src/theme/themes.ts` — tokens `lightTheme` + tipo `Theme`. Sin `darkTheme` (F2).
- `src/theme/progress.ts` — `progressColor(pct, theme)` puro.
- `src/theme/ThemeProvider.tsx` — Context provider + `useTheme()` hook. F1: hardcodea light, sin AsyncStorage.
- `src/ui/ThemedBackground.tsx` — reemplazo del `<StarryBackground>`, lee bg del theme.
- `tests/theme/progress.test.ts` — tests del helper.

**Modify (cream remap, theming-aware):**
- `src/theme/colors.ts` — remapear los valores de `colors` (preservando keys) a cream/coffee.
- `tailwind.config.js` — remapear `theme.extend.colors.space` a cream/coffee.
- `src/ui/GlowCard.tsx` — cards en cream con sombra suave en lugar del glow púrpura.
- `app/_layout.tsx` — montar `<ThemeProvider>`, `<StatusBar style="dark" />`.
- `app/(tabs)/_layout.tsx` — tab bar lee `useTheme()`.
- `app/(tabs)/index.tsx` — `<ThemedBackground>`, `progressColor` en ambos `<ProgressBar>`.
- `app/(tabs)/album.tsx` — `<ThemedBackground>`, `progressColor` si tiene `<ProgressBar>`.
- `app/(tabs)/trades.tsx`, `app/(tabs)/profile.tsx` — `<ThemedBackground>`.
- `app/sticker/[code].tsx`, `app/profile/edit.tsx`, `app/about.tsx` — `<ThemedBackground>`.
- `app/add-friend/search.tsx`, `app/friends/index.tsx`, `app/friends/[username].tsx` — `<ThemedBackground>`.
- `app/(auth)/sign-in.tsx`, `app/(auth)/onboarding.tsx`, `app/onboarding/[step].tsx` — `<ThemedBackground>`.
- `app.json` — quitar `"userInterfaceStyle": "dark"`.

**Delete:**
- `src/ui/StarryBackground.tsx` — obsoleto.

**No tocar:**
- `app/team/[code].tsx` — tiene su propio sistema de colores (TeamColors).
- `src/theme/teamColors.ts`, las paletas curadas por equipo.
- Los tests existentes (~55), siguen verdes sin cambios.

---

## Task 1: `progressColor` helper + tests

**Files:**
- Create: `src/theme/progress.ts`
- Create: `tests/theme/progress.test.ts`

- [ ] **Step 1: Escribir los tests primero**

```ts
// tests/theme/progress.test.ts
import { progressColor } from "@/theme/progress";

const STOPS = {
  progressRed: "#dc2626",
  progressAmber: "#f59e0b",
  progressGreen: "#16a34a"
} as const;

describe("progressColor", () => {
  it("returns red at 0%", () => {
    expect(progressColor(0, STOPS)).toBe("#dc2626");
  });

  it("returns amber at 50%", () => {
    expect(progressColor(0.5, STOPS)).toBe("#f59e0b");
  });

  it("returns green at 100%", () => {
    expect(progressColor(1, STOPS)).toBe("#16a34a");
  });

  it("interpolates between red and amber at 25%", () => {
    // midpoint between #dc2626 (220,38,38) and #f59e0b (245,158,11)
    // = (232.5, 98, 24.5) → (233, 98, 25) → "#e96219"
    expect(progressColor(0.25, STOPS)).toBe("#e96219");
  });

  it("interpolates between amber and green at 75%", () => {
    // midpoint between #f59e0b (245,158,11) and #16a34a (22,163,74)
    // = (133.5, 160.5, 42.5) → (134, 161, 43) → "#86a12b"
    expect(progressColor(0.75, STOPS)).toBe("#86a12b");
  });

  it("clamps below 0 to red", () => {
    expect(progressColor(-0.5, STOPS)).toBe("#dc2626");
  });

  it("clamps above 1 to green", () => {
    expect(progressColor(1.5, STOPS)).toBe("#16a34a");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `eval "$(mise activate zsh)" && pnpm test -- tests/theme/progress.test.ts`
Expected: FAIL — "Cannot find module '@/theme/progress'".

- [ ] **Step 3: Implementar `progressColor`**

Create `src/theme/progress.ts`:

```ts
type Stops = {
  progressRed: string;
  progressAmber: string;
  progressGreen: string;
};

function parseHex(hex: string): [number, number, number] {
  const m = hex.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return [0, 0, 0];
  const h = m[1];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ];
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpola linealmente en RGB entre tres stops:
 *  pct ≤ 0    → red
 *  pct = 0.5  → amber
 *  pct ≥ 1    → green
 *
 * Acepta `Theme` o cualquier objeto que tenga las 3 claves de progreso —
 * útil para tests sin tener que armar el theme completo.
 */
export function progressColor(pct: number, stops: Stops): string {
  if (pct <= 0) return stops.progressRed;
  if (pct >= 1) return stops.progressGreen;
  const [r1, g1, b1] = parseHex(stops.progressRed);
  const [r2, g2, b2] = parseHex(stops.progressAmber);
  const [r3, g3, b3] = parseHex(stops.progressGreen);
  if (pct < 0.5) {
    const t = pct / 0.5;
    return toHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
  }
  const t = (pct - 0.5) / 0.5;
  return toHex(lerp(r2, r3, t), lerp(g2, g3, t), lerp(b2, b3, t));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `eval "$(mise activate zsh)" && pnpm test -- tests/theme/progress.test.ts`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Run typecheck**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/theme/progress.ts tests/theme/progress.test.ts
git commit -m "feat(theme): add progressColor RGB-lerp helper for dynamic progress bars"
```

---

## Task 2: Theme tokens (`themes.ts`) + `ThemeProvider`

**Files:**
- Create: `src/theme/themes.ts`
- Create: `src/theme/ThemeProvider.tsx`

- [ ] **Step 1: Crear `src/theme/themes.ts`**

```ts
export interface Theme {
  bg: string;
  card: string;
  text: string;
  textMute: string;
  border: string;
  track: string;
  accent: string;
  progressRed: string;
  progressAmber: string;
  progressGreen: string;
}

export const lightTheme: Theme = {
  bg: "#fdf6e3",
  card: "#fffaf0",
  text: "#3a2e1a",
  textMute: "#8b6f47",
  border: "rgba(58,46,26,0.10)",
  track: "rgba(58,46,26,0.10)",
  accent: "#6b4423",
  progressRed: "#dc2626",
  progressAmber: "#f59e0b",
  progressGreen: "#16a34a"
};
```

- [ ] **Step 2: Crear `src/theme/ThemeProvider.tsx`**

```tsx
import React, { createContext, useContext } from "react";
import { lightTheme, type Theme } from "./themes";

type Mode = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  mode: Mode;
  setMode: (m: Mode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // F1: forzamos light. F2 agrega AsyncStorage + darkTheme.
  const value: ThemeContextValue = {
    theme: lightTheme,
    mode: "light",
    setMode: async () => {
      // no-op en F1 — toggle se implementa en F2
    }
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
```

- [ ] **Step 3: Run typecheck**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/theme/themes.ts src/theme/ThemeProvider.tsx
git commit -m "feat(theme): add lightTheme tokens and ThemeProvider (F1, no toggle)"
```

---

## Task 3: `ThemedBackground` component

**Files:**
- Create: `src/ui/ThemedBackground.tsx`

- [ ] **Step 1: Crear `src/ui/ThemedBackground.tsx`**

```tsx
import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Fondo coloreado por theme. Reemplaza al StarryBackground original.
 * Acepta `children` y se expande con flex: 1 para llenar la pantalla.
 */
export function ThemedBackground({ children }: { children?: React.ReactNode }) {
  const { theme } = useTheme();
  return <View style={{ flex: 1, backgroundColor: theme.bg }}>{children}</View>;
}
```

- [ ] **Step 2: Run typecheck**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ThemedBackground.tsx
git commit -m "feat(ui): add ThemedBackground (replacement for StarryBackground)"
```

---

## Task 4: Remapear paleta legacy + GlowCard a cream/coffee

Este task es la "transición silenciosa": las pantallas que usan `colors.dim`, `text-space-mute`, `bg-space-dark`, etc. (sin pasar por `useTheme()`) automáticamente quedan cream tras el remap. Los nombres legacy se conservan; cambiar nombres masivamente es una limpieza separada.

**Files:**
- Modify: `src/theme/colors.ts` (lines 1-13 — el bloque del `colors` const)
- Modify: `tailwind.config.js` (lines 8-24 — el bloque `theme.extend.colors.space`)
- Modify: `src/ui/GlowCard.tsx`

- [ ] **Step 1: Remapear `src/theme/colors.ts`**

Reemplazar el bloque `export const colors = { … }` (mantener `withAlpha` intacto al final) con:

```ts
// Paleta legacy. Las claves se conservan para no romper consumidores
// (`colors.dim`, `colors.purple`, etc.), pero los valores se remapearon
// a la paleta cream/coffee del nuevo theme. Los nombres son misnombres
// post-cream — la limpieza completa es trabajo de seguimiento.
export const colors = {
  black: "#000000",
  deep: "#fdf6e3",     // bg crema (era space deep)
  dark: "#fffaf0",     // card off-white (era space dark)
  mid: "#f5e8c8",      // tan suave (era space mid)
  purple: "#6b4423",   // accent café oscuro (era purple)
  violet: "#8b6f47",   // café medio (era violet)
  blue: "#dc2626",     // rojo progress (era blue) — usado en algunos hilos visuales
  sky: "#16a34a",      // verde progress (era sky)
  ink: "#3a2e1a",      // texto principal (era ink)
  mute: "#8b6f47",     // texto mute = café medio (era mute)
  dim: "#a89472"       // texto dim = sand (era dim)
} as const;

export type ColorKey = keyof typeof colors;
```

- [ ] **Step 2: Remapear `tailwind.config.js`**

Reemplazar el bloque `space: { … }` con:

```js
        space: {
          black: "#000000",
          deep: "#fdf6e3",
          dark: "#fffaf0",
          mid: "#f5e8c8",
          purple: "#6b4423",
          violet: "#8b6f47",
          blue: "#dc2626",
          sky: "#16a34a",
          ink: "#3a2e1a",
          mute: "#8b6f47",
          dim: "#a89472"
        }
```

(Los mismos hexes que `colors.ts` para mantener paridad exacta NativeWind ↔ inline.)

- [ ] **Step 3: Cream-ear `src/ui/GlowCard.tsx`**

Reemplazar el archivo completo con:

```tsx
import React from "react";
import { View, ViewProps } from "react-native";

export function GlowCard({ children, className, style, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      {...rest}
      className={`rounded-xl border border-space-purple/15 bg-space-dark p-4 ${className ?? ""}`}
      style={[
        {
          shadowColor: "#3a2e1a",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2
        },
        style
      ]}
    >
      {children}
    </View>
  );
}
```

(`bg-space-dark` ahora es off-white `#fffaf0`, `border-space-purple/15` es café oscuro al 15%, sombra suave en café para sustituir el glow púrpura.)

- [ ] **Step 4: Run typecheck + tests**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -8`
Expected: tsc PASS, 55 + 7 tests pasando (los 7 nuevos del Task 1).

- [ ] **Step 5: Commit**

```bash
git add src/theme/colors.ts tailwind.config.js src/ui/GlowCard.tsx
git commit -m "feat(theme): remap legacy palette + GlowCard to cream/coffee values"
```

---

## Task 5: Reemplazar `StarryBackground` en todas las pantallas y borrar el archivo

14 pantallas importan `StarryBackground`. El reemplazo es mecánico: cambiar el import y la etiqueta JSX. Home tiene un caso particular (`parallaxScrollY` prop), que se elimina porque `ThemedBackground` no necesita parallax.

**Files modified (cada uno con los 2 cambios):**
- `app/(tabs)/index.tsx`
- `app/(tabs)/album.tsx`
- `app/(tabs)/trades.tsx`
- `app/(tabs)/profile.tsx`
- `app/sticker/[code].tsx`
- `app/profile/edit.tsx`
- `app/add-friend/search.tsx`
- `app/friends/index.tsx`
- `app/friends/[username].tsx`
- `app/(auth)/sign-in.tsx`
- `app/(auth)/onboarding.tsx`
- `app/onboarding/[step].tsx`
- `app/about.tsx`

**File deleted:**
- `src/ui/StarryBackground.tsx`

- [ ] **Step 1: En cada uno de los 13 archivos de arriba, cambiar el import**

Buscar la línea:
```ts
import { StarryBackground } from "@/ui/StarryBackground";
```
y reemplazarla por:
```ts
import { ThemedBackground } from "@/ui/ThemedBackground";
```

- [ ] **Step 2: En cada archivo, cambiar `<StarryBackground>` → `<ThemedBackground>`**

JSX abre y cierra. Reemplazar:
- `<StarryBackground>` → `<ThemedBackground>`
- `</StarryBackground>` → `</ThemedBackground>`

- [ ] **Step 3: Caso especial Home — quitar `parallaxScrollY`**

En `app/(tabs)/index.tsx` línea 45 actualmente:
```tsx
<StarryBackground parallaxScrollY={scrollY}>
```
Queda:
```tsx
<ThemedBackground>
```

(El `scrollY` y `useSharedValue`/`useAnimatedScrollHandler` se mantienen — los usa `Animated.ScrollView` aparte. Sólo se quita la prop pasada al fondo.)

- [ ] **Step 4: Borrar el archivo viejo**

```bash
rm src/ui/StarryBackground.tsx
```

- [ ] **Step 5: Run typecheck**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit`
Expected: PASS — todos los imports antiguos resueltos al nuevo componente.

- [ ] **Step 6: Run tests**

Run: `eval "$(mise activate zsh)" && pnpm test 2>&1 | tail -8`
Expected: 62 tests passing (55 originales + 7 de progressColor).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(ui): replace StarryBackground with ThemedBackground across all screens"
```

(`-A` captura los 13 cambios de pantalla + el delete del componente viejo.)

---

## Task 6: Tab bar theme-aware + montar `ThemeProvider` + StatusBar

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Hacer el tab bar theme-aware**

Reemplazar `app/(tabs)/_layout.tsx` completo con:

```tsx
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

function TabIcon({ icon, focused, active, inactive }: { icon: string; focused: boolean; active: string; inactive: string }) {
  return (
    <Text style={{ fontSize: 22, color: focused ? active : inactive }}>{icon}</Text>
  );
}

export default function TabsLayout() {
  const { theme } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "shift",
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: 1
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMute
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon icon="⌂" focused={focused} active={theme.accent} inactive={theme.textMute} /> }}
      />
      <Tabs.Screen
        name="album"
        options={{ title: "Álbum", tabBarIcon: ({ focused }) => <TabIcon icon="▦" focused={focused} active={theme.accent} inactive={theme.textMute} /> }}
      />
      <Tabs.Screen
        name="trades"
        options={{ title: "Cambios", tabBarIcon: ({ focused }) => <TabIcon icon="↔" focused={focused} active={theme.accent} inactive={theme.textMute} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Perfil", tabBarIcon: ({ focused }) => <TabIcon icon="◔" focused={focused} active={theme.accent} inactive={theme.textMute} /> }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Montar `ThemeProvider` en `app/_layout.tsx` + StatusBar a `dark`**

Abrí `app/_layout.tsx`. Hay que (a) importar `ThemeProvider`, (b) envolver el árbol existente con él en el lugar correcto (dentro del root `<View>` o `<GestureHandlerRootView>`, antes del `<Stack>`/`<QueryClientProvider>` — depende de cómo esté estructurado el archivo), y (c) cambiar el `<StatusBar>` para que use `style="dark"` (que con bg crema renderiza icons oscuros legibles).

Read full file:

```bash
cat app/_layout.tsx
```

Localizá el JSX raíz (probablemente `<GestureHandlerRootView>` o un `<View>`). Envolvé los hijos con `<ThemeProvider>`:

```tsx
import { ThemeProvider } from "@/theme/ThemeProvider";
// …
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {/* … resto igual … */}
        <StatusBar style="dark" />
      </QueryClientProvider>
    </ThemeProvider>
  </GestureHandlerRootView>
);
```

Si `<StatusBar style="…">` ya existe, cambiar a `"dark"`. Si no existe, agregarlo dentro del provider.

- [ ] **Step 3: Run typecheck**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit`
Expected: PASS — `useTheme()` resuelve, no errores.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/_layout.tsx app/_layout.tsx
git commit -m "feat(theme): mount ThemeProvider, theme-aware tab bar, light status bar"
```

---

## Task 7: Wirear `progressColor` en Home y Álbum + borrar `userInterfaceStyle`

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/album.tsx`
- Modify: `app.json`

- [ ] **Step 1: En Home, usar `progressColor` para los dos `<ProgressBar>`**

En `app/(tabs)/index.tsx`:

1. Agregar imports al tope (después de los imports existentes):

```ts
import { progressColor } from "@/theme/progress";
import { useTheme } from "@/theme/ThemeProvider";
```

2. Dentro del componente `Home`, después de `const { data: pending } = usePendingCount();`, agregar:

```ts
const { theme } = useTheme();
```

3. Reemplazar el `<ProgressBar pct={data.pct} />` (línea ~72) por:

```tsx
<ProgressBar
  pct={data.pct}
  from={progressColor(data.pct, theme)}
  to={progressColor(data.pct, theme)}
/>
```

4. En el componente `SectionRow` (al final del archivo, línea ~123), recibir `theme` por prop o invocar `useTheme()`. Para evitar pasar prop, llamarlo dentro de `SectionRow`:

```tsx
function SectionRow({ s, onPress }: { s: SectionProgress; onPress: () => void }) {
  const { theme } = useTheme();
  const interactive = !!s.teamCode;
  const Wrapper = interactive ? Pressable : View;
  return (
    <Wrapper
      onPress={interactive ? onPress : undefined}
      accessibilityLabel={interactive ? `Abrir equipo ${s.section}` : undefined}
      accessibilityRole={interactive ? "button" : undefined}
    >
      <GlowCard className="mb-2">
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-space-ink font-semibold">{s.section}</Text>
          <Text className="text-space-mute text-xs">
            {s.collected}/{s.total}
            {interactive ? " ›" : ""}
          </Text>
        </View>
        <ProgressBar
          pct={s.pct}
          height={4}
          from={progressColor(s.pct, theme)}
          to={progressColor(s.pct, theme)}
        />
      </GlowCard>
    </Wrapper>
  );
}
```

(El `import { progressColor } from "@/theme/progress"` y `useTheme` ya quedaron al tope desde el paso anterior.)

- [ ] **Step 2: En Álbum, idéntico**

Read `app/(tabs)/album.tsx` completo (archivo no leído todavía). Si tiene `<ProgressBar>` en cualquier parte, aplicar el mismo patrón (import `progressColor` + `useTheme`, pasar `from`/`to` calculados). Si no usa `<ProgressBar>`, este paso es no-op.

```bash
cat app/\(tabs\)/album.tsx
```

Para cada `<ProgressBar pct={X} … />`, agregar `from={progressColor(X, theme)} to={progressColor(X, theme)}`.

- [ ] **Step 3: Borrar `userInterfaceStyle` de `app.json`**

Abrir `app.json`. En el bloque `expo`, eliminar la línea:

```json
    "userInterfaceStyle": "dark",
```

(También cuidar la coma de la línea siguiente para que el JSON quede válido.)

- [ ] **Step 4: Run typecheck + tests**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -8`
Expected: tsc PASS, 62 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/index.tsx app/\(tabs\)/album.tsx app.json
git commit -m "feat(theme): dynamic progress colors in Home/Album + drop dark-only enforcement"
```

- [ ] **Step 6: Verificación visual (manual, usuario)**

El subagent NO puede correr el device. El usuario corre `pnpm start` y verifica:

- Home: bg crema, cards off-white, barras de progreso con color que cambia por porcentaje (rojo en equipos vacíos, ámbar al 50%, verde al 100%).
- Tab bar: fondo off-white, tab activa en café oscuro.
- Álbum, Cambios, Perfil: bg crema, contenido legible.
- Página de equipo (ej. MEX, ARG): sin cambios — sigue con su paleta de bandera.
- Sign-in / onboarding / about / friends / sticker modal: bg crema, contenido legible.
- Status bar: icons oscuros (legibles sobre crema).

Si algún screen se ve roto (texto gris claro perdido sobre crema, etc.), reportar y se patchea per-screen en F1.5.

---

## Self-Review

**1. Spec coverage:**

- ✅ Paleta light cream → Task 2 (`themes.ts` con `lightTheme`).
- ✅ Lógica de progress bar dinámica → Task 1 (`progressColor`) + Task 7 (callsites Home/Álbum).
- ✅ ThemeProvider + useTheme → Task 2.
- ✅ Reemplazo de `StarryBackground` por `ThemedBackground` → Task 3 + Task 5.
- ✅ Tab bar theme-aware → Task 6.
- ✅ Status bar dynamic — F1 fija a `"dark"` (light bg). F2 hará condicional.
- ✅ Quitar `userInterfaceStyle: "dark"` → Task 7.
- ✅ Borrar `StarryBackground.tsx` → Task 5.
- ✅ Toggle/AsyncStorage diferidos a F2 → ThemeProvider en F1 hardcodea light, `setMode` no-op.
- ✅ No tocar la team page → ningún task la modifica.
- ⚠️ Aclaración respecto a la spec: la spec decía "no tocar `colors.ts`" pero F1 necesita remapearle los valores para que las pantallas que no migran a `useTheme()` tengan apariencia cream coherente. Documentado en Task 4 con justificación: "los nombres se conservan, los valores se remapean — full rename queda como cleanup posterior". Sin esto, F1 ship-able requeriría migrar cada NativeWind class (lift mucho mayor).

**2. Placeholder scan:** sin TBD/TODO/handle errors abstractos. Cada step tiene comando o código exacto.

**3. Type consistency:**
- `Theme` interface (Task 2) tiene 10 campos. `progressColor` (Task 1) sólo accede a 3 (`progressRed/Amber/Green`); el tipo `Stops` es un subset estructural compatible — testeable sin armar el theme completo.
- `ThemeProvider` y `useTheme()` shape consistente entre Task 2 (definición) y Task 6 (consumo).
- `progressColor(pct, theme)` firma idéntica entre Task 1 (definición) y Task 7 (uso).

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-05-03-app-cream-theme-f1.md`. Dos opciones de ejecución:

1. **Subagent-Driven (recomendado)** — dispatch de un subagent fresh por task, review entre tasks, iteración rápida.
2. **Inline Execution** — ejecutar las tasks en esta sesión con `executing-plans`, batch con checkpoints.

¿Cuál preferís?
