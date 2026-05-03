# Theming completo de la página de equipo

**Fecha**: 2026-05-03
**Estado**: Aprobado
**Alcance**: `app/team/[code].tsx`, `src/ui/ProgressBar.tsx`

## Problema

La página de equipo (`app/team/[code].tsx`) sólo tiñe el header con el `primary` de la bandera (gradient `primary → #000`). El resto de la pantalla — escudo, plantel, lista de jugadores, badges, fondo — sigue usando la paleta púrpura/azul global de la app, así que la "identidad" del equipo no se sostiene más allá del hero.

Adicionalmente, las filas de jugadores y las cards de escudo/plantel muestran `#{number}` (ej. `#10`), pero la forma en que el usuario referencia un sticker en el álbum físico es por su código (ej. `MEX-12`).

## Objetivo

1. Que la página de un equipo se sienta toda con los colores de su bandera, sin sacrificar la cohesión visual del resto de la app.
2. Que cada sticker muestre su código (`MEX-12`) en vez de su número impreso (`#10`).

## No-objetivo

- Tocar el theming del resto de la app (Home, Álbum, Cambios, Perfil) — siguen con la paleta actual.
- Cambiar el dataset de stickers o el shape de `TeamColors`.
- Resolver casos extremos de contraste agregando lógica adaptativa por luminancia. Si un equipo se ve raro, se itera puntualmente.

## Diseño

### Estrategia de color: primary domina, accent decora

`primary` siempre tiene un `text` field garantizado para contraste, así que es seguro usarlo como fondo en zonas grandes. `accent` (que en muchas banderas es blanco, amarillo claro o un color secundario) se reserva para detalles chicos donde un quiebre de color refuerza la identidad sin riesgos serios de legibilidad.

**Header**: sin cambios. Ya usa `LinearGradient([primary, "#000"])` con `colors.text` para tipografía.

**Fondo del body**: overlay sutil de `primary` al 10% opacidad por debajo del contenido pero sobre el `StarryBackground`. Las estrellas siguen visibles, la página "absorbe" el color del equipo sin volverse plana.

**Cards de escudo/plantel (`SpecialCard`)**:
- **Pegada**: `bg = primary`, texto en `colors.text`.
- **Falta**: `bg = primary` con 12% opacidad, `border = primary` con 35% opacidad, texto en `colors.text` con 70% opacidad.

**Filas de jugador (`PlayerRow`)**:
- **Pegada**: `bg = primary`, texto en `colors.text`.
- **Falta**: `bg = primary` con 10% opacidad, `border = primary` con 30% opacidad, texto en `colors.text` con 65% opacidad.

**Label "JUGADORES (N)"**: cambia de `text-space-mute` (púrpura mute global) a `colors.accent`. Es decoración chica donde un quiebre de color funciona bien.

**Badge `×N` (repetidas)**:
- Hoy: fondo fijo `#3b82f6`.
- Nuevo: `bg = colors.accent`, texto en `colors.text`. La mayoría de las banderas son visualmente coherentes con esta combinación; los casos raros se iteran después.

**Check ✓ (pegada, count = 1)**: usa `colors.accent` para destacar sobre el `primary` de fondo de la fila.

**`ProgressBar`**: hoy hardcodea el gradient `#7c5cff → #3b82f6`. Se extiende con props opcionales:

```ts
export function ProgressBar({
  pct,
  height = 8,
  from = "#7c5cff",
  to = "#3b82f6",
}: { pct: number; height?: number; from?: string; to?: string })
```

La página de equipo pasa `from = colors.primary, to = colors.accent`. Home (los otros 2 callsites en `app/(tabs)/index.tsx`) no pasa nada y mantiene el gradient actual.

### Código en lugar de número

El campo `code` ya existe en cada `Sticker` (`MEX-12`, `FWC-1`, `CC1`, etc.).

- `SpecialCard`: `#{s.number} · {label}` → `{s.code} · {label}` → ej. `MEX-1 · ESCUDO`.
- `PlayerRow`: `#{s.number}` → `{s.code}` → ej. `MEX-12`.

## Componentes y archivos afectados

- `src/ui/ProgressBar.tsx` — agregar props `from`/`to` opcionales con los defaults actuales como fallback. Verificar que los 2 callsites en `app/(tabs)/index.tsx` siguen pasando los mismos args.
- `app/team/[code].tsx`:
  - Wrap del body con un `View` que aplique `backgroundColor: primary` con 10% opacidad (overlay encima del `StarryBackground`).
  - `SpecialCard`: nuevos backgrounds, bordes y colores de texto. Recibe `primary` y `text` como props (en vez de sólo `accent`).
  - `PlayerRow`: idem `SpecialCard` — pasa `primary` + `text` + `accent`.
  - Label "JUGADORES" usa `colors.accent`.
  - Badge `×N` usa `colors.accent` + `colors.text`.
  - Check `✓` usa `colors.accent`.
  - Reemplazar `#{s.number}` por `{s.code}` en ambos componentes.
  - `<ProgressBar from={colors.primary} to={colors.accent} />`.

## Casos a verificar manualmente

Equipos que cubren la diversidad de combinaciones:

- **ARG** — primary azul claro, accent blanco, text navy → caso "accent blanco".
- **BRA** — primary amarillo, accent verde, text navy → caso "primary claro con texto oscuro".
- **USA** — primary navy, accent rojo, text blanco → caso "alto contraste".
- **MEX** — primary verde, accent rojo, text blanco → caso "tricolor clásico".
- **ENG** — primary rojo, accent blanco, text blanco → caso "accent blanco con text blanco" (¿badge `×N` blanco con texto blanco? evaluar y, si hace falta, ajustar el equipo).
- **POL** — primary blanco, accent rojo, text navy → caso borde "primary blanco" (header semitransparente sobre starry, hay que verificar que la jerarquía visual se mantenga).

## Tests

Cambios puramente presentacionales — no se agregan tests automatizados. La verificación es manual con la lista de equipos de arriba en device físico.

## Trade-offs aceptados

- **Páginas con `primary` parecidos se sentirán similares** (varios rojos: CRO, CHI, PER, TUN, TUR, ENG…). El header con gradient hacia negro y los acentos secundarios ayudan, pero no es un objetivo distinguir equipos del mismo color de bandera.
- **Caso `accent` blanco + `text` blanco** (ENG, NGA, etc.): el badge `×N` puede quedar invisible. Si pasa, se patchea por equipo (override en `teamColors.ts` o ajuste del badge específico). No vale la pena lógica adaptativa por luminancia para 2-3 casos.
- **`POL` con primary blanco**: el header ya estaba así antes del cambio. El overlay del 10% sobre el body queda muy sutil. Aceptable.
