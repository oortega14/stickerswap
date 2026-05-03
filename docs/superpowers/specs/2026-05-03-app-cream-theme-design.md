# Cream/coffee theme + dark mode toggle

**Fecha**: 2026-05-03
**Estado**: Aprobado
**Alcance**: Tema visual de toda la app (excepto la página de equipo, que ya tiene su propia paleta por bandera).

## Problema

La app es hoy "dark-only" con un fondo púrpura-negro estrellado (`StarryBackground`) y accents en violeta/azul (`#7c5cff`, `#3b82f6`). El tono se siente nocturno/genérico, choca con la energía del Mundial, y rompe con la nueva página de equipo (que es un canvas pleno de color de la bandera, no un fondo estrellado).

Quiero rediseñarlo como un **tema claro tipo álbum/papel** (crema + café) con barras de progreso vivas que cambien de color según el avance, y un **modo oscuro opcional** ("espresso") que sea la misma identidad visual de noche.

## Objetivo

1. Reemplazar el fondo `StarryBackground` púrpura-negro por una paleta crema/café en todas las pantallas (excepto la team detail page, que mantiene sus colores por bandera).
2. Las barras de progreso (Home, Álbum, etc.) interpolan dinámicamente de rojo (vacío) a ámbar (medio) a verde (lleno) según el porcentaje del bar específico.
3. Toggle en Perfil para alternar entre claro y oscuro.
4. La identidad visual es coherente entre claro y oscuro: misma estructura, sólo invierte la base.

## No-objetivo

- No tocar el theming de la página de equipo (`app/team/[code].tsx`) — sigue con sus 5 slots curados por bandera.
- No detectar el tema del sistema. Default siempre claro; el usuario activa oscuro explícitamente.
- No animar la transición entre temas (instantáneo).
- No agregar tests automatizados (es UI).
- No tocar la paleta interna de los stickers físicos (escudos, fotos de jugadores, etc.).

## Diseño

### Paleta — modo claro (cream)

```
bg:        #fdf6e3   crema (fondo principal)
card:      #fffaf0   off-white (cards de equipos, listas)
text:      #3a2e1a   marrón oscuro (texto principal)
textMute:  #8b6f47   café medio (texto secundario, labels)
border:    rgba(58,46,26,0.10)   borde sutil de cards
track:     rgba(58,46,26,0.10)   track de progress bars
accent:    #6b4423   café oscuro (tab activa, botones primarios)
progressRed:   #dc2626    barra cuando pct < 33%
progressAmber: #f59e0b    barra en zona media
progressGreen: #16a34a    barra cuando pct ≥ 100%
```

### Paleta — modo oscuro (espresso)

Misma estructura, base invertida:

```
bg:        #2a1f12   espresso muy oscuro
card:      #3d2d1c   café medio
text:      #fdf6e3   crema
textMute:  #c8a67a   latte
border:    rgba(253,246,227,0.10)
track:     rgba(253,246,227,0.12)
accent:    #d4b896   sand (versión clara del café)
progressRed:   #ef4444    rojo más vibrante para dark
progressAmber: #f59e0b
progressGreen: #22c55e    verde más vibrante para dark
```

### Lógica de la barra de progreso

Para barras "dinámicas" (Home Total, cada team row, Álbum), el color del fill se interpola por tramo lineal entre tres stops:

- 0% → `progressRed`
- 50% → `progressAmber`
- 100% → `progressGreen`

Implementación: helper `progressColor(pct: number, theme: Theme): string` en `src/theme/progress.ts`. Devuelve el hex interpolado canal-por-canal (RGB lineal — más rápido y suficientemente fiel).

La barra usa una sola color (no un gradient interno) — visualmente más limpio y lee mejor en barras chicas.

Las barras de la **página de equipo** siguen usando su `from=surface, to=accent` actual (gradient con colores de la bandera). No se tocan.

### Theme provider y hook

- `src/theme/themes.ts` — exporta `lightTheme` y `darkTheme` (objetos con la paleta de arriba) más el tipo `Theme`.
- `src/theme/ThemeProvider.tsx` — Context provider. Carga la preferencia desde AsyncStorage en mount. Expone `useTheme()` → `{ theme: Theme, mode: "light" | "dark", setMode: (m) => Promise<void> }`.
- Default si AsyncStorage está vacío: `"light"`.
- El provider se monta en `app/_layout.tsx`, envolviendo el árbol existente (sin desplazar `QueryClientProvider`, sync engine, etc. — se anida dentro).

### Persistencia

- Dependencia nueva: `@react-native-async-storage/async-storage` (`pnpm exec expo install`).
- Clave: `panini.theme.mode` con valor `"light" | "dark"`.
- Lectura única al boot del provider; escrita en `setMode`.
- AsyncStorage es suficiente para esto — no requerimos transacciones, durabilidad ni queries. SQLite sería overkill.

### Reemplazo de `StarryBackground`

`StarryBackground` se renombra y se simplifica a `ThemedBackground` (`src/ui/ThemedBackground.tsx`):

```tsx
export function ThemedBackground({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return <View style={{ flex: 1, backgroundColor: theme.bg }}>{children}</View>;
}
```

Las "estrellitas" del diseño original se eliminan — no encajan con cream/papel ni con espresso.

Se actualizan todas las pantallas que importan `StarryBackground` para usar `ThemedBackground` (mismo shape, distinta implementación). La team detail page no usa ninguno de los dos (ya tiene su propio bg).

### Tab bar

`app/(tabs)/_layout.tsx` — colores hardcodeados (`tabBarActiveTintColor`, etc.) pasan a leer del theme:

```ts
const { theme } = useTheme();
// ...
tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border }
tabBarActiveTintColor: theme.accent
tabBarInactiveTintColor: theme.textMute
```

### Status bar

`app.json` — quitar `"userInterfaceStyle": "dark"` (la app deja de ser dark-only).

`app/_layout.tsx` — `<StatusBar>` dinámico según el modo activo:

```tsx
<StatusBar style={mode === "light" ? "dark" : "light"} />
```

### Toggle en Perfil

`app/(tabs)/profile.tsx` (o el path actual de Perfil) — agregar una sección "Apariencia" con un `Switch`:

```
Apariencia
├── Tema oscuro                            [ Switch ]
```

Switch ON → `setMode("dark")`. OFF → `setMode("light")`. Persiste y rerenderiza.

### `ProgressBar` — sin cambios de API

El componente `src/ui/ProgressBar.tsx` ya tiene `from`/`to` opcionales. La paleta default sigue siendo configurable. Para barras dinámicas, los callers calculan el color con `progressColor(pct, theme)` y lo pasan como `from=color` y `to=color` (fill liso de un único color por barra).

No se introduce un modo `dynamic` propio del componente — la decisión de qué color usar vive en el caller, que conoce el contexto (team page = gradient bandera; Home = dynamic; etc.).

### Componentes y archivos afectados

**Crear:**
- `src/theme/themes.ts` — `lightTheme`, `darkTheme`, tipo `Theme`.
- `src/theme/ThemeProvider.tsx` — provider + `useTheme` hook.
- `src/theme/progress.ts` — helper `progressColor(pct, theme)`.
- `src/ui/ThemedBackground.tsx` — reemplazo de `StarryBackground`.

**Modificar:**
- `app/_layout.tsx` — montar `ThemeProvider`, StatusBar dinámico.
- `app/(tabs)/_layout.tsx` — tab bar lee del theme.
- `app/(tabs)/index.tsx` (Home) — `<ThemedBackground>`, `progressColor` para las barras.
- `app/(tabs)/album.tsx` (o el path actual) — idem.
- `app/(tabs)/cambios.tsx` — idem.
- `app/(tabs)/profile.tsx` — idem + Switch de tema.
- `app/(auth)/sign-in.tsx`, `app/(auth)/onboarding.tsx`, `app/onboarding/[step].tsx` — idem.
- `app/sticker/[code].tsx`, `app/friends/...`, `app/add-friend/...`, `app/profile/edit.tsx`, `app/about.tsx` — idem.
- `app.json` — quitar `userInterfaceStyle: "dark"`.
- `package.json` — sumar `@react-native-async-storage/async-storage`.
- `CLAUDE.md` — quitar la línea "La app es dark-only".

**Eliminar:**
- `src/ui/StarryBackground.tsx` — obsoleto, reemplazado por `ThemedBackground`.

**No tocar:**
- `app/team/[code].tsx` — ya tiene su propio sistema de colores por bandera.
- `src/theme/teamColors.ts` — sigue igual.
- `src/theme/colors.ts` — sigue exportando `withAlpha` y la paleta legacy `colors` (la dejamos por ahora; si terminamos eliminando todos sus consumidores, la borramos en un cleanup posterior).

### Fases de implementación

**F1 — Theme baseline (light only)**
1. Crear `themes.ts`, `ThemeProvider.tsx`, `progress.ts`, `ThemedBackground.tsx`.
2. Montar provider en `_layout.tsx`. Sin AsyncStorage todavía — fuerza `"light"`.
3. Reemplazar `StarryBackground` por `ThemedBackground` en cada pantalla.
4. Actualizar tab bar.
5. Aplicar `progressColor` en Home y Álbum.
6. Borrar `StarryBackground.tsx`.
7. Quitar `userInterfaceStyle` de `app.json`.
8. Verificar visualmente.

**F2 — Dark mode + toggle**
1. Instalar `@react-native-async-storage/async-storage`.
2. ThemeProvider lee/escribe AsyncStorage.
3. Switch en Perfil + sección Apariencia.
4. StatusBar dinámico.
5. Verificar light↔dark en device.
6. Actualizar `CLAUDE.md`.

Cada fase es un commit (o tanda de commits) coherente. F1 puede ir a producción sola — la app sale como "light only" mientras F2 se trabaja.

## Trade-offs aceptados

- **Sin tests automatizados**. UI puro, alineado con la convención del repo.
- **No detecta tema del sistema**. Por simplicidad y porque el usuario explícitamente pidió que sea opt-in al dark.
- **`StarryBackground` se borra**. Si en el futuro queremos un "modo nostalgia" con estrellas, lo recreamos. Hoy no aporta y agregar otro tema borgheciría el toggle.
- **AsyncStorage en lugar de SecureStore o SQLite**. La preferencia de tema no es sensible y no requiere queries — AsyncStorage es la opción liviana correcta.
- **`progressColor` interpola en RGB lineal** (no HSL). Lineal es lo bastante bueno visualmente para esta paleta y es trivial de implementar; HSL agregaría una conversión que no aporta percepción mejor en este rango.
- **Status bar legible en dark mode con bgs muy claros (POL/JPN/KOR team pages)** ya estaba como issue conocido; este cambio no lo arregla. Las team pages siguen forzando su propia bg, así que el status bar puede quedar gris-en-blanco para esos 3 equipos. Patcheable más adelante con `<StatusBar>` por pantalla.
