# App Store Connect — Remediación 5.2.1 (a aplicar manualmente)

Submission rechazada: 1ed87d5b-83bb-4fb2-9de2-7ec0257b75eb · Versión 1.2.0 (8)
Build nueva para resubmit: **1.2.0 (9)**

> Contexto: Apple rechazó 2 veces por 5.2.1. La primera respuesta ("es genérico")
> no alcanzó porque el contenido **seguía mapeando 1:1 al Mundial 2026** (48
> selecciones + 12 grupos A–L + año) y la **metadata tenía marcas** (Mundial,
> Panini, FIFA, Coca-Cola). Esta ronda: dataset sin grupos ni año, copy 100%
> genérica de "banderas del mundo".

## 0. Cambios de esta ronda (ya hechos en el repo)

- Dataset: lista plana de 48 banderas en orden de álbum, **sin grupos A–L, sin campo `group`, sin año** (`scripts/gen-stickers.js`, `assets/stickers.json`, `version` 11).
- Código muerto del Mundial borrado (`src/theme/teamGroups.ts`); símbolos `FIFA_*` renombrados a `COUNTRY_*`.
- Build bump: iOS `buildNumber` 9, Android `versionCode` 11.
- Copy de tienda reescrita (ver abajo y `docs/store/`).

## 1. Respuesta a App Review (hilo en App Store Connect)

> Hi, thank you for the additional review. To fully resolve 5.2.1 we have
> changed the app so it no longer references or mirrors any specific
> tournament, event, or organization. We removed all year and tournament
> references from the app and its metadata, and the album no longer reproduces
> the structure, team selection, or grouping of any real-world competition.
> It is now a generic world-flags sticker-collection tracker (flags and codes
> only): users mark stickers they own, count duplicates, track progress, and
> trade with friends. The app is independent and is not affiliated with,
> endorsed by, or licensed from FIFA or any federation, publisher, or brand,
> and it contains no third-party trademarks, logos, official numbering, player
> names, or images. We are not claiming any authorization. The updated build
> (1.2.0, build 9) and metadata reflect these changes. Please re-review.
> Thank you.

## 2. App Review Information (en App Store Connect)

Apple ofreció dos caminos: aportar contacto/autorización de FIFA, **o** remover
el contenido de terceros. Tomamos el segundo. En "Notes" del App Review
Information, aclarar:

> This app is a generic, self-made sticker-collection tracker. It is not
> affiliated with FIFA or any third party and does not require any third-party
> authorization. There is no FIFA contact because the app contains no FIFA
> content: no trademarks, logos, official numbering, team rosters, player
> names, or images. The album is a generic world-flags collection and does not
> reproduce the structure of any real competition.

## 3. Metadata — App Store (campos a editar)

Prohibido en todos los campos: **FIFA, Mundial, World Cup, Panini, Coca-Cola,
Qatar, 2026, "selecciones"/"selecciones clasificadas", "álbum oficial",
nombres de torneos/federaciones/marcas.**

- **Nombre:** `Stickerswap`
- **Subtítulo (≤30):** `Organizá tu álbum de cromos`
- **Texto promocional (≤170):** `Marcá las figuritas que ya tenés, contá tus repetidas, seguí tu progreso e intercambiá con amigos. Un álbum genérico de figuritas de banderas, offline-first.`
- **Keywords (≤100):** `album,cromos,figuritas,stickers,coleccion,intercambio,repetidas,faltantes,banderas,trade`
- **Descripción:** usar el texto genérico de `docs/store/play-store-description.txt` (sirve igual para App Store).
- **Categoría:** Entretenimiento (evitar Deportes / eventos).

## 4. Screenshots

Revisar las capturas subidas y **quitar/retomar cualquiera con texto de marca,
año o "selecciones"**. Las vistas válidas son genéricas (álbum, una bandera,
home con progreso). No subir capturas con copy de torneo.

## 5. Checklist previo a re-submit

- [x] Dataset sin grupos/año (regenerado, 167 tests verdes, typecheck OK).
- [x] Build incrementada (1.2.0 build 9).
- [ ] `eas build --platform ios --profile production`
- [ ] `eas submit --platform ios --latest`
- [ ] Descripción, subtítulo, promo y keywords sin términos prohibidos.
- [ ] Screenshots revisadas (sin marca/año/"selecciones").
- [ ] App Review Information → Notes actualizadas (sección 2).
- [ ] Respuesta enviada en el hilo de App Review (sección 1).
