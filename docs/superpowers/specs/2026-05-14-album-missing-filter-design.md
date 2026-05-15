# Filtro "Me faltan" en /album/[id]

**Estado:** Aprobado (brainstorm)
**Fecha:** 2026-05-14
**Alcance:** Sólo la vista `AlbumScroll` (`/album/[id]`).

## Contexto

`AlbumScroll` (`src/ui/AlbumScroll.tsx`) muestra todas las secciones del álbum en un scroll continuo agrupado por equipo/sección, con stickers en filas de 3 (`STICKERS_PER_ROW = 3`). Cada sticker tiene `count`: `0` significa "falta", `>=1` significa "pegado".

Hoy se ven siempre los 994 stickers. El usuario quiere poder filtrar la vista a "lo que me falta" para enfocarse en lo pendiente sin perder el contexto de qué equipo es cada figurita.

## Objetivo

Agregar un toggle local que filtre la grilla a sólo stickers con `count === 0`, manteniendo la agrupación por equipo y un avisador "¡Completo!" para los equipos al 100%, con un FAB inferior para volver a la vista completa.

## Comportamiento

### Estados

- **Filtro off (default):** la vista funciona exactamente como hoy.
- **Filtro on:** la grilla de cada sección se filtra a stickers con `count === 0`. Las secciones que quedan sin stickers (equipo al 100%) muestran su header normalmente y, en lugar de filas, una tarjeta "¡Completo!".

### Persistencia

El filtro **no** persiste entre entradas a la vista. Es estado del componente (`useState`), arranca en `false` cada vez que se monta `AlbumScroll`. No se guarda en AsyncStorage ni en zustand.

### Tap sobre figurita con filtro on

Al tocar una figurita que faltaba (count 0 → 1), la mutación `incrementStatus` invalida la query y el sticker desaparece de la grilla en el siguiente render. Si era el último de la sección, el equipo pasa a estado "¡Completo!".

### Coexistencia con bulk mark

El botón "✓ Pegar equipo entero" en cada `SectionHeader` sigue funcionando. Con el filtro on, al ejecutarlo, todo el equipo pasa a 100% y su grilla se reemplaza por la tarjeta "¡Completo!" en el siguiente render.

### Contadores y progreso

Los contadores del header (`collected/total`, `pct`, barra de progreso) reflejan el **estado real** del equipo, no el filtrado. El filtro afecta sólo la grilla de stickers.

## Controles visuales

### Chip "Me faltan" (activación)

Pill compacto fijo en el header de la vista, posicionado absoluto arriba a la derecha (espejo del botón ‹ de volver, que vive arriba a la izquierda).

- Posición: `top: insets.top + 12, right: 16, zIndex: 20`.
- Estado **off:** fondo `theme.card`, borde `theme.border` 1px, texto `theme.text`.
- Estado **on:** fondo `theme.accent`, sin borde, texto `#fff`. Indica que está activo.
- Label: `Me faltan` con un punto/ícono opcional al lado izquierdo.
- Toque alterna el estado.

### FAB "Mostrar todos"

Pill flotante inferior, mismo lenguaje visual que el FAB "Volver arriba" actual.

- Sólo aparece cuando `onlyMissing === true`.
- Posición:
  - Si "Volver arriba" no está visible: `bottom: insets.bottom + 16`.
  - Si "Volver arriba" sí está visible: `bottom: insets.bottom + 72` (queda apilado arriba del de volver-arriba).
- Estilo: `backgroundColor: theme.card`, borde `theme.border`, sombra como hoy, texto "Mostrar todos".

### Tarjeta "¡Completo!" (para equipos al 100% bajo filtro)

Reemplaza la grilla del equipo cuando éste no tiene stickers faltantes.

- Bloque centrado con padding generoso (similar a un row).
- Texto: "¡Completo!" en grande, color `tint` del equipo (mismo helper `pickTint`).
- Subtexto: `{total} láminas pegadas` en `theme.textMute`.
- Sin íconos extra. Visual sobrio.

## Arquitectura

### Archivo afectado

Todo se contiene en `src/ui/AlbumScroll.tsx`. No se tocan hooks, datos, dataset, ni stores.

### Cambios en tipos

```ts
type Row =
  | { kind: "header"; section: AlbumSection<StickerWithStatus> }
  | { kind: "completedNotice"; section: AlbumSection<StickerWithStatus> }   // nuevo
  | {
      kind: "stickerRow";
      section: AlbumSection<StickerWithStatus>;
      stickers: StickerWithStatus[];
      rowIndex: number;
    };
```

### Cambios en `AlbumScroll`

- Nuevo `const [onlyMissing, setOnlyMissing] = useState(false)`.
- El `useMemo` que construye `rows` toma `onlyMissing` como dependencia. Algoritmo:
  ```
  for each section in data:
    push header
    visibleStickers = onlyMissing ? section.stickers.filter(s => s.count === 0) : section.stickers
    if onlyMissing && visibleStickers.length === 0:
      push completedNotice
    else:
      chunk visibleStickers en filas de 3, push cada stickerRow
  ```
- `headerIndices` se recalcula con la misma lógica (sigue mapeando `section.id` a la posición del header en `rows`); deep-link `/album/MEX` sigue funcionando.
- `getItemType` retorna `"header" | "completedNotice" | "stickerRow"` para que FlashList recicle por tipo.
- `renderItem` agrega el caso `completedNotice`.

### Nuevos sub-componentes (mismo archivo)

- `MissingFilterChip({ active, onToggle })` — el chip pill arriba a la derecha.
- `CompletedNotice({ section })` — la tarjeta "¡Completo!".
- `ShowAllFab({ onPress, raised })` — el FAB inferior; `raised` agrega el offset cuando coexiste con "Volver arriba".

## Edge cases

- **Álbum completo al 100%:** todas las secciones muestran header + "¡Completo!". El FAB "Mostrar todos" se ve. Es válido.
- **Nada pegado:** filtro on muestra exactamente lo mismo que filtro off. El chip queda en estado activo sin efecto visible. No es un bug.
- **Filtro on + tap individual + sólo quedaba uno faltando del equipo:** el equipo transiciona a 100% en el próximo render → su grilla se reemplaza por "¡Completo!".
- **Deep-link a sección completa bajo filtro on:** como el filtro arranca en off al montar, este caso no se da en arranque. Si se llega activando el filtro después de scrollear, el header del equipo destino sigue donde estaba; el scroll se mantiene en su posición y el usuario ve "¡Completo!" para esa sección.
- **Bulk mark en curso:** el `bulkMark.isPending` se sigue mostrando en el header del equipo correspondiente. No interfiere con el filtro.

## Fuera de scope

- Persistencia del filtro entre sesiones o entre navegaciones.
- Filtros adicionales ("solo repes", "solo grupo X", "solo extras", etc.).
- Animaciones de entrada/salida de stickers cuando el filtro cambia (transición inmediata, sin layout animation).
- Aplicar este filtro al Home tab (`app/(tabs)/index.tsx`); la vista de tarjetas por equipo no se toca.
- Tests automatizados nuevos: la lógica es de UI y filtrado trivial. Verificación manual con los casos de la sección "Edge cases".

## Verificación manual

1. Entrar al álbum desde Home → filtro off, vista normal.
2. Tocar chip "Me faltan" → cambia a estado activo, FAB inferior aparece.
3. Scrollear hasta un equipo completo → header visible con tarjeta "¡Completo!".
4. Scrollear hasta un equipo con faltantes → grilla muestra sólo los que faltan, contador del header muestra el total real (no filtrado).
5. Tap en una figurita faltante → desaparece de la grilla; si era la última del equipo, aparece "¡Completo!".
6. Bulk mark "Pegar equipo entero" con filtro on → grilla del equipo se reemplaza por "¡Completo!".
7. Tocar FAB "Mostrar todos" → filtro off, chip vuelve a estado neutro, FAB desaparece, grilla restaurada.
8. Salir del álbum y volver → filtro arranca en off.
9. Scrollear hacia abajo en un equipo con filtro on → "Volver arriba" aparece debajo del FAB "Mostrar todos".
