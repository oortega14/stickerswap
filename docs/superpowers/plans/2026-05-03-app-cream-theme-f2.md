# Cream/Coffee Theme — F2 Implementation Plan (dark mode + toggle)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar modo oscuro ("espresso") con un toggle persistente en Perfil. La identidad visual de la app es la misma de noche que de día — sólo se invierten las bases.

**Architecture:** Se agrega `darkTheme` a `themes.ts`, se hace al `ThemeProvider` reactivo con `useState` + persistencia en AsyncStorage, y se migran los pocos colores hardcoded que quedaron en F1 a `useTheme()`. La parte clave: la paleta legacy (`text-space-mute`, `bg-space-dark`, etc., usada en muchas pantallas) se enchufa al theme dinámicamente vía **CSS variables + NativeWind `vars()`**. `tailwind.config.js` pasa cada `space.*` a una `var(--space-*)`, y `ThemeProvider` aplica el set de vars correspondiente al modo activo. Así toggleamos toda la app sin migrar cada `className` a `useTheme()`.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript strict, NativeWind v4 (Tailwind), `@react-native-async-storage/async-storage`, `expo-status-bar`.

**Spec:** `docs/superpowers/specs/2026-05-03-app-cream-theme-design.md` (sección F2).

**Aclaración respecto a la spec**: la spec define la paleta dark y el persistence layer pero no especifica cómo se enchufa la paleta legacy NativeWind a la rotación de tema. Este plan resuelve eso con CSS variables vía `vars()` (la API oficial de NativeWind v4 para esto). No es desviación de objetivos — es el detalle técnico del puente.

**Limitación conocida**: AsyncStorage es una dependencia nativa. Tras el `pnpm exec expo install` (Task 2) hay que correr `pnpm exec expo prebuild --platform ios --clean` y rebuildear desde Xcode. Eso lo hace el usuario manualmente (subagent no puede correr Xcode). Lo señalamos al cierre.

---

## File Structure

**Create:**
- _(ningún archivo nuevo)_

**Modify:**
- `src/theme/themes.ts` — agregar `darkTheme` (Task 1).
- `package.json`, `pnpm-lock.yaml` — sumar `@react-native-async-storage/async-storage` (Task 2).
- `src/theme/ThemeProvider.tsx` — `useState` + AsyncStorage + `useMemo` + dispatch de `vars()` por modo (Tasks 3, 5).
- `tailwind.config.js` — `space.*` en formato `rgb(var(--space-*) / <alpha-value>)` (Task 5).
- `src/ui/ProgressBar.tsx`, `src/ui/GlowCard.tsx`, `src/ui/GlowGradientCard.tsx`, `src/ui/Skeleton.tsx`, `src/ui/AnimatedStickerCell.tsx` — `useTheme()` para colores hoy hardcoded (Task 4a).
- `app/_layout.tsx`, `app/(auth)/_layout.tsx`, `app/(tabs)/profile.tsx`, `app/(tabs)/trades.tsx`, `app/add-friend/search.tsx`, `app/friends/[username].tsx` — `useTheme()` para colores hoy hardcoded (Task 4b).
- `app/(tabs)/profile.tsx` — sumar sección "Apariencia" con Switch (Task 6).
- `app/_layout.tsx` — `<StatusBar>` dinámico vía componente envolvente (Task 7).

**No tocar:**
- `app/team/[code].tsx` — paleta por bandera, independiente de theme.
- `src/theme/teamColors.ts` — idem.
- `src/theme/progress.ts`, `src/theme/colors.ts` (la legacy const ya está remapeada a cream y los valores de fallback siguen siendo válidos en light; en dark, los componentes pasan a usar theme directo).
- Tests existentes (62 deben seguir verdes).

---

## Task 1: Agregar `darkTheme` a `themes.ts`

**Files:**
- Modify: `src/theme/themes.ts`

- [ ] **Step 1: Agregar `darkTheme` al final del archivo**

Abrí `src/theme/themes.ts`. Después del export de `lightTheme`, agregá:

```ts
export const darkTheme: Theme = {
  bg: "#2a1f12",
  card: "#3d2d1c",
  text: "#fdf6e3",
  textMute: "#c8a67a",
  border: "rgba(253,246,227,0.10)",
  track: "rgba(253,246,227,0.12)",
  accent: "#d4b896",
  progressRed: "#ef4444",
  progressAmber: "#f59e0b",
  progressGreen: "#22c55e"
};
```

(Mismas claves que `lightTheme`, valores invertidos por modo oscuro. Hex tomados de la spec.)

- [ ] **Step 2: Run typecheck**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/theme/themes.ts
git commit -m "feat(theme): add darkTheme tokens (espresso palette)"
```

---

## Task 2: Instalar AsyncStorage

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (los toca el comando `expo install`).

- [ ] **Step 1: Instalar la dependencia con la versión correcta para el SDK**

Run:
```bash
eval "$(mise activate zsh)" && pnpm exec expo install @react-native-async-storage/async-storage
```
Expected: el comando elige la versión compatible con Expo SDK 54 y actualiza `package.json` + `pnpm-lock.yaml`.

- [ ] **Step 2: Verificar que `tsc` y los tests siguen pasando**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -8`
Expected: tsc PASS, 62 tests passing.

(No se lo importa todavía — Task 3 lo conecta.)

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install @react-native-async-storage/async-storage for theme persistence"
```

⚠️ **Nota para el usuario**: este paquete es nativo. Después del Task 8 final (verificación), corré:

```bash
eval "$(mise activate zsh)"
pnpm exec expo prebuild --platform ios --clean
```

Y luego hacé un build nuevo en Xcode (Personal Team signing). Sin esto, el módulo no enlaza y `AsyncStorage.getItem` falla en runtime.

---

## Task 3: `ThemeProvider` reactivo con persistencia en AsyncStorage

**Files:**
- Modify: `src/theme/ThemeProvider.tsx`

- [ ] **Step 1: Reemplazar el archivo con la versión reactiva**

Reemplazá `src/theme/ThemeProvider.tsx` entero por:

```tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightTheme, darkTheme, type Theme } from "./themes";

export type Mode = "light" | "dark";

const STORAGE_KEY = "panini.theme.mode";

type ThemeContextValue = {
  theme: Theme;
  mode: Mode;
  setMode: (m: Mode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("light");

  // Hidratar la preferencia desde AsyncStorage al boot (una sola vez).
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "dark" || stored === "light") {
          setModeState(stored);
        }
      })
      .catch(() => {
        // Si AsyncStorage falla (módulo no enlazado, etc.), seguimos con default light.
      });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: mode === "dark" ? darkTheme : lightTheme,
      mode,
      setMode: async (m) => {
        setModeState(m);
        try {
          await AsyncStorage.setItem(STORAGE_KEY, m);
        } catch {
          // El estado en memoria ya cambió; si falla la persistencia, el toggle
          // funciona en sesión y se pierde al reiniciar. Aceptable.
        }
      }
    }),
    [mode]
  );

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

Cambios respecto a F1:
- Importa `useEffect`, `useMemo`, `useState` y `darkTheme`.
- `mode` ahora es state. Se hidrata desde AsyncStorage en mount (boot del provider).
- `setMode` actualiza el state y persiste a AsyncStorage. Si AsyncStorage falla, el toggle igual funciona en sesión.
- `value` está memoizado por `mode` — evita re-renders innecesarios de los consumidores.
- `STORAGE_KEY` es constante en el módulo: `"panini.theme.mode"`.
- Maneja errores silenciosamente (catch sin throw); el theme system es no-crítico.

- [ ] **Step 2: Run typecheck + tests**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -8`
Expected: tsc PASS, 62 tests passing.

- [ ] **Step 3: Commit**

```bash
git add src/theme/ThemeProvider.tsx
git commit -m "feat(theme): make ThemeProvider reactive with AsyncStorage persistence"
```

---

## Task 4a: Migrar primitives UI a `useTheme()`

Cinco componentes presentacionales tienen colores hardcoded a coffee/cream que F1 dejó como aproximación. En F2 toggleamos al modo oscuro: esos hex deben venir del theme. Cada componente pasa a llamar `useTheme()` y usar tokens.

**Files:**
- Modify: `src/ui/ProgressBar.tsx`
- Modify: `src/ui/GlowCard.tsx`
- Modify: `src/ui/GlowGradientCard.tsx`
- Modify: `src/ui/Skeleton.tsx`
- Modify: `src/ui/AnimatedStickerCell.tsx`

- [ ] **Step 1: `ProgressBar.tsx` — track del theme**

Leé el archivo actual:

```bash
cat src/ui/ProgressBar.tsx
```

Reemplazá el archivo entero por:

```tsx
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useTheme } from "@/theme/ThemeProvider";

const ARect = Animated.createAnimatedComponent(Rect);

export function ProgressBar({
  pct,
  height = 8,
  from,
  to
}: {
  pct: number;
  height?: number;
  from?: string;
  to?: string;
}) {
  const { theme } = useTheme();
  const fromColor = from ?? theme.accent;
  const toColor = to ?? theme.progressGreen;
  const clamped = Math.max(0, Math.min(1, pct));
  const w = useSharedValue(clamped);

  useEffect(() => {
    w.value = withTiming(clamped, { duration: 600 });
  }, [clamped, w]);

  const props = useAnimatedProps(() => ({
    width: `${w.value * 100}%` as unknown as number
  }));

  return (
    <View style={{ height, width: "100%" }}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id="pb" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={fromColor} />
            <Stop offset="1" stopColor={toColor} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={height} rx={height / 2} fill={theme.track} />
        <ARect
          animatedProps={props}
          height={height}
          rx={height / 2}
          fill="url(#pb)"
        />
      </Svg>
    </View>
  );
}
```

Cambios:
- Import `useTheme`.
- `from`/`to` ya no tienen defaults estáticos (`#7c5cff`/`#3b82f6` legacy). Defaults ahora vienen del theme: `theme.accent` y `theme.progressGreen` (mantiene un look temático cuando ningún caller pasa colores).
- Track usa `theme.track` (fue `rgba(0,0,0,0.10)` en F1; ahora se invierte en dark a `rgba(253,246,227,0.12)`).

- [ ] **Step 2: `GlowCard.tsx` — bordes/sombra del theme**

Reemplazá `src/ui/GlowCard.tsx` por:

```tsx
import React from "react";
import { View, ViewProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export function GlowCard({ children, className, style, ...rest }: ViewProps & { className?: string }) {
  const { theme } = useTheme();
  return (
    <View
      {...rest}
      className={`rounded-xl bg-space-dark p-4 ${className ?? ""}`}
      style={[
        {
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: theme.text,
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

Cambios:
- Drop `border-space-purple/15` className → border ahora viene de `theme.border` inline (con la opacidad ya bakeada en la rgba del token).
- `shadowColor` pasa de `#3a2e1a` hardcoded a `theme.text` (dark text en light, cream text en dark — ambos generan sombra contrastante con su fondo).

- [ ] **Step 3: `GlowGradientCard.tsx` — gradient del theme**

Leé el archivo actual primero:

```bash
cat src/ui/GlowGradientCard.tsx
```

Identificá el `LinearGradient` con colores `["#6b4423", "#8b6f47"]` y la sombra con `shadowColor: "#3a2e1a"`. Reemplazalos por:

```tsx
// dentro del componente, encima del return:
const { theme } = useTheme();
```

Y en el JSX:
- `colors={[theme.accent, theme.textMute]}` (en lugar del array hardcoded)
- `shadowColor: theme.text` (en lugar de `"#3a2e1a"`)

Sumá el import de `useTheme`:

```tsx
import { useTheme } from "@/theme/ThemeProvider";
```

(Si la firma del componente o el resto del shadow no cambia, mantenelo como está.)

- [ ] **Step 4: `Skeleton.tsx` — bg del theme**

Leé el archivo:

```bash
cat src/ui/Skeleton.tsx
```

Identificá la(s) línea(s) que usan `rgba(0,0,0,0.06)` (o la versión que F1 dejó). Sumá el import de `useTheme` y reemplazá la color por `theme.track`. Si el componente usa un shimmer con dos tonos, el highlight pasa a `theme.border` (más sutil).

Patrón general:

```tsx
import { useTheme } from "@/theme/ThemeProvider";

export function Skeleton({ /* … props existentes … */ }) {
  const { theme } = useTheme();
  // … reemplazar el bg fijo por theme.track …
}
```

- [ ] **Step 5: `AnimatedStickerCell.tsx` — borders y badge del theme**

Leé el archivo:

```bash
cat src/ui/AnimatedStickerCell.tsx
```

Sumá `useTheme()` y reemplazá:
- `borderColor: "rgba(0,0,0,0.12)"` (collected) → `borderColor: theme.border`
- `borderColor: "rgba(0,0,0,0.18)"` (uncollected) → reforzar visualmente: `borderColor: theme.textMute` con `opacity: 0.4` aplicada al borde, o más simple: `borderColor: theme.text` con borderOpacity sutil.
  - Si la herramienta no permite opacity en borderColor, dejá `theme.textMute` solo (en light queda café medio sobre off-white = visible; en dark queda latte sobre coffee medio = visible).
- `backgroundColor: colors.blue` (legacy red, badge ×N) → `backgroundColor: theme.text` (cream-dark da contraste)
- Asegurate que el texto adentro del badge use `color: theme.bg` (negativo del badge bg).

Sumá:

```tsx
import { useTheme } from "@/theme/ThemeProvider";
// dentro del componente:
const { theme } = useTheme();
```

- [ ] **Step 6: Run typecheck + tests**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -8`
Expected: tsc PASS, 62 tests passing.

- [ ] **Step 7: Commit**

```bash
git add 'src/ui/ProgressBar.tsx' 'src/ui/GlowCard.tsx' 'src/ui/GlowGradientCard.tsx' 'src/ui/Skeleton.tsx' 'src/ui/AnimatedStickerCell.tsx'
git commit -m "feat(theme): primitive UI components consume theme via useTheme()"
```

---

## Task 4b: Migrar layouts y screens hardcoded a `useTheme()`

Las pantallas y layouts que F1 dejó con coffee hardcoded.

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(auth)/_layout.tsx`
- Modify: `app/(tabs)/profile.tsx`
- Modify: `app/(tabs)/trades.tsx`
- Modify: `app/add-friend/search.tsx`
- Modify: `app/friends/[username].tsx`

- [ ] **Step 1: `app/_layout.tsx` — ActivityIndicator + contentStyle del theme**

Leé `app/_layout.tsx`. Identificá:
- `<ActivityIndicator color="#6b4423" />` (booting state)
- `contentStyle: { backgroundColor: "#fdf6e3" }` (en el Stack `screenOptions`)

Necesitás el theme en estas líneas. Como el `<ActivityIndicator>` está dentro del `<ThemeProvider>`, podés crear un componente envolvente chico cerca del top del archivo:

```tsx
function ThemedLoader() {
  const { theme } = useTheme();
  return <ActivityIndicator color={theme.accent} />;
}

function ThemedStack() {
  const { theme } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
      {/* …  whatever screens were there … */}
    </Stack>
  );
}
```

Reemplazá los usos directos de `<ActivityIndicator color="#6b4423" />` y `<Stack screenOptions={{ contentStyle: { backgroundColor: "#fdf6e3" } }} />` por estos wrappers.

Sumá el import:

```tsx
import { useTheme } from "@/theme/ThemeProvider";
```

(Si hay más de un Stack, replicá el patrón para cada uno.)

- [ ] **Step 2: `app/(auth)/_layout.tsx` — contentStyle del theme**

Leé el archivo. Reemplazá el inline `contentStyle: { backgroundColor: "#fdf6e3" }` por un wrapper componente análogo, o convertí el componente del archivo a usar `useTheme()` y `theme.bg`. Sumá el import.

```tsx
import { useTheme } from "@/theme/ThemeProvider";

export default function AuthLayout() {
  const { theme } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
      {/* … */}
    </Stack>
  );
}
```

- [ ] **Step 3: `app/(tabs)/profile.tsx` — avatar del theme**

Leé el archivo. Identificá el `Initials` (o avatar fallback) con `backgroundColor: "#6b4423"`. Cambiá a `backgroundColor: theme.accent` y sumá `const { theme } = useTheme();` arriba en el componente que lo renderiza. Sumá el import de `useTheme`.

(El Switch del tema lo agrega Task 6; no lo toques aquí.)

- [ ] **Step 4: `app/(tabs)/trades.tsx` — Switch trackColor del theme**

Leé el archivo. Identificá el `<Switch trackColor={{ false: "rgba(0,0,0,0.15)", true: "#6b4423" }} />`. Cambiá:

```tsx
<Switch
  trackColor={{ false: theme.border, true: theme.accent }}
  thumbColor={theme.card}
  // … resto de props …
/>
```

Sumá `const { theme } = useTheme();` en el componente y el import.

- [ ] **Step 5: `app/add-friend/search.tsx` y `app/friends/[username].tsx` — ActivityIndicator del theme**

En ambos archivos, identificá el `<ActivityIndicator color="#6b4423" />` y cambiá a `<ActivityIndicator color={theme.accent} />`. Sumá `const { theme } = useTheme();` y el import.

- [ ] **Step 6: Run typecheck + tests**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -8`
Expected: tsc PASS, 62 tests passing.

- [ ] **Step 7: Commit**

```bash
git add app/_layout.tsx 'app/(auth)/_layout.tsx' 'app/(tabs)/profile.tsx' 'app/(tabs)/trades.tsx' app/add-friend/search.tsx 'app/friends/[username].tsx'
git commit -m "feat(theme): layouts and screens consume theme via useTheme()"
```

---

## Task 5: Enchufar la paleta legacy NativeWind al theme via `vars()`

Esta es la pieza arquitectónica de F2: hacer que todas las clases NativeWind tipo `text-space-mute`, `bg-space-deep`, `border-space-purple/15`, etc., respondan al modo activo. Lo hacemos pasando la paleta `space.*` a CSS variables en `tailwind.config.js`, y aplicando las variables desde el `ThemeProvider` con `vars()`.

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/theme/ThemeProvider.tsx`

- [ ] **Step 1: Convertir `tailwind.config.js` para usar `var()` con `<alpha-value>`**

Reemplazá el bloque `space: { … }` dentro de `theme.extend.colors` por:

```js
        space: {
          black: "rgb(var(--space-black) / <alpha-value>)",
          deep: "rgb(var(--space-deep) / <alpha-value>)",
          dark: "rgb(var(--space-dark) / <alpha-value>)",
          mid: "rgb(var(--space-mid) / <alpha-value>)",
          purple: "rgb(var(--space-purple) / <alpha-value>)",
          violet: "rgb(var(--space-violet) / <alpha-value>)",
          blue: "rgb(var(--space-blue) / <alpha-value>)",
          sky: "rgb(var(--space-sky) / <alpha-value>)",
          ink: "rgb(var(--space-ink) / <alpha-value>)",
          mute: "rgb(var(--space-mute) / <alpha-value>)",
          dim: "rgb(var(--space-dim) / <alpha-value>)"
        }
```

El placeholder `<alpha-value>` permite que clases tipo `border-space-purple/15` funcionen — Tailwind lo expande a la opacidad pedida. Los valores RGB van como triplete separado por espacios (formato Tailwind v3+).

- [ ] **Step 2: Definir los sets de vars en `ThemeProvider.tsx`**

Importá `vars` de NativeWind y `View` de RN, y definí dos sets de variables (uno por modo). Después wrappá los `children` con un `<View style={...vars}>`. Reemplazá el archivo entero por:

```tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { vars } from "nativewind";
import { lightTheme, darkTheme, type Theme } from "./themes";

export type Mode = "light" | "dark";

const STORAGE_KEY = "panini.theme.mode";

type ThemeContextValue = {
  theme: Theme;
  mode: Mode;
  setMode: (m: Mode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const lightSpaceVars = vars({
  "--space-black": "0 0 0",
  "--space-deep": "253 246 227",
  "--space-dark": "255 250 240",
  "--space-mid": "245 232 200",
  "--space-purple": "107 68 35",
  "--space-violet": "139 111 71",
  "--space-blue": "220 38 38",
  "--space-sky": "22 163 74",
  "--space-ink": "58 46 26",
  "--space-mute": "139 111 71",
  "--space-dim": "168 148 114"
});

const darkSpaceVars = vars({
  "--space-black": "0 0 0",
  "--space-deep": "42 31 18",
  "--space-dark": "61 45 28",
  "--space-mid": "77 58 37",
  "--space-purple": "212 184 150",
  "--space-violet": "200 166 122",
  "--space-blue": "239 68 68",
  "--space-sky": "34 197 94",
  "--space-ink": "253 246 227",
  "--space-mute": "200 166 122",
  "--space-dim": "156 136 106"
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "dark" || stored === "light") {
          setModeState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: mode === "dark" ? darkTheme : lightTheme,
      mode,
      setMode: async (m) => {
        setModeState(m);
        try {
          await AsyncStorage.setItem(STORAGE_KEY, m);
        } catch {}
      }
    }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, mode === "dark" ? darkSpaceVars : lightSpaceVars]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
```

Detalles importantes:
- Las RGB vars son **strings con espacios**, no comas (formato Tailwind moderno: `"107 68 35"`).
- `vars()` devuelve un objeto que React Native puede pasar como `style`.
- El `<View style={[{ flex: 1 }, ...]}>` propaga las vars al árbol — todos los hijos heredan las CSS vars y NativeWind las consume al resolver `var(--space-*)`.
- Combina lo de Task 3 (state + persistencia) con la nueva integración de vars en un mismo archivo.

- [ ] **Step 3: Run typecheck + tests**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -8`
Expected: tsc PASS, 62 tests passing.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js src/theme/ThemeProvider.tsx
git commit -m "feat(theme): wire legacy NativeWind palette to dynamic CSS vars"
```

---

## Task 6: Sumar Switch en Perfil ("Apariencia")

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Leer el archivo y entender la estructura**

```bash
cat app/\(tabs\)/profile.tsx
```

Identificá una sección apropiada para insertar el bloque "Apariencia". Patrón típico en este repo: existe una lista de filas tipo settings (probablemente `Cerrar sesión`, `Editar perfil`, etc.). Insertá la nueva sección **antes** de las filas críticas (sign-out, etc.) — usualmente al principio.

- [ ] **Step 2: Sumar imports**

Si no están ya:

```tsx
import { Switch, View, Text } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
```

- [ ] **Step 3: Sumar la sección al JSX**

Dentro del componente Profile, después de `const { ... } = useSession()` (o donde tenga sentido leer hooks), agregá:

```tsx
const { theme, mode, setMode } = useTheme();
```

Y el bloque visual:

```tsx
<View className="mb-4">
  <Text className="text-space-mute text-xs tracking-widest mb-2">APARIENCIA</Text>
  <View
    className="rounded-xl bg-space-dark px-4 py-3 flex-row items-center justify-between"
    style={{ borderWidth: 1, borderColor: theme.border }}
  >
    <Text className="text-space-ink text-base">Tema oscuro</Text>
    <Switch
      value={mode === "dark"}
      onValueChange={(v) => setMode(v ? "dark" : "light")}
      trackColor={{ false: theme.border, true: theme.accent }}
      thumbColor={theme.card}
      accessibilityLabel="Tema oscuro"
    />
  </View>
</View>
```

(Las clases NativeWind `bg-space-dark`, `text-space-ink`, `text-space-mute` ahora respetan el modo gracias a Task 5. El borde con `theme.border` queda inline porque `border-space-*` requeriría definir un alpha en clase y queremos el rgba ya construido.)

- [ ] **Step 4: Run typecheck + tests**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -8`
Expected: tsc PASS, 62 tests passing.

- [ ] **Step 5: Commit**

```bash
git add 'app/(tabs)/profile.tsx'
git commit -m "feat(profile): add Appearance section with dark mode toggle"
```

---

## Task 7: `<StatusBar>` dinámico

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Crear un componente `ThemedStatusBar` y usarlo en lugar del fijo**

En `app/_layout.tsx`:

1. Sumá el import si falta:
   ```tsx
   import { useTheme } from "@/theme/ThemeProvider";
   ```

2. Cerca del top del archivo (al lado de los otros componentes locales), agregá:
   ```tsx
   function ThemedStatusBar() {
     const { mode } = useTheme();
     return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
   }
   ```

3. En el JSX raíz, reemplazá `<StatusBar style="dark" />` por `<ThemedStatusBar />`.

(`<ThemedStatusBar>` debe vivir como hijo de `<ThemeProvider>`, lo que ya cumple por la jerarquía actual.)

- [ ] **Step 2: Run typecheck + tests**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -8`
Expected: tsc PASS, 62 tests passing.

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(theme): make StatusBar style react to active mode"
```

---

## Task 8: Verificación + actualización de docs

**Files:**
- Modify: `CLAUDE.md` (chequeo final).

- [ ] **Step 1: Confirmar que `CLAUDE.md` no tiene referencias obsoletas**

`CLAUDE.md` ya tuvo la línea "dark-only" reemplazada en F1. Releé la sección donde se mencionaba el tema (alrededor de "Convenciones" o "Notas") y asegurate que ahora dice algo como:

> La app soporta tema claro y oscuro. Default light. Toggle en Perfil → Apariencia. Persistencia en AsyncStorage (clave `panini.theme.mode`).

Si la frase actual no incluye persistencia ni el toggle, ajustala para reflejar F2. Edición chica.

- [ ] **Step 2: Run typecheck final + tests**

Run: `eval "$(mise activate zsh)" && pnpm exec tsc --noEmit && pnpm test 2>&1 | tail -8`
Expected: tsc PASS, 62 tests passing.

- [ ] **Step 3: Commit (si CLAUDE.md cambió)**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with F2 theme toggle behavior"
```

(Si no fue necesario tocarlo, skip.)

- [ ] **Step 4: Verificación visual (manual, usuario)**

El subagent NO puede correr Xcode ni un device. El usuario corre:

```bash
cd ~/projects/panini-album
eval "$(mise activate zsh)"
pnpm exec expo prebuild --platform ios --clean
# luego abrir Xcode y ▶ Play
```

Después abre la app y verifica:
- Boot en light (default).
- Perfil → "Tema oscuro" ON → toda la app cambia a espresso (bg dark, cards café medio, texto crema, barras de progreso con stops más vibrantes).
- Cerrar y abrir la app: persiste el modo.
- Toggle OFF → vuelve a cream.
- StatusBar: icons claros en dark, oscuros en light.
- Las páginas de equipo siguen sin cambios (sus colores son por bandera, no por theme).
- Buscar en pantallas frías (loading state, sticker modal, friends list, sign-in) que el bg, las cards, el texto, los bordes y los indicadores respeten el modo activo.

Si algo se ve raro (texto invisible, card cream sobre bg cream, etc.), reportá la pantalla y se patcha.

---

## Self-Review

**1. Spec coverage:**

- ✅ `darkTheme` palette → Task 1.
- ✅ AsyncStorage persistence → Task 2 (install) + Task 3 (provider).
- ✅ ThemeProvider reactivo → Task 3 + Task 5 (combina state + vars).
- ✅ Switch en Perfil "Apariencia" → Task 6.
- ✅ StatusBar dinámico → Task 7.
- ✅ Default light, toggle manual (no detect del sistema) → Task 3 (hardcoded `useState<Mode>("light")` y sólo lee storage).
- ✅ NativeWind palette se invierte en dark → Task 5 (CSS vars + `vars()`).
- ✅ Hardcoded coffee colors de F1 migrados → Tasks 4a + 4b.
- ✅ CLAUDE.md actualizado → Task 8.
- ✅ Team page intacto → ningún task la lista.

**2. Placeholder scan:** sin TBD/TODO/handle errors abstractos. Cada step tiene comando o código exacto.

**3. Type consistency:**
- `Mode` exportado del provider, usado en Task 4 y Task 6.
- `Theme` interface inalterada (Task 1 sólo agrega `darkTheme: Theme`).
- `progressColor(pct, theme)` no se toca — Theme tiene los mismos slots, sólo cambian valores.
- `STORAGE_KEY = "panini.theme.mode"` consistente entre Task 3 y la versión final en Task 5.
- La firma de `setMode: (m: Mode) => Promise<void>` se mantiene de F1.

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-05-03-app-cream-theme-f2.md`. Dos opciones de ejecución:

1. **Subagent-Driven (recomendado)** — dispatch de un subagent fresh por task, review entre tasks, iteración rápida.
2. **Inline Execution** — ejecutar las tasks en esta sesión con `executing-plans`, batch con checkpoints.

¿Cuál preferís?
