# P5 — Pulido + Release · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar la app a calidad de release: animaciones, parallax, glow, skeletons, empty states, ícono y splash, accesibilidad, performance del Álbum, builds a TestFlight + Play internal track.

**Architecture:** Sin cambios estructurales — solo capas de pulido sobre lo existente. Reanimated para animaciones, FlashList para performance, EAS Build para distribución.

**Tech Stack:** `@shopify/flash-list`, `expo-linear-gradient`, EAS CLI, App Store Connect / Play Console.

**Spec referenciada:** `docs/superpowers/specs/2026-04-28-panini-album-design.md` — secciones 9 (visual) y 12 (hitos 14-16).

**Precondiciones (estado del repo al empezar P5):**
- P1 + P2 + P3 + P4 mergeados y funcionales.
- App tiene auth, sync, compartir lista, amigos, matches, Realtime.
- Estéticamente "decente" pero sin animaciones avanzadas, parallax, ni glow gradient.
- Ícono y splash genéricos.

**Lo que NO se construye en P5:**
- Promo a usuarios reales.
- Internacionalización.
- Push notifications.
- Light mode.

---

## Estructura de archivos a crear/modificar

```
panini-album/
├── package.json                          # MODIFY: 1.0.0-beta.1, FlashList, linear-gradient
├── app.json                              # MODIFY: buildNumber, versionCode, ITSAppUsesNonExemptEncryption
├── eas.json                              # CREATE
├── scripts/
│   └── gen-icon.js                       # CREATE: genera icon/adaptive-icon/splash
├── assets/
│   ├── icon.png                          # OVERWRITE
│   ├── adaptive-icon.png                 # OVERWRITE
│   └── splash.png                        # OVERWRITE
├── src/
│   ├── lib/
│   │   ├── haptics.ts                    # CREATE
│   │   ├── onboarding.ts                 # CREATE: flag SecureStore
│   │   └── version.ts                    # CREATE
│   └── ui/
│       ├── AnimatedStickerCell.tsx       # CREATE
│       ├── ProgressBar.tsx               # MODIFY: animar width con Reanimated
│       ├── StarryBackground.tsx          # MODIFY: prop parallax
│       ├── GlowGradientCard.tsx          # CREATE
│       ├── Skeleton.tsx                  # CREATE
│       ├── SkeletonAlbumGrid.tsx         # CREATE
│       └── EmptyState.tsx                # CREATE: 3 SVG ilustraciones
├── app/
│   ├── _layout.tsx                       # MODIFY: onboarding gate, transitions
│   ├── (tabs)/
│   │   ├── _layout.tsx                   # MODIFY: animation
│   │   ├── album.tsx                     # MODIFY: FlashList + AnimatedStickerCell
│   │   ├── index.tsx                     # MODIFY: skeleton, parallax
│   │   └── profile.tsx                   # MODIFY: borrar cuenta, link about
│   ├── about.tsx                         # CREATE
│   └── onboarding/
│       ├── _layout.tsx                   # CREATE
│       └── [step].tsx                    # CREATE: 3 pantallas
├── supabase/migrations/
│   └── 20260428000010_delete_account.sql # CREATE
└── docs/
    ├── legal/
    │   ├── privacy-policy.md             # CREATE
    │   └── terms.md                      # CREATE
    └── release/
        ├── store-assets-checklist.md     # CREATE
        └── smoke-test-checklist.md       # CREATE
```

---

## Task 1: Bump de versión + dependencias de pulido

**Files:**
- Modify: `package.json`, `app.json`

- [ ] **Step 1.1: Actualizar `package.json`**

```bash
npm pkg set version=1.0.0-beta.1
npx expo install @shopify/flash-list expo-linear-gradient
```

- [ ] **Step 1.2: Actualizar `app.json`**

Modificar:
```json
{
  "expo": {
    "version": "1.0.0",
    "ios": {
      "buildNumber": "1",
      "config": {
        "usesNonExemptEncryption": false
      }
    },
    "android": {
      "versionCode": 1
    }
  }
}
```

> `version` es la marketing version; `buildNumber`/`versionCode` se incrementan con cada subida a stores (lo hace EAS automáticamente con `appVersionSource: "remote"`).

- [ ] **Step 1.3: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore: bump to 1.0.0-beta.1, add FlashList + linear-gradient"
```

---

## Task 2: Wrappers de haptics

**Files:**
- Create: `src/lib/haptics.ts`

- [ ] **Step 2.1: Crear**

```ts
import * as H from "expo-haptics";

export const haptics = {
  light: () => H.impactAsync(H.ImpactFeedbackStyle.Light),
  medium: () => H.impactAsync(H.ImpactFeedbackStyle.Medium),
  heavy: () => H.impactAsync(H.ImpactFeedbackStyle.Heavy),
  success: () => H.notificationAsync(H.NotificationFeedbackType.Success),
  warning: () => H.notificationAsync(H.NotificationFeedbackType.Warning),
  error: () => H.notificationAsync(H.NotificationFeedbackType.Error)
};
```

- [ ] **Step 2.2: Auditar usos** y reemplazar llamadas dispersas

Reemplazar en todos los archivos que importen `expo-haptics` directamente:
- `Haptics.impactAsync(...Light)` → `haptics.light()`
- `Haptics.impactAsync(...Medium)` → `haptics.medium()`
- `Haptics.notificationAsync(...Success)` → `haptics.success()`

Archivos a tocar (encontrados en P1-P4): `app/(tabs)/album.tsx`, `app/(tabs)/trades.tsx`, `app/add-friend/scan.tsx`, `app/(tabs)/profile.tsx`. Importar `import { haptics } from "@/lib/haptics"`.

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/haptics.ts app/
git commit -m "refactor(haptics): centralize through @/lib/haptics wrapper"
```

---

## Task 3: AnimatedStickerCell con scale-bounce

**Files:**
- Create: `src/ui/AnimatedStickerCell.tsx`
- Modify: `app/(tabs)/album.tsx`

- [ ] **Step 3.1: Crear `src/ui/AnimatedStickerCell.tsx`**

```tsx
import React, { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring
} from "react-native-reanimated";
import type { StickerWithStatus } from "@/domain/types";
import { colors } from "@/theme/colors";

const APress = Animated.createAnimatedComponent(Pressable);

export function AnimatedStickerCell({
  s,
  onTap,
  onLong,
  onInfo
}: {
  s: StickerWithStatus;
  onTap: () => void;
  onLong: () => void;
  onInfo: () => void;
}) {
  const scale = useSharedValue(1);
  const collected = s.count >= 1;

  useEffect(() => {
    if (s.count > 0) {
      scale.value = withSequence(
        withTiming(1.15, { duration: 100 }),
        withSpring(1.0, { damping: 8, stiffness: 200 })
      );
    }
  }, [s.count, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <APress
      onPress={onTap}
      onLongPress={onLong}
      delayLongPress={350}
      className="flex-1 m-1"
      accessibilityLabel={`Figurita número ${s.number}, ${s.name}`}
      accessibilityRole="button"
      style={animStyle}
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
          accessibilityLabel={`Detalle de ${s.name}`}
          className="absolute top-0.5 right-0.5"
        >
          <Text style={{ color: collected ? "#fff" : colors.dim, fontSize: 10 }}>ⓘ</Text>
        </Pressable>
      </View>
    </APress>
  );
}
```

- [ ] **Step 3.2: Modificar `app/(tabs)/album.tsx`** — usar `AnimatedStickerCell`

Reemplazar la importación e inline del `StickerCell` con:
```tsx
import { AnimatedStickerCell } from "@/ui/AnimatedStickerCell";
```
y en el `renderItem`, sustituir `<StickerCell ...>` por `<AnimatedStickerCell ...>` (mismas props).

Borrar la implementación inline de `StickerCell` (queda muerta).

- [ ] **Step 3.3: Commit**

```bash
git add src/ui/AnimatedStickerCell.tsx app/\(tabs\)/album.tsx
git commit -m "feat(album): scale-bounce animation on increment"
```

---

## Task 4: ProgressBar animada

**Files:**
- Modify: `src/ui/ProgressBar.tsx`

- [ ] **Step 4.1: Reemplazar**

```tsx
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";

const ARect = Animated.createAnimatedComponent(Rect);

export function ProgressBar({ pct, height = 8 }: { pct: number; height?: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  const w = useSharedValue(clamped);

  useEffect(() => {
    w.value = withTiming(clamped, { duration: 600 });
  }, [clamped, w]);

  const props = useAnimatedProps(() => ({
    width: `${w.value * 100}%`
  }));

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

- [ ] **Step 4.2: Commit**

```bash
git add src/ui/ProgressBar.tsx
git commit -m "feat(ui): animated ProgressBar with Reanimated"
```

---

## Task 5: Transiciones de pantallas

**Files:**
- Modify: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`

- [ ] **Step 5.1: En `app/_layout.tsx`** — actualizar `screenOptions` del Stack

```tsx
<Stack
  screenOptions={{
    headerShown: false,
    contentStyle: { backgroundColor: "#000" },
    animation: "slide_from_right"
  }}
>
  <Stack.Screen name="(auth)" />
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="sticker/[code]" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
  <Stack.Screen name="profile/edit" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
  <Stack.Screen name="add-friend/scan" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
  <Stack.Screen name="add-friend/search" options={{ animation: "slide_from_right" }} />
</Stack>
```

- [ ] **Step 5.2: En `app/(tabs)/_layout.tsx`** — agregar `animation: "shift"`

```tsx
<Tabs
  screenOptions={{
    headerShown: false,
    animation: "shift",
    tabBarStyle: { backgroundColor: colors.dark, borderTopColor: "rgba(124,92,255,0.2)", borderTopWidth: 1 },
    tabBarActiveTintColor: colors.violet,
    tabBarInactiveTintColor: colors.dim
  }}
>
```

- [ ] **Step 5.3: Commit**

```bash
git add app/_layout.tsx app/\(tabs\)/_layout.tsx
git commit -m "feat(nav): add stack and tab transition animations"
```

---

## Task 6: GlowGradientCard

**Files:**
- Create: `src/ui/GlowGradientCard.tsx`

- [ ] **Step 6.1: Crear**

```tsx
import React from "react";
import { View, ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export function GlowGradientCard({
  children,
  className,
  style,
  ...rest
}: ViewProps & { className?: string }) {
  return (
    <View
      style={[
        {
          shadowColor: "#7c5cff",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
          elevation: 10,
          borderRadius: 16
        },
        style
      ]}
    >
      <LinearGradient
        colors={["#7c5cff", "#3b82f6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 16, padding: 1 }}
      >
        <View
          {...rest}
          className={`bg-space-dark rounded-[15px] p-4 ${className ?? ""}`}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}
```

- [ ] **Step 6.2: Aplicar** en CTAs principales (botón Compartir en `trades.tsx` y botón Escanear en `profile.tsx`)

En cada caso: envolver el `<Pressable>` del CTA con `<GlowGradientCard>`. Ejemplo en trades.tsx, donde está el botón "Compartir mi lista", reemplazar por:

```tsx
<GlowGradientCard>
  <Pressable
    onPress={...}
    disabled={!text}
    className={`rounded-xl py-4 items-center ${text ? "" : "opacity-50"}`}
  >
    <Text className="text-white font-semibold">Compartir mi lista</Text>
  </Pressable>
</GlowGradientCard>
```

- [ ] **Step 6.3: Commit**

```bash
git add src/ui/GlowGradientCard.tsx app/
git commit -m "feat(ui): GlowGradientCard for primary CTAs"
```

---

## Task 7: StarryBackground con parallax

**Files:**
- Modify: `src/ui/StarryBackground.tsx`

- [ ] **Step 7.1: Reemplazar**

```tsx
import React from "react";
import { View, Dimensions } from "react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop, Rect } from "react-native-svg";

const { width, height } = Dimensions.get("window");

const STARS = Array.from({ length: 60 }, (_, i) => {
  const x = (i * 1373 + 7) % width;
  const y = (i * 919 + 31) % height;
  const r = ((i * 17) % 3) * 0.4 + 0.5;
  const opacity = 0.3 + ((i * 13) % 70) / 100;
  return { x, y, r, opacity };
});

export function StarryBackground({
  children,
  parallaxScrollY
}: {
  children?: React.ReactNode;
  parallaxScrollY?: SharedValue<number>;
}) {
  const animStyle = useAnimatedStyle(() => {
    if (!parallaxScrollY) return {};
    return {
      transform: [{ translateY: -(parallaxScrollY.value * 0.08) }]
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Animated.View
        style={[{ position: "absolute", top: 0, left: 0 }, animStyle]}
        pointerEvents="none"
      >
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="nebula" cx="30%" cy="20%" r="80%">
              <Stop offset="0%" stopColor="#5b1ea3" stopOpacity="0.6" />
              <Stop offset="40%" stopColor="#1a0d4d" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#nebula)" />
          {STARS.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity={s.opacity} />
          ))}
        </Svg>
      </Animated.View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
```

- [ ] **Step 7.2: Aplicar parallax en Home y Álbum**

En `app/(tabs)/index.tsx` y `app/(tabs)/album.tsx`, agregar:

```tsx
import { useSharedValue, useAnimatedScrollHandler } from "react-native-reanimated";
import Animated from "react-native-reanimated";
// ...
const scrollY = useSharedValue(0);
const onScroll = useAnimatedScrollHandler({
  onScroll: (e) => { scrollY.value = e.contentOffset.y; }
});
// ...
<StarryBackground parallaxScrollY={scrollY}>
  <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} ...>
```

(En el Álbum, reemplazar `FlatList` por `Animated.FlatList` o el `<Animated.ScrollView>` que envuelva la `FlashList`.)

- [ ] **Step 7.3: Commit**

```bash
git add src/ui/StarryBackground.tsx app/\(tabs\)/index.tsx app/\(tabs\)/album.tsx
git commit -m "feat(ui): parallax stars on Home and Album"
```

---

## Task 8: Skeleton + SkeletonAlbumGrid

**Files:**
- Create: `src/ui/Skeleton.tsx`, `src/ui/SkeletonAlbumGrid.tsx`

- [ ] **Step 8.1: Crear `src/ui/Skeleton.tsx`**

```tsx
import React, { useEffect } from "react";
import { View, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming
} from "react-native-reanimated";

export function Skeleton({ style }: { style?: ViewStyle }) {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.8, { duration: 800 }), -1, true);
  }, [opacity]);

  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { backgroundColor: "#1c1648", borderRadius: 8 },
        anim,
        style
      ]}
    />
  );
}
```

- [ ] **Step 8.2: Crear `src/ui/SkeletonAlbumGrid.tsx`**

```tsx
import React from "react";
import { View } from "react-native";
import { Skeleton } from "./Skeleton";

export function SkeletonAlbumGrid({ rows = 6 }: { rows?: number }) {
  const total = rows * 4;
  return (
    <View className="flex-row flex-wrap">
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{ flexBasis: "25%", padding: 4 }}>
          <Skeleton style={{ aspectRatio: 1 }} />
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 8.3: Aplicar en Home y Álbum**

En `app/(tabs)/index.tsx`, reemplazar `<ActivityIndicator />` cuando `isLoading`:
```tsx
if (isLoading) return <View className="flex-1 px-4 pt-14"><Skeleton style={{ height: 120, marginBottom: 12 }} /><Skeleton style={{ height: 60, marginBottom: 8 }} /><Skeleton style={{ height: 60 }} /></View>;
```

En `app/(tabs)/album.tsx`, reemplazar el "Cargando…":
```tsx
{isLoading ? <SkeletonAlbumGrid /> : ...}
```

- [ ] **Step 8.4: Commit**

```bash
git add src/ui/Skeleton.tsx src/ui/SkeletonAlbumGrid.tsx app/\(tabs\)/
git commit -m "feat(ui): shimmer skeletons for loading states"
```

---

## Task 9: EmptyState con ilustraciones SVG

**Files:**
- Create: `src/ui/EmptyState.tsx`

- [ ] **Step 9.1: Crear**

```tsx
import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

type Variant = "planet" | "stars" | "rocket";

function Planet() {
  return (
    <Svg width="80" height="80" viewBox="0 0 80 80">
      <Circle cx="40" cy="40" r="22" fill="#7c5cff" opacity="0.7" />
      <Circle cx="34" cy="34" r="3" fill="#a78bfa" />
      <Circle cx="48" cy="44" r="2" fill="#a78bfa" />
      <Path d="M 12 40 Q 40 28 68 40 Q 40 52 12 40 Z" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.6" />
    </Svg>
  );
}

function Stars() {
  return (
    <Svg width="80" height="80" viewBox="0 0 80 80">
      <Circle cx="20" cy="20" r="2" fill="#fff" />
      <Circle cx="60" cy="30" r="1.5" fill="#fff" opacity="0.7" />
      <Circle cx="40" cy="55" r="2.5" fill="#a78bfa" />
      <Circle cx="65" cy="60" r="1.2" fill="#fff" opacity="0.6" />
      <Circle cx="15" cy="60" r="1.8" fill="#fff" opacity="0.8" />
    </Svg>
  );
}

function Rocket() {
  return (
    <Svg width="80" height="80" viewBox="0 0 80 80">
      <Path d="M 40 10 L 50 40 L 40 60 L 30 40 Z" fill="#7c5cff" />
      <Circle cx="40" cy="32" r="4" fill="#fff" />
      <Path d="M 35 60 L 30 70 L 40 65 L 50 70 L 45 60 Z" fill="#3b82f6" />
    </Svg>
  );
}

export function EmptyState({
  variant,
  title,
  message
}: {
  variant: Variant;
  title: string;
  message?: string;
}) {
  return (
    <View className="items-center justify-center py-12 px-6">
      {variant === "planet" && <Planet />}
      {variant === "stars" && <Stars />}
      {variant === "rocket" && <Rocket />}
      <Text className="text-space-ink font-semibold mt-4 text-center">{title}</Text>
      {message && <Text className="text-space-mute text-sm mt-1 text-center">{message}</Text>}
    </View>
  );
}
```

- [ ] **Step 9.2: Aplicar** en Álbum (filtros vacíos), Cambios (sin datos), Amigos (lista vacía)

Ejemplos:

`app/(tabs)/album.tsx`, reemplazar `ListEmptyComponent`:
```tsx
ListEmptyComponent={
  <EmptyState variant="stars" title="Sin resultados" message="Cambiá el filtro o el término de búsqueda." />
}
```

`app/(tabs)/trades.tsx` MatchesView empty:
```tsx
return <EmptyState variant="rocket" title="Sin matches todavía" message="Sumá amigos desde Perfil." />;
```

`app/friends/index.tsx` empty:
```tsx
ListEmptyComponent={
  <EmptyState variant="planet" title="Sin amigos" message="Compartí tu código en Perfil." />
}
```

- [ ] **Step 9.3: Commit**

```bash
git add src/ui/EmptyState.tsx app/
git commit -m "feat(ui): EmptyState with SVG illustrations"
```

---

## Task 10: Migrar Álbum a FlashList

**Files:**
- Modify: `app/(tabs)/album.tsx`

- [ ] **Step 10.1: Reemplazar `FlatList` por `FlashList`**

Importar:
```tsx
import { FlashList } from "@shopify/flash-list";
```

Reemplazar el `<FlatList ...>` por:
```tsx
<FlashList
  data={data ?? []}
  keyExtractor={(item) => item.code}
  numColumns={4}
  estimatedItemSize={88}
  renderItem={({ item }) => (
    <AnimatedStickerCell
      s={item}
      onTap={async () => {
        await haptics.light();
        inc.mutate(item.code);
      }}
      onLong={async () => {
        await haptics.medium();
        dec.mutate(item.code);
      }}
      onInfo={() => router.push(`/sticker/${item.code}`)}
    />
  )}
  ListEmptyComponent={<EmptyState variant="stars" title="Sin resultados" />}
/>
```

- [ ] **Step 10.2: Commit**

```bash
git add app/\(tabs\)/album.tsx
git commit -m "perf(album): migrate to FlashList"
```

---

## Task 11: Generador de íconos

**Files:**
- Create: `scripts/gen-icon.js`
- Overwrite: `assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash.png`

- [ ] **Step 11.1: Instalar `sharp` como devDependency**

```bash
npm install --save-dev sharp
```

- [ ] **Step 11.2: Crear `scripts/gen-icon.js`**

```js
// node scripts/gen-icon.js
// Genera icon.png, adaptive-icon.png, splash.png a partir de un SVG espacial.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const out = path.join(__dirname, "..", "assets");

const SVG = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#5b1ea3"/>
      <stop offset="60%" stop-color="#1a0d4d"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c5cff"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="512" r="220" fill="url(#ring)" opacity="0.95"/>
  <circle cx="450" cy="460" r="40" fill="#a78bfa" opacity="0.9"/>
  <circle cx="600" cy="540" r="25" fill="#fff" opacity="0.7"/>
  <ellipse cx="512" cy="512" rx="320" ry="60" fill="none" stroke="#a78bfa" stroke-width="6" opacity="0.6" transform="rotate(-20 512 512)"/>
  <circle cx="200" cy="200" r="4" fill="#fff"/>
  <circle cx="850" cy="180" r="3" fill="#fff"/>
  <circle cx="800" cy="850" r="5" fill="#fff"/>
  <circle cx="180" cy="800" r="3" fill="#fff"/>
</svg>
`;

async function main() {
  const buf = Buffer.from(SVG);
  await sharp(buf).resize(1024, 1024).png().toFile(path.join(out, "icon.png"));
  await sharp(buf).resize(432, 432).png().toFile(path.join(out, "adaptive-icon.png"));
  // Splash: 1242×2436 (iPhone X), centra el ícono
  await sharp({
    create: { width: 1242, height: 2436, channels: 4, background: "#000000" }
  })
    .composite([{ input: await sharp(buf).resize(600, 600).png().toBuffer(), top: 918, left: 321 }])
    .png()
    .toFile(path.join(out, "splash.png"));
  console.log("✓ Generated icon.png, adaptive-icon.png, splash.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 11.3: Generar**

```bash
node scripts/gen-icon.js
```
Expected: 3 PNGs generados en `assets/`.

- [ ] **Step 11.4: Asegurar que `app.json` referencia los íconos**

Verificar que `app.json` tiene:
```json
{
  "icon": "./assets/icon.png",
  "splash": { "image": "./assets/splash.png", "resizeMode": "contain", "backgroundColor": "#000000" },
  "android": { "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#000000" } }
}
```

- [ ] **Step 11.5: Commit**

```bash
git add scripts/gen-icon.js assets/icon.png assets/adaptive-icon.png assets/splash.png package.json package-lock.json
git commit -m "feat(assets): generate space-themed icon and splash"
```

---

## Task 12: Onboarding 3 pantallas

**Files:**
- Create: `src/lib/onboarding.ts`, `app/onboarding/_layout.tsx`, `app/onboarding/[step].tsx`
- Modify: `app/_layout.tsx` (gate)

- [ ] **Step 12.1: Crear `src/lib/onboarding.ts`**

```ts
import * as SecureStore from "expo-secure-store";

const KEY = "panini_onboarded_v1";

export async function hasSeenOnboarding(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(KEY);
  return v === "1";
}

export async function markOnboardingSeen(): Promise<void> {
  await SecureStore.setItemAsync(KEY, "1");
}
```

- [ ] **Step 12.2: Crear `app/onboarding/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 12.3: Crear `app/onboarding/[step].tsx`**

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, Pressable } from "react-native";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowGradientCard } from "@/ui/GlowGradientCard";
import { markOnboardingSeen } from "@/lib/onboarding";

const STEPS: Record<string, { title: string; body: string; cta: string; next: string }> = {
  "1": {
    title: "Tu álbum, en tu bolsillo",
    body: "Tracking de las 670 figuritas del Mundial 2026.",
    cta: "Siguiente",
    next: "/onboarding/2"
  },
  "2": {
    title: "Tap = pegada · Long-press = quitar",
    body: "Marcá rápido. Las repetidas las cuenta solas.",
    cta: "Siguiente",
    next: "/onboarding/3"
  },
  "3": {
    title: "Cambios con amigos",
    body: "Agregá amigos por código y la app te muestra qué tiene cada uno que vos necesitás.",
    cta: "Empezar",
    next: "(tabs)"
  }
};

export default function OnboardingStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const router = useRouter();
  const data = STEPS[step ?? "1"] ?? STEPS["1"];

  const onNext = async () => {
    if (data.next === "(tabs)") {
      await markOnboardingSeen();
      router.replace("/(tabs)");
    } else {
      router.push(data.next);
    }
  };

  return (
    <StarryBackground>
      <View className="flex-1 px-6 justify-center">
        <Text className="text-space-violet text-xs tracking-widest mb-2">
          {step}/3
        </Text>
        <Text className="text-space-ink text-3xl font-bold mb-3">{data.title}</Text>
        <Text className="text-space-mute text-base mb-10">{data.body}</Text>
        <GlowGradientCard>
          <Pressable onPress={onNext} className="py-3 items-center">
            <Text className="text-white font-semibold">{data.cta}</Text>
          </Pressable>
        </GlowGradientCard>
      </View>
    </StarryBackground>
  );
}
```

- [ ] **Step 12.4: Modificar `app/_layout.tsx`** — gate de onboarding

Antes del retorno final, agregar lógica:
```tsx
import { hasSeenOnboarding } from "@/lib/onboarding";
// dentro del useEffect que carga schema:
const seen = await hasSeenOnboarding();
setOnboarded(seen);
// y en AuthGate, después del session check, si !seen y no estamos en /onboarding → redirect
```

Implementación detallada: agregar a `RootLayout`:
```tsx
const [onboarded, setOnboarded] = useState<boolean | null>(null);
// dentro del useEffect:
const seen = await hasSeenOnboarding();
setOnboarded(seen);
// en AuthGate:
if (!onboarded && segments.join("/") !== "onboarding/1" && !segments.join("/").startsWith("onboarding")) {
  router.replace("/onboarding/1");
  return;
}
```

(Pasarle `onboarded` a `AuthGate` como prop o leerlo de un Zustand. Para simplicidad, usar Zustand store en `useSessionStore` agregando `hasSeenOnboarding: boolean`.)

- [ ] **Step 12.5: Commit**

```bash
git add src/lib/onboarding.ts app/onboarding/ app/_layout.tsx
git commit -m "feat(onboarding): 3-screen intro gated by SecureStore flag"
```

---

## Task 13: Borrar cuenta (RPC + UI)

**Files:**
- Create: `supabase/migrations/20260428000010_delete_account.sql`
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 13.1: Crear migración**

```sql
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  -- Cascadea por FKs ON DELETE CASCADE en profiles, sticker_status, friendships
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
```

- [ ] **Step 13.2: Aplicar**

```bash
supabase db push
```

- [ ] **Step 13.3: Botón en Profile**

Agregar al final de `app/(tabs)/profile.tsx`:

```tsx
<Pressable
  onPress={() => {
    Alert.alert(
      "Borrar cuenta",
      "Vas a borrar tu cuenta y todos tus datos. Esto no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.rpc("delete_my_account");
            if (error) {
              Alert.alert("Error", error.message);
              return;
            }
            await supabase.auth.signOut();
          }
        }
      ]
    );
  }}
  className="bg-space-dark border border-red-500/40 rounded-xl py-3 items-center mt-3"
>
  <Text className="text-red-400 font-semibold">Borrar cuenta</Text>
</Pressable>
```

- [ ] **Step 13.4: Commit**

```bash
git add supabase/migrations/20260428000010_delete_account.sql app/\(tabs\)/profile.tsx
git commit -m "feat: account deletion RPC and UI"
```

---

## Task 14: Pantalla "Acerca de"

**Files:**
- Create: `src/lib/version.ts`, `app/about.tsx`
- Modify: `app/(tabs)/profile.tsx`, `app/_layout.tsx`

- [ ] **Step 14.1: Crear `src/lib/version.ts`**

```ts
import Constants from "expo-constants";

export const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";
export const BUILD_NUMBER =
  Constants.expoConfig?.ios?.buildNumber ??
  String(Constants.expoConfig?.android?.versionCode ?? 1);
```

- [ ] **Step 14.2: Crear `app/about.tsx`**

```tsx
import { ScrollView, View, Text, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { APP_VERSION, BUILD_NUMBER } from "@/lib/version";

const PRIVACY_URL = "https://cosmaneura.com/panini/privacy";
const TERMS_URL = "https://cosmaneura.com/panini/terms";

export default function About() {
  const router = useRouter();
  return (
    <StarryBackground>
      <ScrollView className="flex-1 px-4 pt-14">
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">
          ACERCA DE
        </Text>
        <GlowCard className="mb-3">
          <Text className="text-space-ink font-bold text-lg">Panini Album</Text>
          <Text className="text-space-mute">Versión {APP_VERSION} (build {BUILD_NUMBER})</Text>
        </GlowCard>

        <Pressable
          onPress={() => Linking.openURL(PRIVACY_URL)}
          className="bg-space-mid rounded-lg py-3 items-center mb-2"
        >
          <Text className="text-space-ink">Política de privacidad</Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL(TERMS_URL)}
          className="bg-space-mid rounded-lg py-3 items-center"
        >
          <Text className="text-space-ink">Términos de uso</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} className="mt-6 self-center">
          <Text className="text-space-mute">Cerrar</Text>
        </Pressable>
      </ScrollView>
    </StarryBackground>
  );
}
```

- [ ] **Step 14.3: Registrar la ruta como modal en `app/_layout.tsx`**

Agregar dentro del `<Stack>`:
```tsx
<Stack.Screen name="about" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
```

- [ ] **Step 14.4: Link desde Profile**

Agregar en `app/(tabs)/profile.tsx` justo antes del botón "Cerrar sesión":
```tsx
<Pressable onPress={() => router.push("/about")} className="bg-space-mid rounded-xl py-3 items-center mb-2">
  <Text className="text-space-ink">Acerca de</Text>
</Pressable>
```

- [ ] **Step 14.5: Commit**

```bash
git add src/lib/version.ts app/about.tsx app/_layout.tsx app/\(tabs\)/profile.tsx
git commit -m "feat: about screen with version and legal links"
```

---

## Task 15: Privacy Policy + Terms

**Files:**
- Create: `docs/legal/privacy-policy.md`, `docs/legal/terms.md`

- [ ] **Step 15.1: Crear `docs/legal/privacy-policy.md`**

```markdown
# Política de Privacidad — Panini Album

Última actualización: 2026-04-28.

## Datos que colectamos

- **Identificador de Apple/Google**: el que sea que el proveedor de auth devuelva al iniciar sesión. No guardamos tu contraseña.
- **Username y nombre**: lo que vos elegís en el onboarding.
- **Avatar**: si Apple/Google lo devuelven, lo guardamos como URL.
- **Tu progreso del álbum**: qué stickers tenés y cuántas repetidas.
- **Tu lista de amigos** dentro de la app.

## Para qué los usamos

- Sincronizar tu progreso entre dispositivos.
- Mostrarte matches con tus amigos aceptados.

## Dónde se almacenan

- Servidores de Supabase (https://supabase.com), región configurada por nosotros.
- Localmente en tu dispositivo (cifrado por el OS para los tokens).

## Con quién los compartimos

- **No vendemos ni compartimos con terceros.**
- Tus stickers son visibles para los amigos que aceptaste mutuamente.

## Retención

- Mantenemos tus datos mientras tengas cuenta.
- Borrar cuenta desde la app elimina todo permanentemente.

## Contacto

dev@cosmaneura.com
```

- [ ] **Step 15.2: Crear `docs/legal/terms.md`**

```markdown
# Términos de Uso — Panini Album

Última actualización: 2026-04-28.

## Uso aceptable

- Esta app es para uso personal de coleccionistas.
- No usás cuenta múltiple para spamear amigos ajenos.
- No es oficial de Panini ni de la FIFA. Marcas y números son referenciales.

## Sin garantías

- La app se ofrece "as-is", sin garantía de disponibilidad ni precisión del dataset.
- Podemos perder o cambiar funcionalidades en cualquier momento.

## Contacto

dev@cosmaneura.com
```

- [ ] **Step 15.3: Commit**

```bash
git add docs/legal/
git commit -m "docs(legal): minimal privacy policy and terms"
```

---

## Task 16: EAS configuration

**Files:**
- Create: `eas.json`

- [ ] **Step 16.1: Instalar EAS CLI globalmente**

```bash
npm install -g eas-cli
eas --version
```

- [ ] **Step 16.2: `eas init`**

```bash
eas init
```
Esto crea el proyecto en Expo y agrega `extra.eas.projectId` a `app.json`.

- [ ] **Step 16.3: Crear `eas.json`**

```json
{
  "cli": { "version": ">= 5.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "$EXPO_PUBLIC_SUPABASE_URL",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "$EXPO_PUBLIC_SUPABASE_ANON_KEY",
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "$EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "$EXPO_PUBLIC_SUPABASE_URL",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "$EXPO_PUBLIC_SUPABASE_ANON_KEY",
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "$EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "$EXPO_PUBLIC_SUPABASE_URL",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "$EXPO_PUBLIC_SUPABASE_ANON_KEY",
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "$EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "$EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "REPLACE_WITH_APPLE_ID",
        "ascAppId": "REPLACE_WITH_ASC_APP_ID",
        "appleTeamId": "REPLACE_WITH_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./secrets/play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

- [ ] **Step 16.4: Cargar secrets a EAS**

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "<value>"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<value>"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "<value>"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value "<value>"
```

- [ ] **Step 16.5: Commit**

```bash
git add eas.json app.json
git commit -m "chore(eas): configure build profiles and submit targets"
```

---

## Task 17: App Store Connect setup (manual)

> Tarea **manual**, sin código. Requiere cuenta de Apple Developer ($99/año).

- [ ] **Step 17.1: Crear App ID en Apple Developer**

1. https://developer.apple.com/account → Identifiers → "+" → App IDs.
2. Bundle ID: `com.cosmaneura.panini`. Capabilities: Sign in with Apple.

- [ ] **Step 17.2: Crear app en App Store Connect**

1. https://appstoreconnect.apple.com → My Apps → "+".
2. Platform: iOS. Name: "Panini Album". Bundle ID: el del paso 1. SKU: `panini-album-1`.

- [ ] **Step 17.3: Capturar IDs**

Anotar `Apple ID` (numérico) y `Team ID` (string en Account → Membership). Pegarlos en `eas.json` reemplazando los `REPLACE_WITH_*`.

- [ ] **Step 17.4: Llenar metadata mínima**

Categoría: Sports. Edad: 4+. Privacy Policy URL: la del Task 15. Soporte: email del usuario.

- [ ] **Step 17.5: Commit (solo `eas.json` actualizado)**

```bash
git add eas.json
git commit -m "chore(eas): set Apple IDs"
```

---

## Task 18: Build interno iOS → TestFlight

> Manual, requiere cuenta Apple Developer.

- [ ] **Step 18.1: Configurar credentials**

```bash
eas credentials
# elegir iOS, configurar push key (incluso si push aún no se usa)
```

- [ ] **Step 18.2: Build**

```bash
eas build --platform ios --profile preview
```
Esperar ~15-30 min. Recibís email cuando termina.

- [ ] **Step 18.3: Submit a TestFlight**

```bash
eas submit --platform ios --latest
```

- [ ] **Step 18.4: En App Store Connect → TestFlight**

Esperar el procesamiento de Apple (~30 min). Crear un grupo "Internal" e invitar tu email. Recibís invitación por TestFlight app.

- [ ] **Step 18.5: Verificar en device**

Instalar la app desde TestFlight. Abrir → flujo completo de auth/álbum/cambios.

- [ ] **Step 18.6: Commit (no hay archivos)**

Marcar el step como hecho y avanzar.

---

## Task 19: Play Console setup + build interno Android

> Manual. Cuenta Google Play Developer ($25 one-time).

- [ ] **Step 19.1: Crear app en Play Console**

1. https://play.google.com/console → Crear app.
2. Nombre: "Panini Album". Default language. Categoría: Sports. Free.

- [ ] **Step 19.2: Crear service account para EAS submit**

1. Google Cloud Console → IAM → Service Accounts → crear.
2. Role: Service Account User.
3. Descargar JSON, guardarlo en `secrets/play-service-account.json` (NO commitear).
4. Asegurarse que `secrets/` está en `.gitignore`.

- [ ] **Step 19.3: Vincular service account en Play Console**

Setup → API access → Link Google Cloud project → grant access al service account creado.

- [ ] **Step 19.4: Build**

```bash
eas build --platform android --profile preview
```

- [ ] **Step 19.5: Subir build manualmente la primera vez**

(Play Console rechaza submits automáticos hasta que la primera versión está aprobada manualmente.)

1. Descargar `.aab` desde el dashboard de EAS.
2. Play Console → Test → Internal testing → Create new release → upload `.aab`.
3. Llenar release notes. Save → Review → Start rollout.

- [ ] **Step 19.6: A futuro, submits automáticos**

```bash
eas submit --platform android --latest
```

- [ ] **Step 19.7: Verificar en device**

Internal testing genera un opt-in link. Compartilo con tu email, instalá desde Play Store con la cuenta correspondiente.

- [ ] **Step 19.8: Commit (`.gitignore` por si modificaste)**

Si agregaste `secrets/` al `.gitignore`:
```bash
git add .gitignore
git commit -m "chore: ignore Play service account secrets"
```

---

## Task 20: Checklist de assets de stores

**Files:**
- Create: `docs/release/store-assets-checklist.md`

- [ ] **Step 20.1: Crear**

```markdown
# Store Assets Checklist

## App Store (iOS)

### Required screenshots
- [ ] 6.7" (1290×2796): 3 mínimo, hasta 10
- [ ] 6.5" (1242×2688): 3 mínimo
- [ ] 5.5" (1242×2208): 3 mínimo (iPhone 8 Plus)

Capturar desde simulador con `xcrun simctl io booted screenshot`.

### Texto
- [ ] Nombre: "Panini Album" (30 chars max)
- [ ] Subtitle: "Mundial 2026 sticker tracker" (30 chars max)
- [ ] Promotional text: 170 chars max (editable sin update)
- [ ] Description: 4000 chars max
- [ ] Keywords: 100 chars, separados por coma
- [ ] Support URL
- [ ] Marketing URL (opcional)

### App Privacy Questionnaire
Datos colectados (sec 5 de privacy policy): linkear cuáles, propósito, si linkean a la identidad.

## Play Store (Android)

### Required screenshots
- [ ] Phone: 1080×1920 mínimo, 3-8 imágenes

### Required graphics
- [ ] Feature graphic: 1024×500 PNG/JPG
- [ ] App icon: 512×512 (lo provee EAS)

### Texto
- [ ] Título: 30 chars max
- [ ] Descripción corta: 80 chars
- [ ] Descripción larga: 4000 chars

### Cuestionarios
- [ ] Content rating
- [ ] Target audience (mayores de 13)
- [ ] Data safety (igual que App Privacy)
```

- [ ] **Step 20.2: Commit**

```bash
git add docs/release/store-assets-checklist.md
git commit -m "docs(release): store assets checklist"
```

---

## Task 21: Smoke test final exhaustivo

**Files:**
- Create: `docs/release/smoke-test-checklist.md`

- [ ] **Step 21.1: Crear**

```markdown
# Smoke Test Final — 1.0.0-beta.1

Correr en **iOS device físico** (TestFlight) y **Android device físico** (internal track).

## Onboarding (primera vez)
- [ ] Splash + 3 pantallas de intro
- [ ] No vuelven a aparecer en el segundo run

## Auth
- [ ] Sign in con Apple (iOS) — completa al 1er try
- [ ] Sign in con Google (ambos OS) — completa
- [ ] Cancelar mid-flow no rompe nada
- [ ] Onboarding de username valida + guarda
- [ ] Cerrar sesión y volver a entrar restaura el estado

## Home
- [ ] Progreso 0/670 visible al inicio
- [ ] Skeleton aparece breve antes del contenido
- [ ] Parallax sutil al hacer scroll
- [ ] Indicador "X pendientes" aparece y desaparece

## Álbum
- [ ] Grid renderiza fluido sobre 670 stickers (FlashList)
- [ ] Tap incrementa con animación scale-bounce
- [ ] Long-press decrementa
- [ ] Tap en ⓘ abre modal de detalle
- [ ] Buscador filtra por número y nombre
- [ ] Filtro "Faltan" / "Repetidas" funciona
- [ ] Empty state ilustrado cuando no hay resultados

## Sync
- [ ] Marcar offline → cambios encolados
- [ ] Volver online → cambios pushean
- [ ] Cambios desde otro device aparecen al volver foreground
- [ ] Last-write-wins consistente

## Cambios
- [ ] Tab "Mi lista" muestra preview correcto
- [ ] Toggle "agrupar por sección" cambia formato
- [ ] Compartir abre share sheet del OS con texto

## Amigos
- [ ] Profile muestra QR + invite_code legible
- [ ] Copiar código al clipboard funciona
- [ ] Escanear QR (cámara) agrega al amigo
- [ ] Búsqueda por @username funciona
- [ ] Tab Matches muestra summary
- [ ] Detalle bidireccional muestra ambos lados
- [ ] Realtime: cambios de amigo refrescan matches

## Profile
- [ ] Avatar/iniciales correcto
- [ ] Editar display_name guarda
- [ ] Borrar cuenta confirma + ejecuta + cierra sesión
- [ ] Acerca de muestra versión correcta
- [ ] Links a privacy/terms abren browser

## Visual / a11y
- [ ] Estrellas + nebulosa visibles en todas las pantallas
- [ ] Glow en CTAs principales
- [ ] Transiciones suaves entre pantallas
- [ ] VoiceOver / TalkBack lee labels en sticker cells

## Performance
- [ ] Lista del Álbum no laggea con 670 elementos
- [ ] Scroll en Home es 60fps
- [ ] No memory leaks visibles en sesión de 30 min

## Crashes
- [ ] Apagar Wi-Fi y entrar a la app
- [ ] Forzar quit y reabrir 5 veces
- [ ] Cambiar de pantalla rápido (Home → Álbum → Cambios)
```

- [ ] **Step 21.2: Ejecutar el smoke test**

Marcar todos los checkboxes durante la sesión real con device.

- [ ] **Step 21.3: Si hay regresiones, fix + recommit**

Para cada bug encontrado: escribir test fallido (cuando aplique) + fix + commit.

- [ ] **Step 21.4: Commit del checklist**

```bash
git add docs/release/smoke-test-checklist.md
git commit -m "docs(release): final smoke test checklist for 1.0.0-beta.1"
```

---

## Task 22: README final + tag de release

**Files:**
- Modify: `README.md`

- [ ] **Step 22.1: Actualizar README**

Reemplazar la sección "Estado actual":

```md
## Estado actual: 1.0.0-beta.1

**Funcionalidad completa:** browse del álbum, marcado offline-first, progreso por sección, auth (Apple+Google), sync remoto, compartir lista, amigos por QR/username, matches con Realtime, pulido visual.

**Distribución:** TestFlight (iOS) + Internal track (Play Store).

Próximos pasos: feedback de beta testers, iteración a 1.0.0 stable.
```

- [ ] **Step 22.2: Commit + tag**

```bash
git add README.md
git commit -m "docs: bump README to 1.0.0-beta.1"
git tag -a v1.0.0-beta.1 -m "First beta — full v1 functionality"
```

---

## Cierre del P5

Al terminar, la app:
- Está pulida visualmente con animaciones, parallax, glow, skeletons, empty states.
- Performa bien con FlashList sobre 670 stickers.
- Tiene flow de borrado de cuenta + privacy/terms.
- Está distribuida vía TestFlight + Play internal track.
- Tiene smoke test checklist documentado.

**Post-release:**
- Monitorear feedback de testers (compartir el TestFlight link).
- Iteración a 1.0.0 stable cuando el feedback se asiente.
- Versiones futuras: push notifications, multi-álbum, modo light, internacionalización.
