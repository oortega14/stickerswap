# Bulk-mark + modo destildar en página de equipo

**Fecha**: 2026-05-08
**Estado**: Aprobado
**Alcance**: `app/team/[code].tsx`, `src/data/stickerStatus.ts`, `src/hooks/useStickers.ts`, nuevo `src/ui/DestildarBanner.tsx`

## Problema

El flujo actual para marcar el progreso del álbum es uno-cromo-uno-tap. Funciona bien si arrancás de cero junto con el álbum físico, pero es prohibitivo para alguien que se descarga la app cuando ya tiene el álbum 67% pegado: tendría que tocar ~666 cromos individualmente para reconciliar lo que ya tiene físicamente. La página de equipo (`app/team/[code].tsx`) muestra los 20 cromos del equipo en grid o lista, pero no ofrece ningún atajo para "ya tengo prácticamente todo este equipo".

## Goal

Permitir reconciliación rápida del progreso por equipo: un tap del usuario marca todo el equipo como pegado, y a partir de ese estado el usuario destilda únicamente los pocos cromos que sí le faltan.

## Decisiones de UX

### Acción: "Pegar equipo entero"

Botón nuevo en el header de la página de equipo, justo debajo de la progress bar. Texto: **"Pegar equipo entero"** + icono ✓.

- **Siempre disponible**, no se oculta cuando el equipo ya tiene cromos marcados — el usuario podría haber empezado a marcar a mano y querer rematar de un golpe.
- **No-destructivo**: solo afecta cromos con `count = 0` (o sin row). Los que ya tienen `count >= 1` quedan intactos para preservar duplicados que el usuario ya cargó.
- **Sin confirmación previa**: la acción es reversible (long-press destilda) y no destruye datos.

### Modo destildar (transitorio)

Inmediatamente después del bulk, la página entra en "modo destildar" automáticamente. El usuario no elige entrar — entra como parte natural del workflow.

- **Banner sticky** debajo del header de navegación: `Tocá las que te falten · [Listo]`
- **Tap simple en card** = `decrementStatus(code)` (`count - 1`, piso en 0).
- **Long-press en card** = `incrementStatus(code)` (revertir un destildado accidental).
- **Salida**:
  - Tap "Listo" → modo termina, taps vuelven al comportamiento normal (`tap = +1`, `long = -1`).
  - Navegar fuera (back) → state local muere con el componente, no persiste.
- **No persistente entre sesiones** ni entre visitas al mismo equipo: es un modo transitorio asociado a la acción "acabo de bulk-marcar y quiero ajustar".

## Cambios técnicos

### 1. `src/data/stickerStatus.ts` — nueva función

```ts
export async function bulkSetOwnedForTeam(teamCode: string): Promise<number>
```

- Una transacción SQLite:
  1. `SELECT s.code FROM stickers s LEFT JOIN sticker_status ss ON ss.sticker_code = s.code WHERE s.team = ? AND (ss.count IS NULL OR ss.count = 0)`
  2. Para cada code resultante: `INSERT INTO sticker_status (sticker_code, count, updated_at) VALUES (?, 1, ?) ON CONFLICT(sticker_code) DO UPDATE SET count = 1, updated_at = excluded.updated_at`
  3. Para cada code: `enqueue(code, 1)` al `sync_queue`.
- Devuelve la cantidad de cromos afectados (para feedback opcional).
- **Single transaction** para garantizar atomicidad: o todo el bulk se aplica, o nada (en caso de error mid-flight).

### 2. `src/hooks/useStickers.ts` — nuevo hook

```ts
export function useBulkMarkTeam()
```

- TanStack Query mutation que llama `bulkSetOwnedForTeam`.
- En `onSuccess`: invalida queries `['stickers']`, `['team', teamCode]`, `['progress']` para que home, álbum y team page reflejen el nuevo estado.

### 3. `app/team/[code].tsx` — UI

- **Estado local** `const [destildarMode, setDestildarMode] = useState(false)`.
- **Botón "Pegar equipo entero"** en el header, debajo de la progress bar (línea ~113 actualmente). Estilo: pill grande con icono ✓ y texto, color del equipo (`tint`).
- **Handler del botón**: `bulkMark.mutate(teamCode)` y al success `setDestildarMode(true)`.
- **Banner**: render condicional `{destildarMode && <DestildarBanner onDone={() => setDestildarMode(false)} />}`.
- **Tap/long en cards**: cuando `destildarMode === true`, `onTap` llama `dec.mutate(code)` y `onLong` llama `inc.mutate(code)`. Cuando false, comportamiento actual (tap=inc, long=dec).
- **Cleanup**: nada explícito — el state vive en el componente y se limpia al desmontar.

### 4. `src/ui/DestildarBanner.tsx` — componente nuevo

- Banner sticky con fondo destacado (no rojo/destructivo, mejor un acento neutral o el color del equipo con baja opacidad).
- Texto: "Tocá las que te falten" + botón "Listo".
- Posicionado debajo del header de navegación, encima del contenido scrollable.

## Edge cases

| Caso | Comportamiento |
|---|---|
| Equipo ya 100% completo (todos count >= 1) | Bulk no escribe nada. Modo destildar se activa igual (puede usarse para destildar). |
| Cromos con count > 1 (duplicados) | No se tocan. La función bulk solo lleva 0 → 1, nunca >=1 → otro valor. |
| Offline | Bulk escribe en local y encola en sync_queue. Drain cuando vuelva online (worker ya existente). |
| Navegar fuera (back) durante destildar | State local muere con el componente. Cromos ya destildados quedan persistidos. No hay "rollback" del bulk. |
| Tap en sticker con count=0 en modo destildar | `decrementStatus` ya tiene piso 0, no escribe (no-op). |
| Re-entrar al equipo después de salir | Modo destildar arranca en false (no persiste). El usuario puede volver a tocar el botón si quiere. |

## Out of scope

- Bulk para secciones non-team (Intro, FWC Extras, Coca-Cola Extras).
- Bulk global cross-team ("marcar TODO el álbum como pegado").
- Multi-select estilo iOS (long-press → checkbox mode con bulk actions).
- Confirmación previa al bulk (no es destructivo, easy revertir).
- Undo dedicado del bulk (no necesario — el usuario puede destildar manualmente).

## Tests

### Unit — `bulkSetOwnedForTeam`

- Mix de count=0 y count>=1 → solo afecta los 0; los >=1 quedan iguales (preserva duplicados).
- Todos count=0 → todos pasan a 1; función devuelve N (= total cromos del equipo).
- Todos count>=1 → ninguno cambia; función devuelve 0.
- Sync queue: exactamente N entries nuevos (= cromos afectados), con count=1.

### Integration — `app/team/[code].tsx`

- Render team page con cromos mixtos → tap "Pegar equipo entero" → todos los faltantes ahora muestran como pegados; duplicados intactos.
- Después del bulk, banner "Tocá las que te falten" visible.
- Tap en card durante destildar mode → count baja a 0 (visualmente cambia a "falta").
- Long-press en card durante destildar mode → count sube (revertir).
- Tap "Listo" → banner desaparece; tap subsiguiente vuelve a `+1`.
- Navegar back → vuelve a home con progreso del equipo actualizado.

## Notas de implementación

- El bulk debe ser una sola transacción SQLite para atomicidad — si falla a mitad, se rollback.
- La invalidación de queries TanStack debe disparar también el refresh de progress en home (la barra de progreso global y per-section se actualiza).
- Visualmente el banner debe contrastar lo suficiente para que el usuario no olvide que está en modo destildar — pero no tan agresivo como un banner de error.
