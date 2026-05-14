# Compartir lista — Resumen por equipo con banderas

**Fecha:** 2026-05-13
**Autor:** Oscar Ortega (brainstorm con Claude)
**Tipo:** Feature de producto (UI + dominio)
**Estado:** Diseño aprobado — pendiente plan de implementación

## Contexto

Los amigos del autor mandan listas de cromos que les faltan con este formato en WhatsApp:

```
Me faltan*

KOR 🇰🇷: 5, 11
CZE 🇨🇿: 8
BRA 🇧🇷: 4
PAR 🇵🇾: 5, 19
AUS 🇦🇺: 8
TUR 🇹🇷: 4
CUW 🇨🇼: 10
ECU 🇪🇨: 4, 7, 14, 16, 18
JPN 🇯🇵: 20
FRA 🇫🇷: 3, 8, 12
```

La app ya tiene la lógica de dominio para armar la lista de faltantes/repes (`buildTradeList`) y una función `formatTradeListAsText` que genera texto agrupado por `section` (Intro/Mexico/.../Coca-Cola), pero:

1. El formato actual agrupa por `section`, que para los 48 equipos se traduce a 48 líneas con nombre largo en español (`México: 1, 2, 3`) en lugar del código FIFA con bandera (`MEX 🇲🇽: 1, 2, 3`) que es lo que efectivamente comparten los usuarios.
2. La función está implementada pero **no está conectada a ninguna pantalla** — existe `src/hooks/useMyList.ts` pero ningún componente lo importa.
3. No hay UI para invocar el "Compartir lista" desde la app.

Este diseño cierra esa brecha: nuevo formato + UI para invocarlo + copiar/compartir.

## Objetivos

- Producir un texto compartible que se vea **idéntico** al ejemplo del autor (variante B con título de app + handle).
- Hacerlo accesible desde la pestaña Amigos vía botón flotante (FAB) que abre un modal con preview + acciones Copiar / Compartir.
- Reutilizar `buildTradeList`, reemplazar la función de formato vieja.
- Cero deps nuevas: `expo-clipboard` ya está, `Share.share()` viene de React Native.

## No-objetivos

- No es configuración de qué incluir/excluir (sin toggles). El formato es uno solo.
- No reemplaza el flujo de intercambio peer-to-peer existente (P4 friends/matches). Es texto plano para WhatsApp/Telegram.
- No incluye imagen/screenshot — solo texto.

## Diseño

### 1. Formato del texto (variante B aprobada)

```
stickerSwap · Mundial 2026 — @oscar

Me faltan*
KOR 🇰🇷: 5, 11
CZE 🇨🇿: 8
FRA 🇫🇷: 3, 8, 12
Intro: 2, 5
Coca-Cola: 4

Tengo repes*
ARG 🇦🇷: 6 ×2
ESP 🇪🇸: 9 ×2, 14 ×3
```

**Reglas determinísticas:**

- **Línea 1:** `stickerSwap · Mundial 2026 — @<username>`. Si el usuario no tiene username (`session.user?.username == null`), cae a `stickerSwap · Mundial 2026` (sin guión ni handle).
- **Línea 2:** vacía.
- **Bloque "Me faltan*":**
  - Header literal `Me faltan*` en su propia línea.
  - Luego una línea por equipo con cromos faltantes, en orden alfabético por código FIFA.
  - Formato por línea: `<FIFA> <bandera>: <num1>, <num2>, ...`, números ordenados ascendentemente.
  - Después de los equipos, una línea por cada `section` sin equipo con faltantes (orden fijo: `Intro` → `Extras` → `Coca-Cola`). Formato: `<section>: <num1>, <num2>, ...`. Sin bandera.
  - Equipos/sections sin faltantes se omiten (no se escribe línea vacía).
- **Bloque "Tengo repes*":**
  - Solo se imprime si hay al menos una repe.
  - Header literal `Tengo repes*` precedido por una línea vacía si el bloque "Me faltan*" también se imprimió.
  - Misma lógica de agrupación que faltantes, pero formato por número: `<num> ×<N>` donde `N = count - 1`. Si `N == 1`, se imprime `<num>` solo (sin `×1`). Ejemplo: `9, 14 ×3` significa que tiene 1 repetida del 9 y 3 repetidas del 14.

  **Decisión a confirmar en review:** ¿la línea con solo número (sin `×N`) se prefiere como `9` (omitir `×1`) o siempre `9 ×1`? **Default propuesto: omitir `×1`** porque produce líneas más limpias y los amigos ya entienden que sin `×` significa una repe.
- **Empty state textual:** si no hay faltantes ni repes, devolver el string `"Tu álbum está completo 🎉"` (se renderiza distinto en la UI, ver §3).
- **Sin línea de cierre:** sin "Hablemos por aquí 👋" — el ejemplo del autor no lo tiene.

**Sections sin equipo — labels exactos:** se usan los literales del dataset (`Intro`, `Extras`, `Coca-Cola`). Si en el futuro se cambia el label de `Extras` a `Extras FWC` en `scripts/gen-stickers.js`, el formato lo refleja automáticamente.

### 2. Dominio

#### `src/domain/teamFlags.ts` (nuevo)

```ts
// Mapa estático código FIFA → emoji bandera para los 48 equipos del Mundial 2026.
// Los emojis son secuencias de Regional Indicator Symbols (2 codepoints) que
// renderiza correctamente iOS/Android/desktop sin assets adicionales.
export const FIFA_TO_FLAG: Record<string, string> = {
  ALG: "🇩🇿", ARG: "🇦🇷", AUS: "🇦🇺", AUT: "🇦🇹",
  BEL: "🇧🇪", BIH: "🇧🇦", BRA: "🇧🇷", CAN: "🇨🇦",
  CIV: "🇨🇮", COD: "🇨🇩", COL: "🇨🇴", CPV: "🇨🇻",
  CRO: "🇭🇷", CUW: "🇨🇼", CZE: "🇨🇿", ECU: "🇪🇨",
  EGY: "🇪🇬", ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", ESP: "🇪🇸", FRA: "🇫🇷",
  GER: "🇩🇪", GHA: "🇬🇭", HAI: "🇭🇹", IRN: "🇮🇷",
  IRQ: "🇮🇶", JOR: "🇯🇴", JPN: "🇯🇵", KOR: "🇰🇷",
  KSA: "🇸🇦", MAR: "🇲🇦", MEX: "🇲🇽", NED: "🇳🇱",
  NOR: "🇳🇴", NZL: "🇳🇿", PAN: "🇵🇦", PAR: "🇵🇾",
  POR: "🇵🇹", QAT: "🇶🇦", RSA: "🇿🇦", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  SEN: "🇸🇳", SUI: "🇨🇭", SWE: "🇸🇪", TUN: "🇹🇳",
  TUR: "🇹🇷", URU: "🇺🇾", USA: "🇺🇸", UZB: "🇺🇿"
};

export function flagFor(fifaCode: string | null | undefined): string {
  if (!fifaCode) return "";
  return FIFA_TO_FLAG[fifaCode] ?? "";
}
```

Notas:
- Los 48 códigos coinciden con los del dataset (`assets/stickers.json`) verificados al diseñar.
- ENG e SCO usan secuencias de bandera regional (no son países en ISO 3166-1) — los emojis subtag funcionan en iOS 14+ y Android 11+; en plataformas viejas se ven como bandera blanca, que es aceptable.
- No vivirá dentro de `src/theme/teamColors.ts` porque ese archivo es de presentación visual (colores) y este es semántico (texto plano para copiar). Separación de responsabilidades.

#### `src/domain/tradeList.ts` (modificado)

- **Borrar** `formatTradeListAsText` y la opción `groupBySection` del tipo `TradeFormatOptions`.
- **Agregar** `formatTradeListByTeam(list: TradeList, stickers: Sticker[], opts: { username: string | null }): string`.
- La función necesita `stickers` (no solo `list`) para resolver `code → { team, section, number }`. `TradeListEntry` ya incluye `number` y `section`, pero NO `team` — alternativa: extender `TradeListEntry` con `team: string | null` en `buildTradeList` para no pasar `stickers` por segundo argumento. **Decisión: extender `TradeListEntry`** porque mantiene la función de formato pura sobre la `TradeList`.

Pseudocódigo:

```ts
export function formatTradeListByTeam(
  list: TradeList,
  opts: { username: string | null }
): string {
  if (list.needed.length === 0 && list.duplicates.length === 0) {
    return "Tu álbum está completo 🎉";
  }

  const header = opts.username
    ? `stickerSwap · Mundial 2026 — @${opts.username}`
    : "stickerSwap · Mundial 2026";

  const lines: string[] = [header, ""];

  if (list.needed.length > 0) {
    lines.push("Me faltan*");
    lines.push(...renderBlock(list.needed, "needed"));
  }

  if (list.duplicates.length > 0) {
    if (list.needed.length > 0) lines.push("");
    lines.push("Tengo repes*");
    lines.push(...renderBlock(list.duplicates, "duplicates"));
  }

  return lines.join("\n").trim();
}
```

`renderBlock(entries, mode)` (helper interno, donde `mode` es `"needed" | "duplicates"`):
1. Particiona `entries` en `withTeam` (`team != null`) y `withoutTeam`.
2. Agrupa `withTeam` por código FIFA, ordena los grupos alfabéticamente por FIFA. Dentro de cada grupo ordena `entries` por `number` ascendente.
3. Por cada grupo:
   - `mode === "needed"`: `${fifa} ${flag}: ${entries.map(e => e.number).join(", ")}`.
   - `mode === "duplicates"`: por cada entry, `extras = e.count - 1`; texto del item = `extras > 1 ? \`${e.number} ×${extras}\` : \`${e.number}\``. Luego `${fifa} ${flag}: ${items.join(", ")}`.
4. Agrupa `withoutTeam` por `section`, en orden fijo `["Intro", "Extras", "Coca-Cola"]`. Misma lógica de impresión que arriba pero sin bandera: `${section}: ${items...}`.

### 3. UI

#### `src/ui/ShareListFab.tsx` (nuevo)

Botón flotante posicionado con `position: "absolute", bottom: 100, right: 16` (encima del tab bar de ~80px).

- Visual: pill con `theme.accent` de fondo, icono `↗` + texto `Compartir lista` en `theme.bg`.
- Sombra leve para flotar visualmente.
- `Pressable` con haptic light al tap.
- Estado controlado: prop `onPress: () => void`.

#### `src/ui/ShareListModal.tsx` (nuevo)

Modal `presentation: "modal"` (full-screen en iOS, full-screen en Android), con:

- **Header:** título `Mi lista para compartir` + `Pressable` cerrar (X) a la derecha. Padding top respetando safe area.
- **Cuerpo (ScrollView):**
  - Card temable (cream en tema claro, espresso en tema oscuro) con padding generoso.
  - `<Text selectable={true}>` con el texto formateado. Fuente monoespaciada (`fontFamily: "Menlo"` iOS / `"monospace"` Android) para alinear columnas visualmente.
  - Si el texto es el empty state (`"Tu álbum está completo 🎉"`), se centra y se agranda — sin botones de acción.
- **Footer fijo (no scrollea):**
  - Dos `PrimaryButton` lado a lado: `Copiar` y `Compartir`.
  - `Copiar`: `Clipboard.setStringAsync(text)` + haptic success + `Snackbar` "Copiado ✓" (componente ya existe en `src/ui/Snackbar.tsx`).
  - `Compartir`: `Share.share({ message: text })`. En Android `message` es lo que se envía; en iOS también funciona como texto compartible al mail/WhatsApp/Notes/etc.

Props:
```ts
type Props = {
  visible: boolean;
  onClose: () => void;
  text: string;
};
```

#### `app/(tabs)/friends.tsx` (modificado)

Cambios mínimos:
- Importar `ShareListFab` y `ShareListModal`.
- Estado local `const [shareOpen, setShareOpen] = useState(false)`.
- Estado local `text` viene de `useShareList()` (ver §4).
- Renderizar `<ShareListFab onPress={() => setShareOpen(true)} />` fuera del `<ScrollView>` pero dentro del `<ThemedBackground>` (para que floate sobre el contenido).
- Renderizar `<ShareListModal visible={shareOpen} onClose={() => setShareOpen(false)} text={text} />`.

El FAB queda visible en las 3 subtabs (Amigos/Trueques/Cerca) porque está en el componente raíz, no en cada subview.

### 4. Hooks

#### `src/hooks/useShareList.ts` (nuevo)

Reemplaza al `useMyList` viejo (que se borra). Wrapper sobre `useQuery` que:

1. Lee todos los stickers + statuses (idéntico al `useMyList` actual).
2. Llama `buildTradeList(stickers, statuses)` (ya extendido para incluir `team`).
3. Llama `formatTradeListByTeam(list, { username: session.user?.username ?? null })`.
4. Devuelve `{ text, isLoading, error }`.

```ts
export function useShareList() {
  const session = useSession();
  const query = useQuery({
    queryKey: ["shareList"],
    queryFn: async () => {
      const [stickers, statuses] = await Promise.all([getAllStickers(), listStatuses()]);
      return buildTradeList(stickers, statuses);
    }
  });
  const text = query.data
    ? formatTradeListByTeam(query.data, { username: session.user?.username ?? null })
    : "";
  return { ...query, text };
}
```

### 5. Testing

**Unit tests (Jest, en `tests/domain/`):**

- `teamFlags.test.ts` (nuevo):
  - Cada código FIFA del dataset (`stickers.json`, filtrar `team != null`) tiene un emoji en `FIFA_TO_FLAG`.
  - Cantidad = 48.
  - `flagFor("ARG")` retorna emoji argentino; `flagFor("XYZ")` y `flagFor(null)` retornan `""`.

- `tradeList.test.ts` (extender, borrar tests de `formatTradeListAsText`):
  - Album vacío de progreso → empty state `"Tu álbum está completo 🎉"` (caso límite: todos los stickers tienen count==1 exacto).
  - Solo faltantes → no aparece bloque `Tengo repes*`.
  - Solo repes → no aparece bloque `Me faltan*`, pero sí header de app.
  - Mezcla equipos + sections sin equipo → orden correcto: equipos alfabéticos, luego Intro → Extras → Coca-Cola.
  - Repes con count 2 (`×1`) imprime `<num>` sin `×N`; count 3 (`×2`) imprime `<num> ×2`.
  - Sin username → header sin handle ni guión.
  - Equipo sin faltantes pero con repes → solo aparece en el bloque de repes, no en faltantes.

**No se testea UI** (FAB, Modal) — convención del proyecto.

**Snapshot del formato:** un test golden que arme un fixture realista y compare contra la string esperada, ancla el formato exacto.

### 6. Migración del código existente

Pasos secuenciales:

1. Extender `TradeListEntry` en `src/domain/types.ts` agregando `team: string | null`. Actualizar `buildTradeList` en `src/domain/tradeList.ts` para poblar el campo a partir del sticker (la firma `(stickers, statuses) => TradeList` queda igual).
2. Crear `src/domain/teamFlags.ts` con el mapa.
3. Crear `formatTradeListByTeam` en `src/domain/tradeList.ts`.
4. Borrar `formatTradeListAsText`, `TradeFormatOptions`, y la opción `groupBySection`.
5. Borrar `src/store/tradePreferences.ts` (sin consumidores tras paso 4).
6. Borrar `src/hooks/useMyList.ts`. Crear `src/hooks/useShareList.ts`.
7. Crear `src/ui/ShareListFab.tsx` y `src/ui/ShareListModal.tsx`.
8. Modificar `app/(tabs)/friends.tsx` para montar FAB + Modal.
9. Actualizar/escribir tests; correr `pnpm test` y `pnpm exec tsc --noEmit`.

## Riesgos y mitigaciones

- **Banderas no renderizan en algún device viejo:** los emojis de regional indicators funcionan en iOS 14+ y Android 11+ (Expo SDK 54 ya requiere mínimos similares). ENG/SCO usan tag sequences que pueden fallar — fallback es bandera blanca, aceptable.
- **Tamaño del texto compartido en WhatsApp:** lista de 994 stickers ⇒ peor caso ~50 líneas; bien por debajo de cualquier límite.
- **`Share.share()` en simulador iOS sin apps:** funciona en device físico; en simulador muestra solo opciones limitadas. No bloqueante.
- **FAB superpuesto al contenido importante:** el `padding-bottom: 32` actual del ScrollView se sube a `120` para que las últimas filas no queden tapadas por el FAB.

## Decisiones abiertas (a confirmar en review del spec)

1. **¿Bloques sin equipo usan literales del dataset (`Intro`, `Extras`, `Coca-Cola`) o labels custom (`Intro`, `Extras FWC`, `Coca-Cola`)?**
   - **Default propuesto:** literales del dataset.
2. **¿Repes con count 2 (1 sola repetida) se imprimen como `9` (sin `×1`) o `9 ×1`?**
   - **Default propuesto:** sin `×1`.
3. **¿FAB visible en las 3 subtabs o solo en "Amigos"?**
   - **Default propuesto:** las 3.
