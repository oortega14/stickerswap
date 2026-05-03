# Team Page Flag Theming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tiñer toda la página de equipo (no sólo el header) con los colores de la bandera, y reemplazar `#10` por el código del sticker (`MEX-12`).

**Architecture:** Cambio puramente presentacional en `app/team/[code].tsx` y extensión backwards-compatible de `src/ui/ProgressBar.tsx`. Estrategia: `primary` domina superficies grandes (siempre tiene `text` con contraste garantizado), `accent` decora detalles chicos (label "JUGADORES", badge `×N`, check ✓, fin del gradient de progreso). Para estados "falta", el texto usa los colores claros globales (`#e8e6ff`, `#a59cdf`) porque la superficie efectiva sigue siendo oscura (starry + overlay 10% + bg con primary @ 10%).

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript strict, NativeWind v4, Reanimated v4, react-native-svg, expo-linear-gradient.

**Spec:** `docs/superpowers/specs/2026-05-03-team-page-flag-theming-design.md`

---

## File Structure

**Modified:**
- `src/theme/colors.ts` — agregar helper `withAlpha(hex, alpha)`.
- `src/ui/ProgressBar.tsx` — props opcionales `from?: string; to?: string` con defaults retrocompatibles.
- `app/team/[code].tsx` — overlay del body, theming de `SpecialCard` y `PlayerRow`, label "JUGADORES" en `accent`, badge `×N` en `accent`, check `✓` en `accent`, ProgressBar con colores del equipo, `#{number}` → `{code}`.

**Sin tests automatizados nuevos** (UI pura, alineado con la convención del repo: tests sólo para lógica pura y data layer).

---

## Task 1: Helper `withAlpha` en `src/theme/colors.ts`

**Files:**
- Modify: `src/theme/colors.ts`

- [ ] **Step 1: Agregar el helper `withAlpha` al final del archivo**

Editá `src/theme/colors.ts` y agregá al final:

```ts
/**
 * Convierte un hex color (#RRGGBB o #RGB) a rgba con la alpha dada.
 * Devuelve el input sin cambios si no parsea (ej. ya es rgba/named color).
 */
export function withAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add src/theme/colors.ts
git commit -m "feat(theme): add withAlpha helper for hex-to-rgba conversion"
```

---

## Task 2: Extender `ProgressBar` con colores configurables

**Files:**
- Modify: `src/ui/ProgressBar.tsx`

- [ ] **Step 1: Reemplazar la firma y los `Stop` con props opcionales**

Reemplazá el contenido de `src/ui/ProgressBar.tsx` por:

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

export function ProgressBar({
  pct,
  height = 8,
  from = "#7c5cff",
  to = "#3b82f6"
}: {
  pct: number;
  height?: number;
  from?: string;
  to?: string;
}) {
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
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
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

- [ ] **Step 2: Verificar que los callsites existentes siguen compilando**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. Los 3 callsites actuales (`app/(tabs)/index.tsx:72`, `app/(tabs)/index.tsx:140`, `app/team/[code].tsx:67`) no pasan `from`/`to`, así que usan los defaults — gradient idéntico al anterior.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ProgressBar.tsx
git commit -m "feat(ui): make ProgressBar gradient colors configurable"
```

---

## Task 3: Theming completo de la página de equipo + código

**Files:**
- Modify: `app/team/[code].tsx`

Esta tarea reemplaza el archivo entero. Los cambios son densos pero todos en un mismo archivo y conceptualmente atómicos (un solo "redesign pass"), por lo que va en un único commit.

- [ ] **Step 1: Reemplazar `app/team/[code].tsx` con la nueva versión**

```tsx
import { useMemo } from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StarryBackground } from "@/ui/StarryBackground";
import { ProgressBar } from "@/ui/ProgressBar";
import { useTeamStickers, useIncrement, useDecrement } from "@/hooks/useStickers";
import { haptics } from "@/lib/haptics";
import { getTeamColors } from "@/theme/teamColors";
import { withAlpha } from "@/theme/colors";
import type { StickerWithStatus } from "@/domain/types";

const FALTA_TEXT = "#e8e6ff";
const FALTA_DIM = "#a59cdf";

export default function TeamDetail() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { data, isLoading } = useTeamStickers(code ?? "");
  const inc = useIncrement();
  const dec = useDecrement();

  const colors = useMemo(() => getTeamColors(code), [code]);

  const summary = useMemo(() => {
    if (!data) return null;
    const total = data.length;
    const collected = data.filter((s) => s.count >= 1).length;
    const duplicates = data.reduce((acc, s) => acc + (s.count > 1 ? s.count - 1 : 0), 0);
    return { total, collected, duplicates, pct: total === 0 ? 0 : collected / total };
  }, [data]);

  const teamName = data?.[0]?.section ?? code ?? "";
  const badge = data?.find((s) => s.type === "team_badge");
  const teamPhoto = data?.find((s) => s.type === "team_photo");
  const players = data?.filter((s) => s.type === "player") ?? [];

  if (isLoading || !data || !summary) {
    return (
      <StarryBackground>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      </StarryBackground>
    );
  }

  return (
    <StarryBackground>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header con color del equipo */}
        <LinearGradient
          colors={[colors.primary, "#000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ paddingTop: 56, paddingBottom: 24, paddingHorizontal: 16 }}
        >
          <Pressable onPress={() => router.back()} accessibilityLabel="Volver" accessibilityRole="button">
            <Text style={{ color: colors.text, opacity: 0.85, marginBottom: 12 }}>‹ Volver</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>{teamName}</Text>
          <Text style={{ color: colors.text, opacity: 0.75, fontSize: 12, letterSpacing: 1, marginTop: 4 }}>
            {code}
          </Text>
          <View className="mt-4">
            <Text style={{ color: colors.text, opacity: 0.75, fontSize: 11, letterSpacing: 2 }}>PROGRESO</Text>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700", marginTop: 2 }}>
              {summary.collected} / {summary.total}
            </Text>
            <View className="mt-2">
              <ProgressBar pct={summary.pct} from={colors.primary} to={colors.accent} />
            </View>
            <Text style={{ color: colors.text, opacity: 0.7, fontSize: 11, marginTop: 6 }}>
              {summary.duplicates > 0 ? `${summary.duplicates} repetidas` : "Sin repetidas"}
            </Text>
          </View>
        </LinearGradient>

        {/* Body con overlay sutil del color del equipo */}
        <View style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}>
          <View className="px-4 pt-4">
            {/* Escudo + team_photo en una fila */}
            {(badge || teamPhoto) && (
              <View className="flex-row gap-2 mb-4">
                {badge && (
                  <SpecialCard
                    s={badge}
                    label="ESCUDO"
                    inc={inc}
                    dec={dec}
                    primary={colors.primary}
                    text={colors.text}
                  />
                )}
                {teamPhoto && (
                  <SpecialCard
                    s={teamPhoto}
                    label="PLANTEL"
                    inc={inc}
                    dec={dec}
                    primary={colors.primary}
                    text={colors.text}
                  />
                )}
              </View>
            )}

            {/* Lista de jugadores */}
            <Text
              className="text-xs tracking-widest mb-2"
              style={{ color: colors.accent }}
            >
              JUGADORES ({players.length})
            </Text>
            {players.map((s) => (
              <PlayerRow
                key={s.code}
                s={s}
                primary={colors.primary}
                accent={colors.accent}
                text={colors.text}
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
          </View>
        </View>
      </ScrollView>
    </StarryBackground>
  );
}

function SpecialCard({
  s,
  label,
  inc,
  dec,
  primary,
  text
}: {
  s: StickerWithStatus;
  label: string;
  inc: ReturnType<typeof useIncrement>;
  dec: ReturnType<typeof useDecrement>;
  primary: string;
  text: string;
}) {
  const collected = s.count >= 1;
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        inc.mutate(s.code);
      }}
      onLongPress={() => {
        haptics.medium();
        dec.mutate(s.code);
      }}
      delayLongPress={350}
      accessibilityLabel={`${label} ${s.name}`}
      accessibilityRole="button"
      className="flex-1 rounded-xl p-3"
      style={{
        backgroundColor: collected ? primary : withAlpha(primary, 0.12),
        borderWidth: collected ? 0 : 1,
        borderColor: withAlpha(primary, 0.35),
        borderStyle: collected ? "solid" : "dashed"
      }}
    >
      <Text
        className="text-xs tracking-widest"
        style={{ color: collected ? text : FALTA_DIM }}
      >
        {s.code} · {label}
      </Text>
      <Text
        className="text-base font-semibold mt-1"
        style={{ color: collected ? text : FALTA_TEXT }}
      >
        {s.name}
      </Text>
      {s.count > 1 && (
        <Text
          className="text-xs mt-1"
          style={{ color: collected ? text : FALTA_DIM }}
        >
          ×{s.count}
        </Text>
      )}
    </Pressable>
  );
}

function PlayerRow({
  s,
  primary,
  accent,
  text,
  onTap,
  onLong
}: {
  s: StickerWithStatus;
  primary: string;
  accent: string;
  text: string;
  onTap: () => void;
  onLong: () => void;
}) {
  const collected = s.count >= 1;
  return (
    <Pressable
      onPress={onTap}
      onLongPress={onLong}
      delayLongPress={350}
      accessibilityLabel={`${collected ? "Pegado" : "Falta"}: ${s.name}`}
      accessibilityRole="button"
      className="flex-row items-center justify-between rounded-lg mb-2 px-3 py-3"
      style={{
        backgroundColor: collected ? primary : withAlpha(primary, 0.1),
        borderWidth: collected ? 0 : 1,
        borderColor: withAlpha(primary, 0.3)
      }}
    >
      <View className="flex-row items-center flex-1">
        <Text
          className="font-mono text-xs mr-3"
          style={{
            color: collected ? withAlpha(text, 0.7) : FALTA_DIM,
            minWidth: 56
          }}
        >
          {s.code}
        </Text>
        <Text
          className="text-base font-semibold flex-1"
          style={{ color: collected ? text : FALTA_TEXT }}
        >
          {s.name}
        </Text>
      </View>
      {s.count > 1 ? (
        <View
          className="rounded-full px-2 py-0.5 ml-2"
          style={{ backgroundColor: accent }}
        >
          <Text className="text-xs font-bold" style={{ color: text }}>×{s.count}</Text>
        </View>
      ) : collected ? (
        <Text className="text-xs ml-2" style={{ color: accent }}>✓</Text>
      ) : (
        <Text className="text-xs ml-2" style={{ color: FALTA_DIM }}>·</Text>
      )}
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS sin errores.

- [ ] **Step 3: Tests**

Run: `pnpm test`
Expected: PASS — los ~55 tests existentes siguen verdes (este cambio no toca lógica).

- [ ] **Step 4: Verificación visual en device**

Iniciá Metro y abrí la app en device físico (signing free no funciona en simulador con Google Sign-In, pero la página de equipo se abre estando autenticado o si entrás directo al deeplink).

```bash
eval "$(mise activate zsh)"
pnpm start
```

Navegá a páginas de equipo y verificá:

| Equipo | Qué verificar                                                          |
|--------|------------------------------------------------------------------------|
| MEX    | Header verde→negro, body verde sutil, filas verdes, badge `×N` rojo, código `MEX-12` visible. |
| ARG    | Filas celeste pegada, accent blanco para `JUGADORES` y `×N`. Texto navy en pegadas, texto claro en falta. |
| BRA    | Pegada amarilla con texto navy, accent verde, bg falta amarillo @ 10%. |
| USA    | Pegada navy con texto blanco, accent rojo, contraste alto.            |
| ENG    | Accent blanco — chequear que `×N` con texto blanco no quede invisible. Si pasa, agregar override en `teamColors.ts` para ENG (ej. accent rojo de la cruz). |
| POL    | Caso borde: primary blanco. El header se ve casi blanco con texto navy, body con overlay blanco @ 10% sigue oscuro. Aceptable. |

Para cada uno: tap en una fila → debería pegarse (cambia a primary fill). Long press → despega. Tap en otra para forzar `count > 1` y ver el badge `×N`.

- [ ] **Step 5: Commit**

```bash
git add app/team/[code].tsx
git commit -m "feat(team): full flag-color theming + show sticker code on rows"
```

---

## Self-Review

**Spec coverage:**
- Header sin cambios ✅ (Task 3 Step 1, mantiene `LinearGradient([primary, "#000"])`)
- Overlay 10% del primary sobre el body ✅ (Task 3 Step 1, `<View style={{ backgroundColor: withAlpha(colors.primary, 0.1) }}>`)
- `SpecialCard` pegada/falta con primary ✅ (Task 3 Step 1)
- `PlayerRow` pegada/falta con primary ✅ (Task 3 Step 1)
- Label "JUGADORES" en accent ✅ (Task 3 Step 1, `style={{ color: colors.accent }}`)
- Badge `×N` con accent + text ✅ (Task 3 Step 1)
- Check ✓ en accent ✅ (Task 3 Step 1)
- ProgressBar con primary→accent ✅ (Task 2 + Task 3 Step 1, `<ProgressBar from={colors.primary} to={colors.accent} />`)
- `#{number}` → `{code}` en SpecialCard y PlayerRow ✅ (Task 3 Step 1)
- Verificación manual con set representativo ✅ (Task 3 Step 4)

**Aclaración respecto a la spec:** la spec decía "texto en `colors.text` @ 70%" para estados "falta", pero `colors.text` está diseñado para contrastar con `primary` fuerte; en la superficie efectivamente oscura del estado "falta", para los ~15 equipos con `text` oscuro no se leería. El plan usa los colores claros globales (`#e8e6ff`/`#a59cdf`) en falta — confirmado con el usuario antes de escribir el plan.

**Placeholder scan:** sin TBD/TODO/handle errors abstractos. Cada step tiene código concreto o comando exacto.

**Type consistency:** props de `SpecialCard` (`primary`, `text`) y `PlayerRow` (`primary`, `accent`, `text`) consistentes con cómo se invocan desde `TeamDetail`. `withAlpha` firma `(hex: string, alpha: number) => string` consistente entre la definición (Task 1) y los usos (Task 3).

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-05-03-team-page-flag-theming.md`. Dos opciones de ejecución:

1. **Subagent-Driven (recomendado)** — dispatch de un subagent fresh por task, review entre tasks, iteración rápida.
2. **Inline Execution** — ejecutar las tasks en esta sesión con `executing-plans`, batch con checkpoints.

¿Cuál preferís?
