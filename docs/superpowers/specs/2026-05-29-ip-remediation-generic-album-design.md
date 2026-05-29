# Remediación IP — Reframe a "álbum de cromos genérico"

**Fecha:** 2026-05-29
**Contexto:** Rechazo de Apple App Review, Guideline 5.2.1 (Legal - Intellectual Property), submission `1ed87d5b-83bb-4fb2-9de2-7ec0257b75eb`, versión 1.2.0 (6). Apple indica que la app "incluye contenido que se parece a FIFA sin la autorización necesaria" y ofrece dos salidas: (a) adjuntar autorización de FIFA + contacto, o (b) remover el contenido de terceros. Tomamos la opción (b).

## Objetivo

Despegar la app del producto oficial sin reescribirla: eliminar los rastros que un revisor asocia con "FIFA World Cup" (códigos `FWC-*`, conteo exacto del álbum oficial, metadata de tienda), reframeando la app como un tracker de álbum de cromos genérico. El dataset de equipos/grupos se mantiene (las selecciones de fútbol y sus códigos de país no son IP de FIFA).

## Estrategia elegida

"Genérico real" (entre: limpieza mínima / genérico real / álbum personalizable). Balance entre máxima probabilidad de aprobación y esfuerzo acotado.

## Cambios

### A. Dataset y códigos visibles

Fuente de verdad: `scripts/gen-stickers.js` → regenera `assets/stickers.json`.

Renombrado de códigos (el código del cromo se renderiza en la UI — `app/sticker/[code].tsx:29`, `src/ui/album/StickerBolita.tsx:93/119`):

| Sección  | Códigos actuales        | Códigos nuevos   |
|----------|-------------------------|------------------|
| Intro    | `0-0`, `FWC-1..FWC-8`   | `INT-1..INT-9`   |
| Extras   | `FWC-9..FWC-19`         | `EXT-1..EXT-11`  |
| Estrellas| `CC1..CC14`             | `STR-1..STR-14`  |
| Equipos  | `ARG-1`, `MEX-1`, …     | **sin cambios**  |

- `FWC` = "FIFA World Cup": es el rastro más directo y visible. Su eliminación es el cambio de mayor impacto.
- Los códigos de equipo (códigos de país tipo ISO/FIFA) se mantienen: nombres y códigos de países no son propiedad de FIFA.
- Bump de `version` en el generador (9 → 10) para disparar el re-seed automático al boot.
- Limpiar comentarios del generador que mencionan "álbum del Mundial" y "FWC históricos".

### B. Migración de progreso

**Sin migración.** Se aprovecha el re-seed por bump de versión que ya existe (`src/data/…` re-siembra `stickers` sin tocar `sticker_status`). Consecuencia aceptada pre-launch (TestFlight, pocos/ningún tester):

- Las ~34 láminas especiales (intro + extras + estrellas) que cambian de código arrancan en 0; sus filas viejas de `sticker_status` quedan huérfanas (no se muestran).
- Los 960 cromos de equipo (`ARG-1`, etc.) no cambian de código y conservan progreso.

No se escribe código de migración local ni SQL remoto.

### C. Strings user-facing

- `src/i18n/strings.ts:39` (`onb1_body`): reemplazar "las **994** láminas de tu álbum" por una redacción genérica sin el conteo exacto del producto oficial (ej. "todas las láminas de tu álbum"). Elimina el mapeo 1:1 al conteo oficial.
- Comentarios internos que mencionan `n=1..994` (`src/domain/albumOrder.ts:17`, `src/domain/progress.ts:47`): neutralizar (no user-facing, bajo costo).

### D. App Store Connect (fuera del repo — entregables de copy)

No se edita desde el repo; se entrega al usuario para aplicar en ASC:

1. **Respuesta a Apple** (en el hilo de App Review): confirmar que se removió el contenido de terceros; no se solicita autorización de FIFA.
2. **Revisión de descripción / subtítulo / keywords**: cero "FIFA", "Mundial", "World Cup", "Panini", "2026". Reframe a "tracker de álbum de cromos / organizá tu colección e intercambiá con amigos".
3. **Screenshots**: las 3 actuales (`assets/play-store/screenshots/01-username`, `02-argentina-team`, `03-home`) son vistas genéricas de álbum — se mantienen.

### E. Tests afectados

Fixtures sintéticos que hardcodean códigos viejos (no dependen del dataset real, pero se actualizan por consistencia):

- `tests/data/bulkSetOwnedForTeam.test.ts` (`FWC-1`)
- `tests/domain/albumOrder.test.ts` (`FWC-1`, `FWC-2`, `CC1`)
- `tests/domain/stats.test.ts` (`FWC-1`, `CC1`, `CC2`)

## Verificación

- `pnpm test` (161 tests) — verde tras actualizar fixtures.
- `pnpm exec tsc --noEmit` — sin errores.
- Verificación manual: el sticker detail y la grilla muestran los nuevos códigos (`INT-*`, `EXT-*`, `STR-*`); ningún `FWC`/`CC` visible.

## Riesgo residual (consciente)

La estructura de 48 equipos en 12 grupos sigue replicando el sorteo real del torneo. Por la estrategia elegida se mantiene. Si Apple vuelve a rechazar bajo 5.2.1, el siguiente paso sería el pivote a "álbum personalizable" (el usuario define su propio álbum; el dataset del torneo pasa a plantilla opcional o se elimina).

## Fuera de alcance

- Migración de progreso de las láminas especiales renombradas.
- Cambios al ícono / splash (no señalados por Apple).
- Pivote a álbum personalizable.
- Renombrado de claves internas de storage (`panini.*`, etc., no user-facing).
