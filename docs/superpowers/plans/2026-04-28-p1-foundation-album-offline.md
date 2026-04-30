# P1 — Foundation + Álbum offline · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicación Expo (iOS + Android) en la que podés navegar el álbum del Mundial 2026, marcar figuritas pegadas/repetidas, y ver tu progreso por sección. Todo offline, sin login, sin nube.

**Architecture:** Expo Router (file-based) + TypeScript + NativeWind + Reanimated + expo-sqlite. Single source of truth local: SQLite con datos sembrados desde `stickers.json` empaquetado. Sin red, sin auth.

**Tech Stack:** Expo SDK 53, React Native, TypeScript, Expo Router, NativeWind v4, Reanimated v3, expo-sqlite, expo-haptics, Zustand, TanStack Query, Jest + @testing-library/react-native.

**Spec referenciada:** `docs/superpowers/specs/2026-04-28-panini-album-design.md` — secciones 3 (stack), 4 (modelo de datos local), 6 (estructura del app — solo tabs Home/Álbum), 9 (visual), 11 (testing).

**Lo que NO se construye en P1 (queda para planes posteriores):**
- Auth (Apple/Google) — P2
- Sync con Supabase — P2
- Tabs Cambios y Perfil completas — P3, P4
- Compartir lista por share sheet — P3
- Sistema de amigos / matches / Realtime — P4

---

## Estructura de archivos a crear

```
panini-album/
├── app.json                          # config Expo
├── package.json                      # deps + scripts
├── tsconfig.json                     # TS strict
├── babel.config.js                   # Expo + Reanimated + NativeWind
├── metro.config.js                   # NativeWind plugin
├── tailwind.config.js                # tema espacial
├── global.css                        # Tailwind directives
├── jest.config.js                    # Jest con preset jest-expo
├── jest.setup.ts                     # mocks (haptics, sqlite, etc.)
├── nativewind-env.d.ts               # tipos de className
│
├── assets/
│   └── stickers.json                 # dataset (sample 30 entries)
│
├── src/
│   ├── theme/
│   │   ├── colors.ts                 # paleta exacta del spec sec 9
│   │   └── tokens.ts                 # spacing, radii, typography
│   │
│   ├── ui/
│   │   ├── StarryBackground.tsx      # SVG con estrellas estáticas
│   │   ├── GlowCard.tsx              # card con borde+glow púrpura
│   │   ├── ProgressBar.tsx           # barra con gradiente
│   │   └── FilterChip.tsx            # chip toggle (Todos/Faltan/Repe)
│   │
│   ├── data/
│   │   ├── db.ts                     # singleton expo-sqlite
│   │   ├── schema.ts                 # CREATE TABLEs + migrations
│   │   ├── seed.ts                   # carga stickers.json al primer boot
│   │   ├── stickers.ts               # queries: getAll, getBySection, search
│   │   └── stickerStatus.ts          # queries: get, increment, decrement
│   │
│   ├── domain/
│   │   ├── progress.ts               # cálculo de progreso (puro)
│   │   └── types.ts                  # Sticker, StickerStatus, Section
│   │
│   ├── hooks/
│   │   ├── useStickers.ts            # TanStack Query wrapper
│   │   └── useProgress.ts            # progreso reactivo
│   │
│   └── store/
│       └── filters.ts                # Zustand: filtro activo, búsqueda
│
├── app/
│   ├── _layout.tsx                   # root: providers, theme, db init
│   ├── (tabs)/
│   │   ├── _layout.tsx               # tab bar (4 tabs, 2 funcionales)
│   │   ├── index.tsx                 # Home: progreso
│   │   ├── album.tsx                 # Grid + buscador + filtros
│   │   ├── trades.tsx                # placeholder
│   │   └── profile.tsx               # placeholder
│   └── sticker/[code].tsx            # detalle modal
│
└── tests/
    ├── domain/progress.test.ts
    ├── data/seed.test.ts
    └── data/stickerStatus.test.ts
```

---

## Task 1: Bootstrap del proyecto Expo

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `nativewind-env.d.ts`

- [ ] **Step 1.1: Crear el proyecto Expo con plantilla TypeScript**

Estamos parados en `/Users/oscarortega/projects/panini-album` con git ya inicializado y un commit con el spec. Creamos el scaffolding sin pisar el repo.

Run:
```bash
cd /Users/oscarortega/projects/panini-album
# Usamos --no-install para no romper si ya hay archivos; instalamos deps después
npx create-expo-app@latest . --template blank-typescript --no-install
```

Si pregunta confirmación por archivos existentes (.git, docs/), aceptá "yes". El comando crea: `app/`, `App.tsx` (lo borraremos), `package.json`, `tsconfig.json`, `app.json`, `assets/`, `index.ts`.

- [ ] **Step 1.2: Reemplazar `package.json` con dependencias finales**

Sobreescribir `package.json` con:

```json
{
  "name": "panini-album",
  "version": "0.1.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "ios": "expo run:ios",
    "android": "expo run:android",
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "lint": "expo lint"
  },
  "dependencies": {
    "@react-navigation/native": "^7.0.0",
    "@tanstack/react-query": "^5.59.0",
    "expo": "~53.0.0",
    "expo-blur": "~14.0.0",
    "expo-constants": "~17.0.0",
    "expo-haptics": "~14.0.0",
    "expo-linking": "~7.0.0",
    "expo-router": "~4.0.0",
    "expo-splash-screen": "~0.29.0",
    "expo-sqlite": "~15.0.0",
    "expo-status-bar": "~2.0.0",
    "expo-system-ui": "~4.0.0",
    "nativewind": "^4.1.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-native": "0.76.0",
    "react-native-gesture-handler": "~2.20.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-safe-area-context": "~4.12.0",
    "react-native-screens": "~4.1.0",
    "react-native-svg": "15.8.0",
    "react-native-web": "~0.19.13",
    "tailwindcss": "^3.4.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@testing-library/jest-native": "^5.4.3",
    "@testing-library/react-native": "^12.7.0",
    "@types/jest": "^29.5.13",
    "@types/react": "~18.3.12",
    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "react-test-renderer": "18.3.1",
    "typescript": "~5.6.3"
  },
  "private": true
}
```

- [ ] **Step 1.3: Instalar dependencias**

Run:
```bash
npm install
```
Expected: completa sin errores. Crea `node_modules/` y `package-lock.json`.

- [ ] **Step 1.4: Reemplazar `app.json`**

```json
{
  "expo": {
    "name": "Panini Album",
    "slug": "panini-album",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "panini",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0a0820"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "app.panini.mundial2026"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0a0820"
      },
      "package": "app.panini.mundial2026"
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-sqlite"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 1.5: Reemplazar `tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts",
    "nativewind-env.d.ts"
  ]
}
```

- [ ] **Step 1.6: Crear `babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel"
    ],
    plugins: ["react-native-reanimated/plugin"]
  };
};
```

- [ ] **Step 1.7: Crear `metro.config.js`**

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 1.8: Crear `nativewind-env.d.ts`**

```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 1.9: Borrar archivos de la plantilla que no usaremos**

Run:
```bash
rm -f App.tsx
```
(`expo-router` toma el control desde `app/` y no necesita `App.tsx`.)

- [ ] **Step 1.10: Verificar que el proyecto type-checkea**

Run:
```bash
npm run typecheck
```
Expected: 0 errores. Si hay errores de paths, revisar `tsconfig.json`.

- [ ] **Step 1.11: Commit**

```bash
git add package.json package-lock.json app.json tsconfig.json babel.config.js metro.config.js nativewind-env.d.ts index.ts assets/ .gitignore
git commit -m "chore: bootstrap Expo + TS + NativeWind + Reanimated"
```

---

## Task 2: Configurar tema espacial

**Files:**
- Create: `tailwind.config.js`, `global.css`, `src/theme/colors.ts`, `src/theme/tokens.ts`

- [ ] **Step 2.1: Crear `tailwind.config.js`** con la paleta del spec

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        space: {
          black: "#000000",
          deep: "#0a0820",
          dark: "#16142e",
          mid: "#1c1648",
          purple: "#7c5cff",
          violet: "#a78bfa",
          blue: "#3b82f6",
          sky: "#60a5fa",
          ink: "#e8e6ff",
          mute: "#a59cdf",
          dim: "#8b86c4"
        }
      },
      fontFamily: {
        sans: ["System"]
      }
    }
  },
  plugins: []
};
```

- [ ] **Step 2.2: Crear `global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2.3: Crear `src/theme/colors.ts`** (copia tipada para usar en SVG/animaciones donde Tailwind no llega)

```ts
export const colors = {
  black: "#000000",
  deep: "#0a0820",
  dark: "#16142e",
  mid: "#1c1648",
  purple: "#7c5cff",
  violet: "#a78bfa",
  blue: "#3b82f6",
  sky: "#60a5fa",
  ink: "#e8e6ff",
  mute: "#a59cdf",
  dim: "#8b86c4"
} as const;

export type ColorKey = keyof typeof colors;
```

- [ ] **Step 2.4: Crear `src/theme/tokens.ts`**

```ts
export const radii = { sm: 6, md: 10, lg: 14, xl: 20 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32
} as const;
```

- [ ] **Step 2.5: Commit**

```bash
git add tailwind.config.js global.css src/theme/
git commit -m "feat(theme): define space-themed color palette and tokens"
```

---

## Task 3: Componentes UI base

**Files:**
- Create: `src/ui/StarryBackground.tsx`, `src/ui/GlowCard.tsx`, `src/ui/ProgressBar.tsx`, `src/ui/FilterChip.tsx`

- [ ] **Step 3.1: Crear `src/ui/StarryBackground.tsx`**

```tsx
import React from "react";
import { View, Dimensions } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop, Rect } from "react-native-svg";

const { width, height } = Dimensions.get("window");

// 60 estrellas pseudo-aleatorias pero estables (seed fijo)
const STARS = Array.from({ length: 60 }, (_, i) => {
  const x = (i * 1373 + 7) % width;
  const y = (i * 919 + 31) % height;
  const r = ((i * 17) % 3) * 0.4 + 0.5;
  const opacity = 0.3 + ((i * 13) % 70) / 100;
  return { x, y, r, opacity };
});

export function StarryBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Svg
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="nebula" cx="30%" cy="20%" r="80%">
            <Stop offset="0%" stopColor="#5b1ea3" stopOpacity="0.6" />
            <Stop offset="40%" stopColor="#1a0d4d" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#nebula)" />
        {STARS.map((s, i) => (
          <Circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#ffffff"
            opacity={s.opacity}
          />
        ))}
      </Svg>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
```

- [ ] **Step 3.2: Crear `src/ui/GlowCard.tsx`**

```tsx
import React from "react";
import { View, ViewProps } from "react-native";

export function GlowCard({ children, className, style, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      {...rest}
      className={`rounded-xl border border-space-purple/30 bg-space-dark/70 p-4 ${className ?? ""}`}
      style={[
        {
          shadowColor: "#7c5cff",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 6
        },
        style
      ]}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 3.3: Crear `src/ui/ProgressBar.tsx`**

```tsx
import React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";

export function ProgressBar({ pct, height = 8 }: { pct: number; height?: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View style={{ height, width: "100%" }}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id="pb" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#7c5cff" />
            <Stop offset="1" stopColor="#3b82f6" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={height} rx={height / 2} fill="#0f0d24" />
        <Rect
          width={`${clamped * 100}%`}
          height={height}
          rx={height / 2}
          fill="url(#pb)"
        />
      </Svg>
    </View>
  );
}
```

- [ ] **Step 3.4: Crear `src/ui/FilterChip.tsx`**

```tsx
import React from "react";
import { Pressable, Text } from "react-native";

export function FilterChip({
  label,
  active,
  onPress
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-3 py-1.5 ${active ? "bg-space-purple" : "bg-space-mid"}`}
    >
      <Text className={`text-xs font-semibold ${active ? "text-white" : "text-space-mute"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 3.5: Commit**

```bash
git add src/ui/
git commit -m "feat(ui): add StarryBackground, GlowCard, ProgressBar, FilterChip"
```

---

## Task 4: Tipos del dominio

**Files:**
- Create: `src/domain/types.ts`

- [ ] **Step 4.1: Crear `src/domain/types.ts`**

```ts
export type StickerType = "player" | "team_badge" | "stadium" | "icon" | "special";

export interface Sticker {
  code: string;
  number: number;
  name: string;
  team: string | null;
  section: string;
  type: StickerType;
}

export interface StickerStatus {
  stickerCode: string;
  count: number;
  updatedAt: number;
}

export interface StickerWithStatus extends Sticker {
  count: number;
}

export interface SectionProgress {
  section: string;
  total: number;
  collected: number;
  pct: number;
}

export interface OverallProgress {
  total: number;
  collected: number;
  pct: number;
  duplicates: number;
  bySection: SectionProgress[];
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(domain): define core types (Sticker, Status, Progress)"
```

---

## Task 5: Cálculo de progreso (puro, con tests)

**Files:**
- Create: `src/domain/progress.ts`, `tests/domain/progress.test.ts`, `jest.config.js`, `jest.setup.ts`

- [ ] **Step 5.1: Crear `jest.config.js`**

```js
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/tests/**/*.test.ts", "<rootDir>/tests/**/*.test.tsx"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-clone-referenced-element|@react-native-community|expo-modules-core|@unimodules/.*|sentry-expo|native-base|react-native-svg))"
  ]
};
```

- [ ] **Step 5.2: Crear `jest.setup.ts`** (vacío por ahora, llenamos en tareas con mocks)

```ts
// Setup global de Jest. Los mocks específicos van en tests individuales.
```

- [ ] **Step 5.3: Escribir el test fallido para `computeProgress`**

Crear `tests/domain/progress.test.ts`:

```ts
import { computeProgress } from "@/domain/progress";
import type { Sticker } from "@/domain/types";

const stickers: Sticker[] = [
  { code: "A1", number: 1, name: "Messi", team: "ARG", section: "Argentina", type: "player" },
  { code: "A2", number: 2, name: "De Paul", team: "ARG", section: "Argentina", type: "player" },
  { code: "B1", number: 3, name: "Mbappé", team: "FRA", section: "Francia", type: "player" }
];

describe("computeProgress", () => {
  it("returns 0% when nothing collected", () => {
    const r = computeProgress(stickers, []);
    expect(r.total).toBe(3);
    expect(r.collected).toBe(0);
    expect(r.pct).toBe(0);
    expect(r.duplicates).toBe(0);
  });

  it("counts collected stickers (count >= 1) and duplicates (count > 1)", () => {
    const r = computeProgress(stickers, [
      { stickerCode: "A1", count: 1, updatedAt: 1 },
      { stickerCode: "A2", count: 3, updatedAt: 1 }
    ]);
    expect(r.collected).toBe(2);
    expect(r.duplicates).toBe(2); // (3-1) extra de A2
    expect(r.pct).toBeCloseTo(2 / 3);
  });

  it("breaks down by section", () => {
    const r = computeProgress(stickers, [
      { stickerCode: "A1", count: 1, updatedAt: 1 }
    ]);
    const argentina = r.bySection.find((s) => s.section === "Argentina");
    const francia = r.bySection.find((s) => s.section === "Francia");
    expect(argentina).toEqual({ section: "Argentina", total: 2, collected: 1, pct: 0.5 });
    expect(francia).toEqual({ section: "Francia", total: 1, collected: 0, pct: 0 });
  });
});
```

- [ ] **Step 5.4: Ejecutar el test (debe fallar)**

Run:
```bash
npm test -- progress
```
Expected: FAIL — `Cannot find module '@/domain/progress'`.

- [ ] **Step 5.5: Implementar `src/domain/progress.ts`**

```ts
import type {
  Sticker,
  StickerStatus,
  OverallProgress,
  SectionProgress
} from "./types";

export function computeProgress(
  stickers: Sticker[],
  statuses: StickerStatus[]
): OverallProgress {
  const statusMap = new Map(statuses.map((s) => [s.stickerCode, s.count]));

  let collected = 0;
  let duplicates = 0;
  const sectionTotals = new Map<string, { total: number; collected: number }>();

  for (const s of stickers) {
    const count = statusMap.get(s.code) ?? 0;
    const has = count >= 1 ? 1 : 0;
    if (has) collected += 1;
    if (count > 1) duplicates += count - 1;

    const acc = sectionTotals.get(s.section) ?? { total: 0, collected: 0 };
    acc.total += 1;
    acc.collected += has;
    sectionTotals.set(s.section, acc);
  }

  const bySection: SectionProgress[] = Array.from(sectionTotals.entries())
    .map(([section, v]) => ({
      section,
      total: v.total,
      collected: v.collected,
      pct: v.total === 0 ? 0 : v.collected / v.total
    }))
    .sort((a, b) => a.section.localeCompare(b.section));

  return {
    total: stickers.length,
    collected,
    pct: stickers.length === 0 ? 0 : collected / stickers.length,
    duplicates,
    bySection
  };
}
```

- [ ] **Step 5.6: Ejecutar el test (debe pasar)**

Run:
```bash
npm test -- progress
```
Expected: PASS, 3 tests.

- [ ] **Step 5.7: Commit**

```bash
git add jest.config.js jest.setup.ts src/domain/progress.ts tests/domain/progress.test.ts
git commit -m "feat(domain): pure progress calculator with tests"
```

---

## Task 6: Dataset semilla `stickers.json`

**Files:**
- Create: `assets/stickers.json`

- [ ] **Step 6.1: Crear `assets/stickers.json` con muestra inicial**

Esta es una **muestra** de 30 entradas. El usuario va a completar las ~670 reales en una iteración posterior — la estructura es la que importa ahora.

```json
{
  "version": 1,
  "album": "FIFA World Cup 2026",
  "stickers": [
    { "code": "INTRO-1", "number": 1, "name": "Trophy", "team": null, "section": "Intro", "type": "icon" },
    { "code": "INTRO-2", "number": 2, "name": "Mascot", "team": null, "section": "Intro", "type": "icon" },
    { "code": "STAD-1", "number": 3, "name": "MetLife Stadium", "team": null, "section": "Estadios", "type": "stadium" },
    { "code": "STAD-2", "number": 4, "name": "AT&T Stadium", "team": null, "section": "Estadios", "type": "stadium" },
    { "code": "STAD-3", "number": 5, "name": "Estadio Azteca", "team": null, "section": "Estadios", "type": "stadium" },
    { "code": "ARG-1", "number": 100, "name": "Argentina (Crest)", "team": "ARG", "section": "Argentina", "type": "team_badge" },
    { "code": "ARG-2", "number": 101, "name": "Lionel Messi", "team": "ARG", "section": "Argentina", "type": "player" },
    { "code": "ARG-3", "number": 102, "name": "Emiliano Martínez", "team": "ARG", "section": "Argentina", "type": "player" },
    { "code": "ARG-4", "number": 103, "name": "Rodrigo De Paul", "team": "ARG", "section": "Argentina", "type": "player" },
    { "code": "ARG-5", "number": 104, "name": "Julián Álvarez", "team": "ARG", "section": "Argentina", "type": "player" },
    { "code": "BRA-1", "number": 110, "name": "Brasil (Crest)", "team": "BRA", "section": "Brasil", "type": "team_badge" },
    { "code": "BRA-2", "number": 111, "name": "Vinícius Júnior", "team": "BRA", "section": "Brasil", "type": "player" },
    { "code": "BRA-3", "number": 112, "name": "Rodrygo", "team": "BRA", "section": "Brasil", "type": "player" },
    { "code": "BRA-4", "number": 113, "name": "Casemiro", "team": "BRA", "section": "Brasil", "type": "player" },
    { "code": "FRA-1", "number": 120, "name": "Francia (Crest)", "team": "FRA", "section": "Francia", "type": "team_badge" },
    { "code": "FRA-2", "number": 121, "name": "Kylian Mbappé", "team": "FRA", "section": "Francia", "type": "player" },
    { "code": "FRA-3", "number": 122, "name": "Antoine Griezmann", "team": "FRA", "section": "Francia", "type": "player" },
    { "code": "ENG-1", "number": 130, "name": "Inglaterra (Crest)", "team": "ENG", "section": "Inglaterra", "type": "team_badge" },
    { "code": "ENG-2", "number": 131, "name": "Harry Kane", "team": "ENG", "section": "Inglaterra", "type": "player" },
    { "code": "ENG-3", "number": 132, "name": "Jude Bellingham", "team": "ENG", "section": "Inglaterra", "type": "player" },
    { "code": "ESP-1", "number": 140, "name": "España (Crest)", "team": "ESP", "section": "España", "type": "team_badge" },
    { "code": "ESP-2", "number": 141, "name": "Lamine Yamal", "team": "ESP", "section": "España", "type": "player" },
    { "code": "ESP-3", "number": 142, "name": "Pedri", "team": "ESP", "section": "España", "type": "player" },
    { "code": "COL-1", "number": 150, "name": "Colombia (Crest)", "team": "COL", "section": "Colombia", "type": "team_badge" },
    { "code": "COL-2", "number": 151, "name": "James Rodríguez", "team": "COL", "section": "Colombia", "type": "player" },
    { "code": "COL-3", "number": 152, "name": "Luis Díaz", "team": "COL", "section": "Colombia", "type": "player" },
    { "code": "MEX-1", "number": 160, "name": "México (Crest)", "team": "MEX", "section": "México", "type": "team_badge" },
    { "code": "MEX-2", "number": 161, "name": "Hirving Lozano", "team": "MEX", "section": "México", "type": "player" },
    { "code": "USA-1", "number": 170, "name": "USA (Crest)", "team": "USA", "section": "USA", "type": "team_badge" },
    { "code": "USA-2", "number": 171, "name": "Christian Pulisic", "team": "USA", "section": "USA", "type": "player" }
  ]
}
```

- [ ] **Step 6.2: Commit**

```bash
git add assets/stickers.json
git commit -m "data: seed sample of 30 stickers for World Cup 2026 album"
```

---

## Task 7: Capa de datos — DB singleton + schema

**Files:**
- Create: `src/data/db.ts`, `src/data/schema.ts`

- [ ] **Step 7.1: Crear `src/data/db.ts`**

```ts
import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync("panini.db");
  }
  return _db;
}

// Solo para tests
export function _resetDb() {
  _db = null;
}
```

- [ ] **Step 7.2: Crear `src/data/schema.ts`**

```ts
import { getDb } from "./db";

const SCHEMA_VERSION = 1;

export async function initSchema(): Promise<void> {
  const db = getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stickers (
      code TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      name TEXT NOT NULL,
      team TEXT,
      section TEXT NOT NULL,
      type TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stickers_section ON stickers(section);
    CREATE INDEX IF NOT EXISTS idx_stickers_number ON stickers(number);

    CREATE TABLE IF NOT EXISTS sticker_status (
      sticker_code TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (sticker_code) REFERENCES stickers(code) ON DELETE CASCADE
    );
  `);

  // Marcar versión instalada
  await db.runAsync(
    `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`,
    [String(SCHEMA_VERSION)]
  );
}
```

- [ ] **Step 7.3: Commit**

```bash
git add src/data/db.ts src/data/schema.ts
git commit -m "feat(data): add SQLite singleton and initial schema"
```

---

## Task 8: Sembrar stickers desde JSON (con tests)

**Files:**
- Create: `src/data/seed.ts`, `tests/data/seed.test.ts`

- [ ] **Step 8.1: Escribir el test fallido para `seedStickers`**

Crear `tests/data/seed.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { seedStickers, getInstalledDatasetVersion } from "@/data/seed";
import { initSchema } from "@/data/schema";
import { getDb, _resetDb } from "@/data/db";

// Mock expo-sqlite con un mock en memoria simple basado en better-sqlite3 NO está
// disponible aquí — usamos un mock manual mínimo en jest.setup, ver step 8.4.
import "../setup-sqlite-mock";

const sample = {
  version: 2,
  album: "Test",
  stickers: [
    { code: "X1", number: 1, name: "Foo", team: null, section: "S1", type: "player" as const }
  ]
};

beforeEach(async () => {
  _resetDb();
  await initSchema();
});

describe("seedStickers", () => {
  it("inserts stickers on first run", async () => {
    await seedStickers(sample);
    const db = getDb();
    const rows = await db.getAllAsync<{ code: string }>(`SELECT code FROM stickers`);
    expect(rows.map((r) => r.code)).toEqual(["X1"]);
    expect(await getInstalledDatasetVersion()).toBe(2);
  });

  it("does nothing if installed version >= dataset version", async () => {
    await seedStickers(sample);
    // segunda corrida con misma versión
    const sample2 = { ...sample, stickers: [{ ...sample.stickers[0], code: "Y2" }] };
    await seedStickers({ ...sample2, version: 2 });
    const db = getDb();
    const rows = await db.getAllAsync<{ code: string }>(`SELECT code FROM stickers`);
    expect(rows.map((r) => r.code)).toEqual(["X1"]); // sin cambios
  });

  it("re-seeds when dataset version is higher", async () => {
    await seedStickers(sample);
    const sample2 = {
      version: 3,
      album: "Test",
      stickers: [
        { code: "X1", number: 1, name: "Foo", team: null, section: "S1", type: "player" as const },
        { code: "X2", number: 2, name: "Bar", team: null, section: "S2", type: "player" as const }
      ]
    };
    await seedStickers(sample2);
    const db = getDb();
    const rows = await db.getAllAsync<{ code: string }>(`SELECT code FROM stickers ORDER BY code`);
    expect(rows.map((r) => r.code)).toEqual(["X1", "X2"]);
    expect(await getInstalledDatasetVersion()).toBe(3);
  });
});
```

- [ ] **Step 8.2: Crear el mock de `expo-sqlite` para Jest**

Crear `tests/setup-sqlite-mock.ts`:

```ts
// Mock mínimo de expo-sqlite usando better-sqlite3 puro de node.
// Solo exponemos la superficie que usa nuestro código: openDatabaseSync,
// execAsync, runAsync, getAllAsync, getFirstAsync.
import Database from "better-sqlite3";

jest.mock("expo-sqlite", () => {
  const databases = new Map<string, Database.Database>();

  function open(name: string) {
    let db = databases.get(name);
    if (!db) {
      db = new Database(":memory:");
      databases.set(name, db);
    }

    return {
      execAsync: async (sql: string) => {
        db!.exec(sql);
      },
      runAsync: async (sql: string, params: unknown[] = []) => {
        const stmt = db!.prepare(sql);
        return stmt.run(...(params as never[]));
      },
      getAllAsync: async <T>(sql: string, params: unknown[] = []) => {
        const stmt = db!.prepare(sql);
        return stmt.all(...(params as never[])) as T[];
      },
      getFirstAsync: async <T>(sql: string, params: unknown[] = []) => {
        const stmt = db!.prepare(sql);
        return (stmt.get(...(params as never[])) ?? null) as T | null;
      }
    };
  }

  return {
    openDatabaseSync: open,
    __reset: () => {
      for (const [, db] of databases) db.close();
      databases.clear();
    }
  };
});

afterEach(() => {
  const sqlite = require("expo-sqlite") as { __reset: () => void };
  sqlite.__reset();
});
```

Y agregar `better-sqlite3` como devDependency:

```bash
npm install --save-dev better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 8.3: Ejecutar el test (debe fallar — módulo no existe)**

Run:
```bash
npm test -- seed
```
Expected: FAIL — `Cannot find module '@/data/seed'`.

- [ ] **Step 8.4: Implementar `src/data/seed.ts`**

```ts
import { getDb } from "./db";
import type { Sticker } from "@/domain/types";

export interface StickerDataset {
  version: number;
  album: string;
  stickers: Sticker[];
}

export async function getInstalledDatasetVersion(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'dataset_version'`
  );
  return row ? parseInt(row.value, 10) : 0;
}

export async function seedStickers(dataset: StickerDataset): Promise<void> {
  const db = getDb();
  const installed = await getInstalledDatasetVersion();
  if (installed >= dataset.version) return;

  await db.execAsync("BEGIN TRANSACTION");
  try {
    // Borrar y recargar SOLO la tabla stickers; sticker_status se preserva.
    await db.execAsync(`DELETE FROM stickers`);
    for (const s of dataset.stickers) {
      await db.runAsync(
        `INSERT INTO stickers (code, number, name, team, section, type) VALUES (?, ?, ?, ?, ?, ?)`,
        [s.code, s.number, s.name, s.team, s.section, s.type]
      );
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO meta (key, value) VALUES ('dataset_version', ?)`,
      [String(dataset.version)]
    );
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
}
```

- [ ] **Step 8.5: Ejecutar el test (debe pasar)**

Run:
```bash
npm test -- seed
```
Expected: PASS, 3 tests.

- [ ] **Step 8.6: Commit**

```bash
git add src/data/seed.ts tests/data/seed.test.ts tests/setup-sqlite-mock.ts package.json package-lock.json
git commit -m "feat(data): seed stickers from JSON with version-based migration"
```

---

## Task 9: Queries de stickers y status

**Files:**
- Create: `src/data/stickers.ts`, `src/data/stickerStatus.ts`, `tests/data/stickerStatus.test.ts`

- [ ] **Step 9.1: Crear `src/data/stickers.ts`**

```ts
import { getDb } from "./db";
import type { Sticker, StickerWithStatus } from "@/domain/types";

export async function getAllStickers(): Promise<Sticker[]> {
  const db = getDb();
  return db.getAllAsync<Sticker>(
    `SELECT code, number, name, team, section, type FROM stickers ORDER BY number`
  );
}

export async function getStickersWithStatus(filter: {
  q?: string;
  mode: "all" | "missing" | "duplicates";
}): Promise<StickerWithStatus[]> {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.q && filter.q.trim().length > 0) {
    where.push(`(s.name LIKE ? OR s.team LIKE ? OR CAST(s.number AS TEXT) LIKE ?)`);
    const like = `%${filter.q.trim()}%`;
    params.push(like, like, like);
  }
  if (filter.mode === "missing") {
    where.push(`COALESCE(ss.count, 0) = 0`);
  } else if (filter.mode === "duplicates") {
    where.push(`COALESCE(ss.count, 0) > 1`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  return db.getAllAsync<StickerWithStatus>(
    `SELECT s.code, s.number, s.name, s.team, s.section, s.type,
            COALESCE(ss.count, 0) AS count
     FROM stickers s
     LEFT JOIN sticker_status ss ON ss.sticker_code = s.code
     ${whereSql}
     ORDER BY s.number`,
    params
  );
}

export async function getStickerByCode(code: string): Promise<StickerWithStatus | null> {
  const db = getDb();
  return db.getFirstAsync<StickerWithStatus>(
    `SELECT s.code, s.number, s.name, s.team, s.section, s.type,
            COALESCE(ss.count, 0) AS count
     FROM stickers s
     LEFT JOIN sticker_status ss ON ss.sticker_code = s.code
     WHERE s.code = ?`,
    [code]
  );
}
```

- [ ] **Step 9.2: Escribir tests fallidos para `stickerStatus`**

Crear `tests/data/stickerStatus.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { incrementStatus, decrementStatus, getStatus, listStatuses } from "@/data/stickerStatus";
import { initSchema } from "@/data/schema";
import { getDb, _resetDb } from "@/data/db";
import "../setup-sqlite-mock";

beforeEach(async () => {
  _resetDb();
  await initSchema();
  // sembrar 1 sticker para satisfacer FK
  const db = getDb();
  await db.runAsync(
    `INSERT INTO stickers (code, number, name, team, section, type) VALUES (?, ?, ?, ?, ?, ?)`,
    ["X1", 1, "Foo", null, "S", "player"]
  );
});

describe("stickerStatus", () => {
  it("getStatus returns 0 when no row exists", async () => {
    expect((await getStatus("X1"))?.count ?? 0).toBe(0);
  });

  it("incrementStatus creates row with count=1, then increments", async () => {
    await incrementStatus("X1");
    expect((await getStatus("X1"))?.count).toBe(1);
    await incrementStatus("X1");
    await incrementStatus("X1");
    expect((await getStatus("X1"))?.count).toBe(3);
  });

  it("decrementStatus respects min 0", async () => {
    await decrementStatus("X1");
    expect((await getStatus("X1"))?.count).toBe(0);
    await incrementStatus("X1");
    await incrementStatus("X1");
    await decrementStatus("X1");
    expect((await getStatus("X1"))?.count).toBe(1);
  });

  it("listStatuses returns all rows", async () => {
    await incrementStatus("X1");
    const all = await listStatuses();
    expect(all).toHaveLength(1);
    expect(all[0].stickerCode).toBe("X1");
  });
});
```

- [ ] **Step 9.3: Ejecutar el test (debe fallar)**

Run:
```bash
npm test -- stickerStatus
```
Expected: FAIL — módulo no existe.

- [ ] **Step 9.4: Implementar `src/data/stickerStatus.ts`**

```ts
import { getDb } from "./db";
import type { StickerStatus } from "@/domain/types";

interface Row {
  sticker_code: string;
  count: number;
  updated_at: number;
}

function rowToStatus(r: Row): StickerStatus {
  return { stickerCode: r.sticker_code, count: r.count, updatedAt: r.updated_at };
}

export async function getStatus(code: string): Promise<StickerStatus | null> {
  const db = getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT sticker_code, count, updated_at FROM sticker_status WHERE sticker_code = ?`,
    [code]
  );
  return row ? rowToStatus(row) : null;
}

export async function listStatuses(): Promise<StickerStatus[]> {
  const db = getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT sticker_code, count, updated_at FROM sticker_status`
  );
  return rows.map(rowToStatus);
}

export async function incrementStatus(code: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sticker_status (sticker_code, count, updated_at) VALUES (?, 1, ?)
     ON CONFLICT(sticker_code) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`,
    [code, now]
  );
}

export async function decrementStatus(code: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sticker_status (sticker_code, count, updated_at) VALUES (?, 0, ?)
     ON CONFLICT(sticker_code) DO UPDATE
       SET count = MAX(count - 1, 0), updated_at = excluded.updated_at`,
    [code, now]
  );
}
```

- [ ] **Step 9.5: Ejecutar el test (debe pasar)**

Run:
```bash
npm test -- stickerStatus
```
Expected: PASS, 4 tests.

- [ ] **Step 9.6: Commit**

```bash
git add src/data/stickers.ts src/data/stickerStatus.ts tests/data/stickerStatus.test.ts
git commit -m "feat(data): sticker queries and increment/decrement status"
```

---

## Task 10: Store de filtros (Zustand)

**Files:**
- Create: `src/store/filters.ts`

- [ ] **Step 10.1: Crear `src/store/filters.ts`**

```ts
import { create } from "zustand";

export type FilterMode = "all" | "missing" | "duplicates";

interface FiltersState {
  query: string;
  mode: FilterMode;
  setQuery: (q: string) => void;
  setMode: (m: FilterMode) => void;
}

export const useFilters = create<FiltersState>((set) => ({
  query: "",
  mode: "all",
  setQuery: (query) => set({ query }),
  setMode: (mode) => set({ mode })
}));
```

- [ ] **Step 10.2: Commit**

```bash
git add src/store/filters.ts
git commit -m "feat(store): add filters state with Zustand"
```

---

## Task 11: Hooks de datos (TanStack Query)

**Files:**
- Create: `src/hooks/useStickers.ts`, `src/hooks/useProgress.ts`

- [ ] **Step 11.1: Crear `src/hooks/useStickers.ts`**

```ts
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getStickersWithStatus, getStickerByCode } from "@/data/stickers";
import { incrementStatus, decrementStatus } from "@/data/stickerStatus";
import type { FilterMode } from "@/store/filters";

const KEY = {
  list: (q: string, m: FilterMode) => ["stickers", "list", q, m] as const,
  detail: (code: string) => ["stickers", "detail", code] as const,
  progress: () => ["stickers", "progress"] as const
};

export function useStickerList(query: string, mode: FilterMode) {
  return useQuery({
    queryKey: KEY.list(query, mode),
    queryFn: () => getStickersWithStatus({ q: query, mode })
  });
}

export function useStickerDetail(code: string) {
  return useQuery({
    queryKey: KEY.detail(code),
    queryFn: () => getStickerByCode(code),
    enabled: !!code
  });
}

export function useIncrement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => incrementStatus(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickers"] });
    }
  });
}

export function useDecrement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => decrementStatus(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stickers"] });
    }
  });
}
```

- [ ] **Step 11.2: Crear `src/hooks/useProgress.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { getAllStickers } from "@/data/stickers";
import { listStatuses } from "@/data/stickerStatus";
import { computeProgress } from "@/domain/progress";

export function useProgress() {
  return useQuery({
    queryKey: ["stickers", "progress"],
    queryFn: async () => {
      const [stickers, statuses] = await Promise.all([getAllStickers(), listStatuses()]);
      return computeProgress(stickers, statuses);
    }
  });
}
```

- [ ] **Step 11.3: Commit**

```bash
git add src/hooks/
git commit -m "feat(hooks): add TanStack Query wrappers for stickers and progress"
```

---

## Task 12: Layout root + bootstrap de la app

**Files:**
- Create: `app/_layout.tsx`

- [ ] **Step 12.1: Crear `app/_layout.tsx`**

```tsx
import "../global.css";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { initSchema } from "@/data/schema";
import { seedStickers, type StickerDataset } from "@/data/seed";
import datasetJson from "../assets/stickers.json";

const dataset = datasetJson as StickerDataset;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, retry: false, refetchOnWindowFocus: false }
  }
});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initSchema();
        await seedStickers(dataset);
        setReady(true);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-space-deep p-6">
        <Text className="text-red-300 text-center">Error inicializando: {error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-space-deep">
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#000" } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="sticker/[code]" options={{ presentation: "modal" }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 12.2: Verificar que tipea**

Run:
```bash
npm run typecheck
```
Expected: 0 errores.

- [ ] **Step 12.3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(app): root layout with QueryClient and DB init"
```

---

## Task 13: Tab bar (4 tabs, 2 funcionales en P1)

**Files:**
- Create: `app/(tabs)/_layout.tsx`, `app/(tabs)/trades.tsx`, `app/(tabs)/profile.tsx`

- [ ] **Step 13.1: Crear `app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/theme/colors";

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, color: focused ? colors.violet : colors.dim }}>{icon}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.dark,
          borderTopColor: "rgba(124,92,255,0.2)",
          borderTopWidth: 1
        },
        tabBarActiveTintColor: colors.violet,
        tabBarInactiveTintColor: colors.dim
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon icon="⌂" focused={focused} /> }}
      />
      <Tabs.Screen
        name="album"
        options={{ title: "Álbum", tabBarIcon: ({ focused }) => <TabIcon icon="▦" focused={focused} /> }}
      />
      <Tabs.Screen
        name="trades"
        options={{ title: "Cambios", tabBarIcon: ({ focused }) => <TabIcon icon="↔" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Perfil", tabBarIcon: ({ focused }) => <TabIcon icon="◔" focused={focused} /> }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 13.2: Crear `app/(tabs)/trades.tsx`** (placeholder)

```tsx
import { View, Text } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";

export default function TradesPlaceholder() {
  return (
    <StarryBackground>
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-space-mute text-center text-base">
          Cambios — disponible en la próxima versión.
        </Text>
      </View>
    </StarryBackground>
  );
}
```

- [ ] **Step 13.3: Crear `app/(tabs)/profile.tsx`** (placeholder)

```tsx
import { View, Text } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";

export default function ProfilePlaceholder() {
  return (
    <StarryBackground>
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-space-mute text-center text-base">
          Perfil — login y sync llegan en la próxima versión.
        </Text>
      </View>
    </StarryBackground>
  );
}
```

- [ ] **Step 13.4: Commit**

```bash
git add app/\(tabs\)/
git commit -m "feat(app): tab bar layout with 4 tabs (2 placeholders)"
```

---

## Task 14: Pantalla Álbum (grid + buscador + filtros)

**Files:**
- Create: `app/(tabs)/album.tsx`

- [ ] **Step 14.1: Crear `app/(tabs)/album.tsx`**

```tsx
import { useState } from "react";
import { View, Text, FlatList, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { StarryBackground } from "@/ui/StarryBackground";
import { FilterChip } from "@/ui/FilterChip";
import { useStickerList, useIncrement, useDecrement } from "@/hooks/useStickers";
import { useFilters } from "@/store/filters";
import type { StickerWithStatus } from "@/domain/types";
import { colors } from "@/theme/colors";

const COLUMNS = 4;

function StickerCell({ s, onTap, onLong }: {
  s: StickerWithStatus;
  onTap: () => void;
  onLong: () => void;
}) {
  const collected = s.count >= 1;
  return (
    <Pressable
      onPress={onTap}
      onLongPress={onLong}
      delayLongPress={350}
      className="flex-1 m-1"
    >
      <View
        className="aspect-square rounded-md items-center justify-center"
        style={{
          backgroundColor: collected ? colors.purple : colors.dark,
          borderWidth: collected ? 0 : 1,
          borderColor: "rgba(124,92,255,0.25)",
          borderStyle: collected ? "solid" : "dashed"
        }}
      >
        <Text
          className="font-bold"
          style={{
            color: collected ? "#fff" : colors.dim,
            fontSize: 12
          }}
        >
          {s.number}
        </Text>
        {s.count > 1 && (
          <View
            className="absolute -bottom-1 -right-1 rounded-full items-center justify-center"
            style={{ width: 18, height: 18, backgroundColor: colors.blue }}
          >
            <Text className="text-white font-bold" style={{ fontSize: 10 }}>
              {s.count}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function AlbumScreen() {
  const router = useRouter();
  const { query, mode, setQuery, setMode } = useFilters();
  const { data, isLoading } = useStickerList(query, mode);
  const inc = useIncrement();
  const dec = useDecrement();
  const [showSearch, setShowSearch] = useState(false);

  return (
    <StarryBackground>
      <View className="flex-1 px-3 pt-14">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-space-violet font-bold tracking-widest text-sm">
            ÁLBUM · MUNDIAL 2026
          </Text>
          <Pressable onPress={() => setShowSearch((v) => !v)} className="p-2">
            <Text className="text-space-violet text-lg">⌕</Text>
          </Pressable>
        </View>

        {showSearch && (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por número, jugador o equipo"
            placeholderTextColor={colors.dim}
            className="bg-space-dark text-space-ink rounded-lg px-3 py-2 mb-3"
            autoCorrect={false}
          />
        )}

        <View className="flex-row gap-2 mb-3">
          <FilterChip label="Todos" active={mode === "all"} onPress={() => setMode("all")} />
          <FilterChip label="Faltan" active={mode === "missing"} onPress={() => setMode("missing")} />
          <FilterChip label="Repetidas" active={mode === "duplicates"} onPress={() => setMode("duplicates")} />
        </View>

        {isLoading ? (
          <Text className="text-space-mute text-center mt-8">Cargando…</Text>
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(item) => item.code}
            numColumns={COLUMNS}
            renderItem={({ item }) => (
              <StickerCell
                s={item}
                onTap={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  inc.mutate(item.code);
                }}
                onLong={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  dec.mutate(item.code);
                }}
              />
            )}
            ListEmptyComponent={
              <Text className="text-space-mute text-center mt-8">Sin resultados.</Text>
            }
          />
        )}

        <Pressable
          onPress={() => router.push("/sticker/INTRO-1")}
          className="absolute bottom-6 right-6 bg-space-purple rounded-full px-4 py-2"
        >
          <Text className="text-white text-xs">Demo detalle</Text>
        </Pressable>
      </View>
    </StarryBackground>
  );
}
```

> El botón "Demo detalle" se borra en Task 15 cuando esté el tap en celda → modal. Lo dejamos por ahora para verificar que el modal carga.

- [ ] **Step 14.2: Verificar typecheck**

Run:
```bash
npm run typecheck
```
Expected: 0 errores.

- [ ] **Step 14.3: Commit**

```bash
git add app/\(tabs\)/album.tsx
git commit -m "feat(album): grid screen with search, filters and tap/long-press marking"
```

---

## Task 15: Modal de detalle de sticker

**Files:**
- Create: `app/sticker/[code].tsx`
- Modify: `app/(tabs)/album.tsx` (eliminar botón demo + agregar nav al cell)

- [ ] **Step 15.1: Crear `app/sticker/[code].tsx`**

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useStickerDetail, useIncrement, useDecrement } from "@/hooks/useStickers";

export default function StickerDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { data, isLoading } = useStickerDetail(code);
  const inc = useIncrement();
  const dec = useDecrement();

  if (isLoading || !data) {
    return (
      <StarryBackground>
        <View className="flex-1 items-center justify-center">
          <Text className="text-space-mute">Cargando…</Text>
        </View>
      </StarryBackground>
    );
  }

  return (
    <StarryBackground>
      <View className="flex-1 p-6 justify-center">
        <GlowCard>
          <Text className="text-space-mute text-xs tracking-wider mb-1">#{data.number}</Text>
          <Text className="text-space-ink text-2xl font-bold mb-1">{data.name}</Text>
          {data.team && <Text className="text-space-mute mb-3">{data.team}</Text>}
          <Text className="text-space-violet text-xs uppercase tracking-widest mb-4">
            {data.section}
          </Text>

          <View className="flex-row items-center justify-between mt-4">
            <Pressable
              onPress={() => dec.mutate(data.code)}
              className="bg-space-mid rounded-lg px-4 py-2"
            >
              <Text className="text-space-ink text-lg">−</Text>
            </Pressable>
            <Text className="text-space-ink text-3xl font-bold">{data.count}</Text>
            <Pressable
              onPress={() => inc.mutate(data.code)}
              className="bg-space-purple rounded-lg px-4 py-2"
            >
              <Text className="text-white text-lg">+</Text>
            </Pressable>
          </View>
        </GlowCard>

        <Pressable onPress={() => router.back()} className="mt-6 self-center">
          <Text className="text-space-mute">Cerrar</Text>
        </Pressable>
      </View>
    </StarryBackground>
  );
}
```

- [ ] **Step 15.2: Modificar `app/(tabs)/album.tsx`** — borrar botón demo, agregar tap-to-detail

Reemplazar el `<StickerCell>` callback por:
```tsx
renderItem={({ item }) => (
  <StickerCell
    s={item}
    onTap={async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      inc.mutate(item.code);
    }}
    onLong={async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      dec.mutate(item.code);
    }}
  />
)}
```
y agregar un segundo gesto: presionar el número grande / doble-tap abre detalle. Para mantener simple, agregamos un botón "info" pequeño en cada celda.

Cambiar `StickerCell` para que reciba `onInfo`:

```tsx
function StickerCell({ s, onTap, onLong, onInfo }: {
  s: StickerWithStatus;
  onTap: () => void;
  onLong: () => void;
  onInfo: () => void;
}) {
  const collected = s.count >= 1;
  return (
    <Pressable onPress={onTap} onLongPress={onLong} delayLongPress={350} className="flex-1 m-1">
      <View
        className="aspect-square rounded-md items-center justify-center"
        style={{
          backgroundColor: collected ? colors.purple : colors.dark,
          borderWidth: collected ? 0 : 1,
          borderColor: "rgba(124,92,255,0.25)",
          borderStyle: collected ? "solid" : "dashed"
        }}
      >
        <Text
          className="font-bold"
          style={{ color: collected ? "#fff" : colors.dim, fontSize: 12 }}
        >
          {s.number}
        </Text>
        {s.count > 1 && (
          <View
            className="absolute -bottom-1 -right-1 rounded-full items-center justify-center"
            style={{ width: 18, height: 18, backgroundColor: colors.blue }}
          >
            <Text className="text-white font-bold" style={{ fontSize: 10 }}>
              {s.count}
            </Text>
          </View>
        )}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onInfo();
          }}
          hitSlop={8}
          className="absolute top-0.5 right-0.5"
        >
          <Text style={{ color: collected ? "#fff" : colors.dim, fontSize: 10 }}>ⓘ</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
```

Y el `renderItem` ahora pasa `onInfo`:

```tsx
renderItem={({ item }) => (
  <StickerCell
    s={item}
    onTap={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      inc.mutate(item.code);
    }}
    onLong={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      dec.mutate(item.code);
    }}
    onInfo={() => router.push(`/sticker/${item.code}`)}
  />
)}
```

Y borrar el botón "Demo detalle" del final del componente.

- [ ] **Step 15.3: Verificar typecheck**

Run:
```bash
npm run typecheck
```
Expected: 0 errores.

- [ ] **Step 15.4: Commit**

```bash
git add app/sticker/ app/\(tabs\)/album.tsx
git commit -m "feat(album): sticker detail modal accessible from grid info icon"
```

---

## Task 16: Pantalla Home con progreso

**Files:**
- Create: `app/(tabs)/index.tsx`

- [ ] **Step 16.1: Crear `app/(tabs)/index.tsx`**

```tsx
import { ScrollView, View, Text } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { ProgressBar } from "@/ui/ProgressBar";
import { useProgress } from "@/hooks/useProgress";

export default function Home() {
  const { data, isLoading } = useProgress();

  return (
    <StarryBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">
          MUNDIAL 2026
        </Text>

        {isLoading || !data ? (
          <Text className="text-space-mute">Cargando…</Text>
        ) : (
          <>
            <GlowCard className="mb-4">
              <Text className="text-space-mute text-xs tracking-widest mb-1">PROGRESO</Text>
              <Text className="text-space-ink text-3xl font-extrabold mb-2">
                {data.collected} / {data.total}
              </Text>
              <ProgressBar pct={data.pct} />
              <Text className="text-space-mute text-xs mt-2">
                {data.duplicates > 0 ? `${data.duplicates} repetidas` : "Sin repetidas"}
              </Text>
            </GlowCard>

            <Text className="text-space-mute text-xs tracking-widest mb-2">POR SECCIÓN</Text>
            {data.bySection.map((s) => (
              <GlowCard key={s.section} className="mb-2">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-space-ink font-semibold">{s.section}</Text>
                  <Text className="text-space-mute text-xs">
                    {s.collected}/{s.total}
                  </Text>
                </View>
                <ProgressBar pct={s.pct} height={4} />
              </GlowCard>
            ))}
          </>
        )}
      </ScrollView>
    </StarryBackground>
  );
}
```

- [ ] **Step 16.2: Verificar typecheck**

Run:
```bash
npm run typecheck
```
Expected: 0 errores.

- [ ] **Step 16.3: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "feat(home): progress overview with section breakdown"
```

---

## Task 17: Smoke test manual en simulador

> Esta tarea es **manual** y no genera código nuevo. Verifica que todo el P1 corre.

- [ ] **Step 17.1: Levantar el dev server**

Run:
```bash
npm start
```
Expected: ves el QR + opciones (i) iOS, (a) Android.

- [ ] **Step 17.2: Probar en iOS Simulator**

Presionar `i` en la terminal donde corre `expo start`. Verificar:

1. La app abre con un splash y luego el tab bar abajo (Home / Álbum / Cambios / Perfil).
2. **Home** muestra "0 / 30" inicialmente con barra de progreso vacía.
3. **Álbum**: ves la grilla con 30 celdas con números, todas vacías (borde dasheado).
4. Tap en una celda: pasa a estado "pegada" (color púrpura, número blanco). Tap de nuevo: aparece badge azul "2".
5. Long-press en una celda con count ≥ 1: decrementa.
6. Tocar el icono ⓘ en una celda: abre modal con detalle (nombre, equipo, sección, +/−).
7. Volver a Home: el progreso refleja los cambios.
8. Filtros "Faltan" / "Repetidas" filtran correctamente.
9. Buscador filtra por número y por nombre (probar "Messi", "121", "ARG").
10. Tabs Cambios y Perfil muestran placeholders sin crashear.
11. Cerrar la app y reabrir: el progreso persiste.

- [ ] **Step 17.3: Probar en Android Emulator**

Presionar `a` en la terminal donde corre `expo start`. Repetir los 11 puntos del Step 17.2.

- [ ] **Step 17.4: Si algo falla, abrir issue/TODO**

Documentar fallas en `docs/superpowers/notes/p1-smoke-issues.md` y resolver antes de cerrar P1. Las regresiones de UI/data se reproducen con un test escrito antes de fixear.

- [ ] **Step 17.5: Commit (notas de smoke test si hubo)**

Si hubo fixes:
```bash
git add .
git commit -m "fix(p1): address smoke test findings"
```

Si no hubo cambios, no commitear vacío. Marcar el step como hecho y avanzar.

---

## Task 18: README mínimo

**Files:**
- Create: `README.md`

- [ ] **Step 18.1: Crear `README.md`**

```markdown
# Panini Album — Mundial 2026

App móvil offline-first para gestionar el álbum Panini del Mundial 2026.
Construida con Expo (iOS + Android).

## Setup

```bash
npm install
npm start
```

Luego presionar `i` para iOS o `a` para Android.

## Scripts

- `npm test` — corre la suite Jest
- `npm run typecheck` — TypeScript en strict mode
- `npm run lint` — Expo lint

## Estructura

- `app/` — rutas de Expo Router
- `src/` — lógica de dominio, datos, UI primitives, hooks
- `assets/stickers.json` — dataset embebido del álbum
- `docs/superpowers/` — specs y plans del proyecto

## Estado actual: P1

- ✅ Browse del álbum, marcar pegadas/repetidas
- ✅ Progreso por sección
- ✅ Buscador y filtros
- ⏳ Auth + sync remota — P2
- ⏳ Compartir lista de cambios — P3
- ⏳ Amigos + matches — P4
- ⏳ Pulido visual + release — P5
```

- [ ] **Step 18.2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and roadmap"
```

---

## Cierre del P1

Al terminar, el repo tiene:
- Una app Expo que corre en iOS y Android.
- Browse del álbum, marcado de pegadas/repetidas, progreso por sección.
- Tests unitarios para progreso y status.
- Tests de integración para seed.
- Smoke test verificado en ambos OS.

**Próximo plan:** P2 — Auth (Apple + Google) + Sync con Supabase.

Antes de empezar P2, conviene haber cargado el dataset completo de 670 stickers (manual) para detectar problemas de performance del FlatList con la grilla real (probablemente haya que migrar a `FlashList`).
