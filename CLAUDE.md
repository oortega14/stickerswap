# CLAUDE.md

Guía rápida para Claude (o cualquier persona/IA) que retome el proyecto. Es un brief, no un manual exhaustivo: lee este archivo + el spec en `docs/superpowers/specs/2026-04-28-panini-album-design.md` y vas a tener el panorama.

## Qué es

App móvil offline-first para gestionar el álbum Panini del Mundial 2026. Marcás figuritas pegadas, contás repetidas, ves progreso por equipo, intercambiás con amigos por QR/username, ves matches automáticos.

Personal project del autor (Oscar Ortega), para uso individual + amigos. No comercial todavía.

## Stack

- **Mobile:** Expo SDK 54, React Native 0.81, TypeScript strict
- **UI:** Expo Router (file-based), NativeWind v4 (Tailwind), Reanimated v4, react-native-svg, FlashList
- **State:** Zustand (cliente) + TanStack Query (queries remotas/locales)
- **Persistencia local:** `expo-sqlite`
- **Backend:** Supabase (Postgres + Auth + Realtime + RLS)
- **Auth:** Supabase OAuth con Google (Apple deshabilitado hasta licencia paga de Apple Developer)
- **Tests:** Jest + jest-expo. Cobertura solo en lógica pura y data layer; no testeamos UI con snapshots.

Versión actual: `1.0.0-beta.1`. Stack alineado a SDK 54 (después de un upgrade desde SDK 53; el plan original tenía SDK 53 pero la realidad de hoy requiere 54).

## Estructura

```
panini-album/
├── app/                        # Rutas Expo Router
│   ├── _layout.tsx             # Auth gate, providers, sync engine, realtime bridge
│   ├── (auth)/                 # sign-in, onboarding (elegir username)
│   ├── (tabs)/                 # Home, Álbum, Cambios, Perfil
│   ├── onboarding/[step].tsx   # Tutorial inicial 3 pantallas
│   ├── sticker/[code].tsx      # Modal detalle de figurita
│   ├── team/[code].tsx         # Página de equipo con sus 20 cromos
│   ├── friends/                # Lista + detalle de amigos
│   ├── add-friend/             # Scan QR + búsqueda por @
│   ├── profile/edit.tsx        # Modal editar display name
│   └── about.tsx               # Versión + privacy/terms
│
├── src/
│   ├── auth/                   # supabaseClient, useSession, google OAuth, username
│   ├── data/                   # SQLite schema, seed, stickers, status, queue, friends cache
│   ├── domain/                 # Tipos, lógica pura: progress, tradeList, friendMatchBuilder, inviteCode
│   ├── hooks/                  # TanStack Query wrappers
│   ├── lib/                    # haptics, onboarding flag, version
│   ├── social/                 # friendships (remote), realtime listener
│   ├── store/                  # Zustand stores (filters, tradePreferences)
│   ├── sync/                   # worker, conflict resolution, backoff
│   ├── theme/                  # colors, tokens, teamColors (banderas)
│   └── ui/                     # Componentes presentacionales
│
├── supabase/
│   ├── config.toml
│   └── migrations/             # 13 migraciones SQL
│
├── assets/
│   └── stickers.json           # Dataset de 994 cromos del álbum
│
├── scripts/
│   ├── gen-stickers.js         # Generador del dataset (reemplazá nombres aquí)
│   └── gen-icon.js             # Genera icon/splash desde SVG (sharp)
│
├── docs/
│   └── superpowers/
│       ├── specs/              # Diseño aprobado del producto
│       └── plans/              # Planes de implementación P1-P5
│
└── tests/                      # 55 unit + integration tests (Jest)
```

## Comandos clave

Asumí siempre `eval "$(mise activate zsh)"` antes (el proyecto usa Node 22 vía mise, no global).

```bash
pnpm start                              # Metro bundler (servidor JS)
pnpm test                               # Jest (~55 tests, <1s)
pnpm exec tsc --noEmit                  # Typecheck strict
pnpm exec expo prebuild --platform ios --clean  # Regenerar carpeta ios/
node scripts/gen-stickers.js            # Regenerar dataset stickers.json
supabase db push                        # Aplicar migraciones SQL al proyecto remoto
```

Para builds nativas (después de cambios en `app.json`, plugins o native modules):

```bash
cd ios
xcodebuild -workspace PaniniAlbum.xcworkspace \
  -scheme PaniniAlbum -configuration Debug \
  -destination 'id=<UDID>' -derivedDataPath build \
  CODE_SIGN_IDENTITY="-" clean build
```

(O abrir Xcode y ▶ Play — más fácil cuando hay signing involved.)

## Conceptos importantes

### Dataset de stickers (`assets/stickers.json`)

994 stickers en estructura:

- `code` (string, PK único — ej. `FWC-1`, `MEX-1`, `CC1`)
- `number` (int, lo impreso en la lámina)
- `name`, `team` (FIFA code o null), `section`, `type`, `group`

Sections: 9 stickers de Intro + 48 equipos × 20 + 11 Extras (FWC históricos) + 14 Coca-Cola.

Para regenerar después de cambios en `gen-stickers.js`: `node scripts/gen-stickers.js` y bumpeás `version` en el script. La app detecta version mayor al boot y re-siembra la tabla `stickers` local sin tocar `sticker_status` (progreso).

### Sync local-first

Cada tap en una figurita escribe en SQLite local y encola en `sync_queue`. Un worker en `_layout.tsx` drena la queue:

- Al boot
- Cada 30s en foreground
- Al volver a foreground (AppState)
- Al recuperar conexión (NetInfo)

Conflictos: last-write-wins por `updated_at`.

### Auth (Google OAuth)

Browser-based OAuth (no native sign-in SDK):

1. App abre Safari embebido vía `expo-web-browser`
2. Usuario autoriza con Google
3. Supabase redirige a `panini://` con tokens en URL fragment
4. Cliente extrae tokens, llama `setSession`

Apple Sign-In está deshabilitado (requiere Apple Developer paga).

⚠️ **Trampa conocida**: las queries Supabase deben ejecutarse FUERA del callback de `onAuthStateChange` (deferidas con `setTimeout(0)`), porque adentro hay un lock interno y deadlockea. Ver `src/auth/useSession.ts`.

### Storage de session

Usa SecureStore con chunking (las JWT pesan >2KB, sobre el límite de iOS). El adapter en `src/auth/supabaseClient.ts` parte el valor en pedazos `key.0`, `key.1`, ... + `key.chunks` con el conteo.

(Hubo un período de diagnóstico con storage in-memory; volvimos a SecureStore con chunking por persistencia.)

### Onboarding flag

`profiles.onboarding_completed` (Postgres) determina si el usuario ya pasó por el screen de elegir username. NO usar el regex sobre `username` (loop si aceptan el default auto-generado).

### RLS

- `profiles` SELECT abierto (para búsqueda por @username), UPDATE/INSERT solo dueño
- `sticker_status` SELECT propio + amigos aceptados (P4)
- `friendships` SELECT donde involucrado, manage solo lado propio

### Estado de release

- ✅ P1 Foundation + Álbum offline
- ✅ P2 Auth + Sync remoto
- ✅ P3 Compartir lista
- ✅ P4 Amigos + Matches + Realtime
- ✅ P5 Pulido visual + features (Home redesign + páginas de equipo)
- ⏳ Distribución (TestFlight + Play Store) → pendiente Apple Developer license

## Convenciones

- Archivos chicos y enfocados. Si crece >300 líneas, considerar split.
- Tests TDD para lógica pura (progress, tradeList, conflict, backoff, inviteCode, friendMatchBuilder).
- Para tests que tocan SQLite: ver `tests/setup-sqlite-mock.ts` (mock con better-sqlite3 in-memory).
- Cuando agregás dep nativa: `pnpm exec expo install <pkg>` + plugin en `app.json` + rebuild iOS.
- Cuando agregás migration SQL: `supabase/migrations/YYYYMMDDHHmmSS_name.sql` + `supabase db push`.
- Commits: convencionales (feat/fix/chore/docs/test/data) + co-author trailer cuando IA ayuda.

## Trampas conocidas

- **pnpm + RN**: usar `node-linker=hoisted` en `.npmrc` (ya configurado). Sin esto, transitive deps de RN no resuelven.
- **Personal Team signing** sin Apple Developer paga = builds expiran a los 7 días, hay que re-buildear desde Xcode.
- **expo-web-browser + expo-camera + expo-secure-store** son nativos → cada uno requiere prebuild + rebuild para activarse.
- **SDK 53 vs 54**: si reanudás un plan viejo, los pins del plan original (`expo: ~53.0.0`) ya no son válidos. Usar siempre `npx expo install --check` para alinear.
- **Deadlock onAuthStateChange**: cualquier `supabase.from(...).select(...)` dentro del callback se cuelga. Diferir con `setTimeout(0)`.

## Notas de implementación

- El generator `scripts/gen-stickers.js` es la fuente de verdad para el dataset. Editar ahí, no `assets/stickers.json` directamente — se sobrescribe.
- `src/theme/teamColors.ts` mapea ~60 códigos FIFA a colores de bandera. Para agregar uno nuevo, seguir el mismo formato `{ primary, accent, text }`.
- La app es dark-only (`userInterfaceStyle: "dark"`). No hay modo claro y no se planea.

## Personal Team y signing

Bundle ID: `app.panini.mundial2026`. Configurado para signing con "Personal Team" en Xcode (sin Apple Developer paga).

Limitaciones del signing free:
- App expira a 7 días, hay que reinstalar desde Xcode
- No funciona en simulador con Google Sign-In (problema de keychain) — usar device físico
- Sin TestFlight ni distribución

Para ir a producción habría que pagar Apple Developer ($99/año) y reactivar Apple Sign-In, configurar EAS Build, etc. (P5 Tasks T18-T22 del plan).
