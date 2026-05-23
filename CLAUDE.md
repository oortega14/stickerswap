# CLAUDE.md

Guía rápida para Claude (o cualquier persona/IA) que retome el proyecto. Es un brief, no un manual exhaustivo: leelo y vas a tener el panorama.

## Qué es

App móvil offline-first para gestionar tu álbum de cromos del torneo de selecciones 2026. Marcás láminas pegadas, contás repetidas, ves progreso por equipo, intercambiás con amigos por QR/username, ves matches automáticos.

Personal project del autor (Oscar Ortega), para uso individual + amigos. App independiente, sin afiliación con ninguna editorial ni federación.

## Stack

- **Mobile:** Expo SDK 54, React Native 0.81, TypeScript strict
- **UI:** Expo Router (file-based), NativeWind v4 (Tailwind), Reanimated v4, react-native-svg, FlashList
- **State:** Zustand (cliente) + TanStack Query (queries remotas/locales)
- **Persistencia local:** `expo-sqlite`
- **Backend:** Supabase (Postgres + Auth + Realtime + RLS)
- **Auth:** Supabase OAuth con Google + Apple Sign-In (vía expo-apple-authentication)
- **Tests:** Jest + jest-expo. Cobertura solo en lógica pura y data layer; no testeamos UI con snapshots.
- **Distribución:** EAS Build/Submit. Ver `eas.json`. Apple Developer activo.

Versión actual: `1.1.0`. Stack alineado a SDK 54.

## Estructura

```
stickerswap/
├── app/                        # Rutas Expo Router
│   ├── _layout.tsx             # Auth gate, providers, sync engine, realtime bridge
│   ├── (auth)/                 # sign-in, onboarding (elegir username)
│   ├── (tabs)/                 # Home, Álbum, Cambios, Perfil
│   ├── onboarding/[step].tsx   # Tutorial inicial 3 pantallas
│   ├── sticker/[code].tsx      # Modal detalle de lámina
│   ├── team/[code].tsx         # Redirect legacy → /?expand=<id>
│   ├── friends/                # Lista + detalle de amigos
│   ├── add-friend/             # Scan QR + búsqueda por @
│   ├── profile/edit.tsx        # Modal editar display name
│   └── about.tsx               # Versión + privacy/terms
│
├── src/
│   ├── auth/                   # supabaseClient, useSession, OAuth, username
│   ├── data/                   # SQLite schema, seed, stickers, status, queue, friends cache
│   ├── domain/                 # Tipos, lógica pura: progress, tradeList, friendMatchBuilder, inviteCode
│   ├── hooks/                  # TanStack Query wrappers
│   ├── lib/                    # haptics, onboarding flag, version
│   ├── social/                 # friendships (remote), realtime listener
│   ├── store/                  # Zustand stores (filters, etc)
│   ├── sync/                   # worker, conflict resolution, backoff
│   ├── theme/                  # colors, tokens, teamColors (banderas)
│   └── ui/                     # Componentes presentacionales
│
├── supabase/
│   ├── config.toml
│   └── migrations/             # 13 migraciones SQL
│
├── assets/
│   ├── stickers.json           # Dataset de 994 cromos (solo code+team+section)
│   ├── flags-png/              # 48 banderas PNG @1x/@2x/@3x
│   └── play-store/             # Screenshots y feature graphic
│
├── scripts/
│   ├── gen-stickers.js         # Generador del dataset
│   ├── gen-icon.js             # Genera icon/splash desde SVG (sharp)
│   ├── svg-to-png-flags.js     # Banderas SVG → PNG @1x/@2x/@3x
│   └── fetch-flags.js          # Descarga banderas
│
├── docs/
│   ├── legal/                  # privacy-policy.md, terms.md (publicados en oortega14.com)
│   └── superpowers/
│       ├── specs/              # Diseño aprobado del producto
│       └── plans/              # Planes de implementación (historicos)
│
└── tests/                      # ~30 suites, 161 tests (Jest)
```

## Comandos clave

Asumí siempre `eval "$(mise activate zsh)"` antes (el proyecto usa Node 22 vía mise).

```bash
pnpm start                              # Metro bundler
pnpm test                               # Jest (161 tests, <1s)
pnpm exec tsc --noEmit                  # Typecheck strict
pnpm exec expo prebuild --platform ios --clean  # Regenerar carpeta ios/
node scripts/gen-stickers.js            # Regenerar dataset stickers.json
supabase db push                        # Aplicar migraciones SQL al proyecto remoto
eas build --platform ios --profile production    # Build iOS
eas build --platform android --profile production
eas submit --platform ios --latest      # TestFlight
eas submit --platform android --latest  # Play Internal track
```

## Conceptos importantes

### Dataset de stickers (`assets/stickers.json`)

994 stickers con campos mínimos:

- `code` (string, PK único — ej. `FWC-1`, `MEX-1`, `CC1`)
- `number` (int, posición en el álbum)
- `team` (código de país o null para especiales)
- `section` (nombre de la sección)
- `type` (`player`, `team_badge`, `team_photo`, `icon`, `special`)
- `group` (letra A-L para teams; null para especiales)

**No incluye nombres de jugadores ni imágenes** — para minimizar riesgo de IP. La UI muestra el código del cromo + la bandera del país.

Secciones: 9 stickers Intro + 48 equipos × 20 + 11 Extras + 14 Estrellas.

Para regenerar: editar `scripts/gen-stickers.js`, bumpear `version`, correr `node scripts/gen-stickers.js`. La app detecta version mayor al boot y re-siembra `stickers` local sin tocar `sticker_status` (progreso).

### Sync local-first

Cada tap en una lámina escribe en SQLite local y encola en `sync_queue`. Un worker en `_layout.tsx` drena la queue:
- Al boot
- Cada 30s en foreground
- Al volver a foreground (AppState)
- Al recuperar conexión (NetInfo)

Conflictos: last-write-wins por `updated_at`.

### Auth (Google + Apple)

Browser-based OAuth para Google (`expo-web-browser`). Apple Sign-In nativo (`expo-apple-authentication`). Supabase redirige a `stickerswap://` con tokens.

⚠️ **Trampa conocida**: las queries Supabase deben ejecutarse FUERA del callback de `onAuthStateChange` (deferidas con `setTimeout(0)`), porque adentro hay un lock interno y deadlockea. Ver `src/auth/useSession.ts`.

### Storage de session

SecureStore con chunking (JWTs > 2KB exceden límite iOS). El adapter en `src/auth/supabaseClient.ts` parte el valor en pedazos `key.0`, `key.1`, ... + `key.chunks` con el conteo.

### Onboarding flag

`profiles.onboarding_completed` (Postgres) determina si pasó por el screen de elegir username. NO usar regex sobre `username` (loop si aceptan el default auto-generado).

### RLS

- `profiles` SELECT abierto (para búsqueda por @username), UPDATE/INSERT solo dueño
- `sticker_status` SELECT propio + amigos aceptados
- `friendships` SELECT donde involucrado, manage solo lado propio

## Convenciones

- Archivos chicos y enfocados. Si crece >300 líneas, considerar split.
- Tests TDD para lógica pura (progress, tradeList, conflict, backoff, inviteCode, friendMatchBuilder).
- Para tests que tocan SQLite: ver `tests/setup-sqlite-mock.ts` (mock con better-sqlite3 in-memory).
- Cuando agregás dep nativa: `pnpm exec expo install <pkg>` + plugin en `app.json` + rebuild iOS.
- Cuando agregás migration SQL: `supabase/migrations/YYYYMMDDHHmmSS_name.sql` + `supabase db push`.
- Commits: convencionales (feat/fix/chore/docs/test/data) + co-author trailer cuando IA ayuda.

## Trampas conocidas

- **pnpm + RN**: usar `node-linker=hoisted` en `.npmrc` (ya configurado).
- **Bundle ID**: `app.stickerswap` (matchea con Play Store listing y App Store Connect).
- **SDK 54**: usar siempre `npx expo install --check` para alinear pins.
- **Deadlock onAuthStateChange**: cualquier `supabase.from(...).select(...)` dentro del callback se cuelga. Diferir con `setTimeout(0)`.

## Notas de implementación

- El generator `scripts/gen-stickers.js` es la fuente de verdad para el dataset. Editar ahí, no `assets/stickers.json` directamente — se sobrescribe.
- `src/theme/teamColors.ts` mapea códigos de país a colores de bandera.
- La app soporta tema claro (cream/coffee) y oscuro (espresso). Default light. Toggle en Perfil → Apariencia. Persistencia en AsyncStorage (clave `stickerswap.theme.mode`).
- Storage keys internas usan prefijo `stickerswap.*` (theme, lang) y `stickerswap_*` (onboarding). DB local: `stickerswap.db`.

## Estado de release

- ✅ P1-P5 features completas
- ✅ Cleanup de IP (sin fotos, sin nombres de jugadores, sin marcas Panini/FIFA/World Cup)
- ⏳ TestFlight + Play Store Internal Testing (en proceso)
