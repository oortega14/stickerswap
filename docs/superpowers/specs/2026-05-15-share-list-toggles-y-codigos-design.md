# Compartir lista: toggles faltantes/repes + códigos en vez de números

**Fecha:** 2026-05-15
**Estado:** Aprobado, listo para implementación

## Contexto

El FAB "Compartir mi lista" en la subtab Amigos (`app/(tabs)/friends.tsx`) abre `ShareListModal`, que muestra un texto generado por `formatTradeListByTeam` (`src/domain/tradeList.ts`) con dos bloques fijos: **"Me faltan*"** y **"Tengo repes*"**. Cada item del bloque sale como número impreso de la lámina (`1, 4, 17` para faltantes, `5 ×2` para repes).

Problemas que resolvemos:

1. **Ambigüedad de identificación.** El número solo se entiende cuando aparece bajo el encabezado de equipo (`ARG 🇦🇷: 1, 4, 17`). Si alguien copia y reformatea el texto, "1" pierde el contexto. Usar el código completo (`ARG-1`) lo hace inequívoco.
2. **Falta de control.** A veces el usuario quiere mandarle a un amigo solo lo que le falta, o solo sus repetidas, sin tener que editar el texto manualmente.

## Objetivos

- Mostrar cada cromo por su `code` (`ARG-1`, `FWC-12`, `CC3`, `0-0`) en el texto compartido, en vez del `number` impreso.
- Permitir al usuario togglear independientemente las secciones "Me faltan" y "Tengo repes" dentro del modal antes de copiar/compartir.

## No-objetivos

- No agregamos filtros por equipo, sección, o tipo de cromo.
- No cambia el contenido del texto cuando el álbum está completo.
- No persistimos el estado de los toggles entre aperturas del modal.
- No cambia la ubicación, ícono o lógica del FAB.
- No cambia el caching ni la query (`useShareList`) sigue siendo `["shareList"]`.

## Cambios de comportamiento

### 1. Formato por código

`formatItem` deja de usar `e.number` y pasa a usar `e.code`. El agrupado por equipo y por sección no-equipo se mantiene.

Antes:
```
Me faltan*
ARG 🇦🇷: 1, 4, 17
Intro: 1, 3
Coca-Cola: 1, 5

Tengo repes*
ARG 🇦🇷: 7 ×2, 15 ×1
```

Después:
```
Me faltan*
ARG 🇦🇷: ARG-1, ARG-4, ARG-17
Intro: 0-0, FWC-2
Coca-Cola: CC1, CC5

Tengo repes*
ARG 🇦🇷: ARG-7 ×2, ARG-15 ×1
```

El orden dentro de cada grupo sigue siendo por `number` ascendente (no cambia).

### 2. Toggles faltantes/repes

Dentro del modal, debajo del título "Mi lista para compartir" y arriba del `ScrollView`, aparecen dos chips toggleables:

- **Me faltan** — activo por defecto al abrir el modal.
- **Tengo repes** — activo por defecto al abrir el modal.

Cada chip:
- Tap → flip booleano local + `haptics.light()`.
- Estado activo: estilo igual al chip activo de `SegmentedControl` (`backgroundColor: theme.accent`, texto blanco).
- Estado inactivo: `backgroundColor: theme.card`, borde `theme.border`, texto `theme.textMute`.
- `accessibilityRole="button"`, `accessibilityState={{ selected: isActive }}`, `accessibilityLabel` describe qué togglea.

Estados resultantes:

| `showNeeded` | `showDuplicates` | Texto mostrado |
|---|---|---|
| true | true | Ambos bloques (comportamiento actual). |
| true | false | Solo "Me faltan*" + items. |
| false | true | Solo "Tengo repes*" + items. |
| false | false | Hint "Activá al menos una sección" en el área de texto. Botones Copiar/Compartir deshabilitados. |

El estado se reinicia a `{ true, true }` cada vez que se abre el modal (no persiste).

**Empty state especial:** si `list.needed.length === 0 && list.duplicates.length === 0` (álbum completo), se muestra "Tu álbum está completo 🎉" centrado, sin chips ni botones — comportamiento actual preservado. Los toggles solo aparecen cuando hay al menos un bloque con datos.

## Cambios de código

### `src/domain/tradeList.ts`

`formatTradeListByTeam` recibe un nuevo parámetro opcional `include`:

```ts
export function formatTradeListByTeam(
  list: TradeList,
  opts: {
    username: string | null;
    include?: { needed?: boolean; duplicates?: boolean };
  }
): string
```

Semántica:
- Default: `include = { needed: true, duplicates: true }` (back-compat con caller actual).
- Si `include.needed === false` no se renderiza el bloque "Me faltan*" ni sus items.
- Si `include.duplicates === false` no se renderiza el bloque "Tengo repes*" ni sus items.
- Si ambos `false` y `list` no está vacía → retorna string vacío. (El "álbum completo" requiere `list` vacía, no opta-out.)
- Si la lista está completa (`list.needed.length === 0 && list.duplicates.length === 0`) → sigue retornando `"Tu álbum está completo 🎉"` independientemente de `include`.

`formatItem` cambia:
```ts
function formatItem(e: TradeListEntry, mode: "needed" | "duplicates"): string {
  if (mode === "needed") return e.code;
  const extras = e.count - 1;
  return `${e.code} ×${extras}`;
}
```

`buildTradeList` no cambia (sigue exponiendo `code` y `number` en cada entry; usamos `code` ahora, mantenemos `number` para el orden).

### `src/hooks/useShareList.ts`

Simplificamos a exponer solo la lista cruda:

```ts
return {
  ...query,                  // isLoading, isError, etc.
  list: query.data ?? null
};
```

Se quita el cálculo de `text` y el import de `formatTradeListByTeam` del hook.

`useShareList` solo se consume en `friends.tsx` (verificado con grep). Podemos cambiar la API libremente: el hook expone solo `{ list, isLoading, ... }`, dejamos de calcular `text` adentro y movemos esa responsabilidad al modal. Menos código en el hook, menos memo inútil cuando el modal está cerrado.

### `src/ui/ShareListModal.tsx`

Cambio de API:
```ts
interface Props {
  visible: boolean;
  onClose: () => void;
  list: TradeList | null;
  username: string | null;
}
```

Estado interno:
```ts
const [showNeeded, setShowNeeded] = useState(true);
const [showDuplicates, setShowDuplicates] = useState(true);

useEffect(() => {
  if (visible) {
    setShowNeeded(true);
    setShowDuplicates(true);
  }
}, [visible]);
```

Cálculo del texto:
```ts
const text = useMemo(() => {
  if (!list) return "";
  return formatTradeListByTeam(list, {
    username,
    include: { needed: showNeeded, duplicates: showDuplicates }
  });
}, [list, username, showNeeded, showDuplicates]);

const isComplete = list != null && list.needed.length === 0 && list.duplicates.length === 0;
const bothOff = !showNeeded && !showDuplicates;
const hasNeeded = (list?.needed.length ?? 0) > 0;
const hasDuplicates = (list?.duplicates.length ?? 0) > 0;
const showToggles = !isComplete && (hasNeeded || hasDuplicates);
```

Render:
- Header (sin cambios).
- Si `showToggles` → fila con dos chips Me faltan/Tengo repes. Cada chip solo se muestra si su sección tiene contenido (`hasNeeded` / `hasDuplicates`); si solo hay una sección, se muestra solo ese chip (el toggle de la sección vacía no aporta).
- Área principal:
  - Si `isComplete` → texto "Tu álbum está completo 🎉" centrado.
  - Si `bothOff` → hint "Activá al menos una sección" centrado con `color: theme.textMute`.
  - Si no → caja con el `text` monospace (igual que hoy).
- Footer con Copiar/Compartir:
  - Se renderiza si `!isComplete`.
  - Ambos botones `disabled={bothOff || text.length === 0}`.
  - `Copiar` deshabilitado visualmente respeta el prop `disabled` de `PrimaryButton`.

### `app/(tabs)/friends.tsx`

Cambia el consumo de `useShareList` y los props del modal:

```ts
const { list } = useShareList();
const { user } = useSession();
// ...
<ShareListModal
  visible={shareOpen}
  onClose={() => setShareOpen(false)}
  list={list}
  username={user?.username ?? null}
/>
```

Quitamos `const { text: shareText } = useShareList();`.

### `src/ui/PrimaryButton.tsx`

Ya soporta `disabled` (con `opacity: 0.5` y `Pressable disabled`). Sin cambios.

## Tests

`tests/tradeList.test.ts` — agregar casos:

1. `formatItem` produce código en faltantes: `formatTradeListByTeam` con entry `{ code: "ARG-1", number: 1, ... }` debe contener `"ARG-1"` y no contener `"ARG 🇦🇷: 1,"` solo (debe ser `"ARG 🇦🇷: ARG-1"`).
2. Repes con código: entry `{ code: "MEX-5", count: 3, ... }` produce `"MEX-5 ×2"`.
3. `include: { needed: false }` omite el bloque "Me faltan*".
4. `include: { duplicates: false }` omite el bloque "Tengo repes*".
5. `include: { needed: false, duplicates: false }` con lista no vacía retorna string vacío `""`.
6. Lista vacía retorna `"Tu álbum está completo 🎉"` aunque `include` esté todo en false.
7. Orden interno preservado: items dentro de un equipo siguen ordenados por `number` ascendente aunque se muestren como `code`.

No se agregan tests de UI para los chips (la convención del proyecto es no testear UI con snapshots).

## Edge cases

- **Solo faltantes, sin repes (o viceversa):** se muestra solo el chip de la sección con datos. Apagarlo deja la pantalla en estado `bothOff` (hint visible, botones disabled).
- **Lista en loading:** `list === null`. No se muestran chips ni texto (la pantalla se ve casi vacía hasta que llegue la data, igual que hoy).
- **Códigos raros (`0-0`):** el guion en `0-0` no rompe nada, se concatena tal cual: `"Intro: 0-0, FWC-2, FWC-3"`. CSV-friendly (lo serializan con commas, no con guiones).
- **Equipo con un solo cromo:** sale `"ARG 🇦🇷: ARG-1"`, sin trailing comma (ya está cubierto por `join(", ")`).

## Riesgos y mitigación

- **Riesgo:** otros consumers de `useShareList().text` rompen. **Mitigación:** verificado por grep — solo `friends.tsx` lo consume. Cambiamos la API del hook sin temor.
- **Riesgo:** los tests existentes de `tradeList` dependen del formato con números. **Mitigación:** actualizar las assertions en el mismo PR; son tests internos, no contrato externo.

## Métricas de éxito

- El usuario puede compartir solo faltantes, solo repes, o ambos.
- El texto compartido identifica cada cromo de forma inequívoca (código completo).
- Cero regresiones en flujo de copiar/compartir.
- Tests de `tradeList` pasan (incluyendo los 7 casos nuevos).
