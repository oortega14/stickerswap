# Panini Album — Design Spec

**Fecha:** 2026-04-28
**Autor:** Oscar Ortega
**Estado:** Aprobado para implementación

## 1. Resumen

App móvil multiplataforma (iOS + Android) para gestionar el álbum Panini del Mundial 2026. Permite marcar figuritas pegadas y repetidas, ver progreso por sección, agregar amigos, y descubrir matches automáticos entre figuritas que tenés repetidas y las que tu amigo necesita.

UI con temática espacial de intensidad media (gradientes nebulosa, estrellas estáticas, glow sutil) en paleta púrpura/azul/negro. Funcional sobre todo, sin elementos decorativos que no aporten.

## 2. Objetivos y no-objetivos

### En alcance (v1)
- Marcar figuritas pegadas y contar repetidas (`count` por sticker).
- Progreso total y por sección (grupos, equipos, estadios, etc.).
- Buscador por número/nombre/equipo, filtros "faltan" / "repetidas".
- Compartir lista de "tengo / necesito" como texto plano (share sheet del OS).
- Sync en la nube social: agregar amigos vía QR/invite code o búsqueda por @username; ver matches.
- Sign-in nativo con Apple y Google.
- Funciona offline-first.

### Fuera de alcance (v1, explícitamente diferido)
- Escaneo de figuritas con cámara (OCR).
- Estadísticas e historial (sobres abiertos, tasa de repetidas).
- Soporte multi-álbum.
- Notificaciones push (la primera versión usa Realtime mientras la app está abierta).
- Reportes a Sentry/Bugsnag.
- Login por email/SMS.

## 3. Stack y arquitectura

### Stack
- **Mobile:** Expo SDK 53 + React Native + TypeScript + Expo Router (file-based).
- **UI:** NativeWind (Tailwind para RN) + Reanimated + react-native-svg.
- **Estado:** Zustand (cliente) + TanStack Query (queries remotas).
- **Persistencia local:** `expo-sqlite`.
- **Backend:** Supabase (Postgres, Auth, Realtime, RLS).
- **Auth nativa:** `expo-apple-authentication` + `@react-native-google-signin/google-signin`.
- **Almacenamiento de tokens:** `expo-secure-store` (Keychain en iOS, Keystore en Android).

### Por qué Supabase
Free tier holgado para esta escala (500MB DB, 50k MAU). Postgres permite el query de "match" trivialmente. RLS reemplaza la mayoría de un backend custom. La query mensual prevista es bajísima.

Si la app crece, la migración a Rails es realista (~1-2 semanas de trabajo): la DB es Postgres exportable, lo más pegajoso es Auth (passwords bcrypteadas internamente) y Realtime.

### Arquitectura de capas

```
[ Expo App ]
  ├── UI (Expo Router · NativeWind · Reanimated)
  ├── State (Zustand · TanStack Query)
  ├── Local DB (expo-sqlite + sync queue)
  ├── Embedded Data (stickers.json, leído al boot)
  └── Auth Clients (Apple/Google nativos)
        ↓ JWT / REST / WebSocket
[ Supabase ]
  ├── Auth (verifica id_token, emite JWT)
  ├── Postgres + RLS (profiles, sticker_status, friendships)
  └── Realtime (notifica cambios de amigos)
        ↓ id_token
[ Apple ID · Google Account ]
```

### Principios
- **Offline-first:** la UI lee siempre de SQLite local. Marcar es instantáneo.
- **Sync en background:** cola de cambios pendientes drenada cada 30s, al volver foreground, y al recuperar conexión.
- **Source of truth:** servidor manda para `sticker_status`/`friendships`/`profiles`; el JSON embebido manda para los datos del álbum (estáticos).
- **Realtime acotado:** solo se usa para refrescar matches con amigos. Nunca para tu propio estado.

## 4. Modelo de datos

### Datos embebidos (stickers.json)
Archivo JSON empaquetado con la app. ~670 entradas. Cargado a `stickers` en SQLite local al primer boot.

```ts
{
  code: string,      // PK ej. "FWC1", "ARG-3"
  number: number,    // número del sticker
  name: string,      // jugador / equipo / estadio
  team: string | null,
  section: string,   // "Grupo A", "Estadios", "Iconos", etc.
  type: "player" | "team_badge" | "stadium" | "icon" | "special",
  version: number    // del dataset, para detección de cambios
}
```

### Postgres (Supabase)

**`profiles`** — 1:1 con `auth.users`.
| Columna | Tipo | Notas |
|--|--|--|
| id | UUID PK | FK a `auth.users` ON DELETE CASCADE |
| username | TEXT UNIQUE | regex `^[a-z0-9_]{3,20}$` |
| display_name | TEXT | |
| avatar_url | TEXT | nullable |
| invite_code | TEXT UNIQUE | 8 chars, generado por trigger |
| created_at | TIMESTAMPTZ | default `now()` |

**`sticker_status`** — progreso por usuario por figurita.
| Columna | Tipo | Notas |
|--|--|--|
| user_id | UUID | FK profiles, parte de PK |
| sticker_code | TEXT | parte de PK |
| count | SMALLINT | `>= 0`. 0=falta, 1=pegada, >1=repetidas |
| updated_at | TIMESTAMPTZ | default `now()` |

PK compuesta `(user_id, sticker_code)`. ~670 filas por usuario.

**`friendships`** — 2 filas por relación bidireccional (A→B y B→A).
| Columna | Tipo | Notas |
|--|--|--|
| user_id | UUID | parte de PK |
| friend_id | UUID | parte de PK; CHECK `friend_id <> user_id` |
| status | ENUM | `pending` \| `accepted` \| `blocked` |
| source | ENUM | `qr_code` \| `username_search` |
| created_at | TIMESTAMPTZ | |

**`v_friend_matches`** — VIEW, no tabla. Calcula al vuelo los matches "amigo tiene repetida × yo no la tengo". Si en el futuro escala mal, se convierte en materialized view refrescada por trigger.

```sql
CREATE VIEW v_friend_matches AS
SELECT
  fs.user_id        AS me_id,
  fs.friend_id      AS friend_id,
  ss_friend.sticker_code,
  ss_friend.count - 1 AS extras
FROM friendships fs
JOIN sticker_status ss_me
  ON ss_me.user_id = fs.user_id AND ss_me.count = 0
JOIN sticker_status ss_friend
  ON ss_friend.user_id = fs.friend_id
  AND ss_friend.sticker_code = ss_me.sticker_code
  AND ss_friend.count > 1
WHERE fs.status = 'accepted';
```

### SQLite local

```sql
-- semilla desde stickers.json
CREATE TABLE stickers (code TEXT PK, number INT, name TEXT, team TEXT, section TEXT, type TEXT);

-- mirror del remoto
CREATE TABLE sticker_status (sticker_code TEXT PK, count INT, updated_at INT);

-- escrituras pendientes
CREATE TABLE sync_queue (id INTEGER PK AUTOINCREMENT, sticker_code TEXT, count INT, ts INT, attempts INT DEFAULT 0);

-- caché de matches con amigos
CREATE TABLE friend_matches_cache (friend_id TEXT, sticker_code TEXT, extras INT, fetched_at INT);

-- versión de stickers.json instalada (para detectar updates)
CREATE TABLE meta (key TEXT PK, value TEXT);
```

## 5. Autenticación y seguridad

### Flujo de sign-in
1. Usuario tap en "Continuar con Apple" / "Continuar con Google" en `(auth)/sign-in.tsx`.
2. SDK nativo abre el flow del SO y devuelve un `id_token` (JWT firmado por Apple/Google).
3. App llama `supabase.auth.signInWithIdToken({ provider, token })`.
4. Supabase verifica la firma contra el JWKS del proveedor y crea o recupera la fila en `auth.users`.
5. Trigger Postgres crea la fila `profiles` con username autogenerado (ej. `oscar_4f2k`) y `invite_code` de 8 chars si es la primera vez.
6. Supabase devuelve sesión (access_token + refresh_token).
7. App guarda los tokens en SecureStore.
8. Si el username es autogenerado, el cliente redirige a `(auth)/onboarding.tsx` para que el usuario lo cambie (con check de unicidad debounced).

### RLS

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sticker_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- profiles: cualquiera lee (para search), solo dueño escribe
CREATE POLICY "select profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "update own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- sticker_status: tuyo + amigos aceptados
CREATE POLICY "select stickers" ON sticker_status FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM friendships
      WHERE user_id = auth.uid()
        AND friend_id = sticker_status.user_id
        AND status = 'accepted'
    )
  );
CREATE POLICY "modify own stickers" ON sticker_status FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- friendships: solo las tuyas
CREATE POLICY "select own friendships" ON friendships FOR SELECT
  USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "manage own side" ON friendships FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### RPC `accept_invite_code(code TEXT)`
Función Postgres que, dado un `invite_code` válido, crea las dos filas de `friendships` (A→B y B→A) con `status='accepted'` atómicamente. Más limpio que dos inserts desde el cliente y centraliza la validación del código.

## 6. Estructura del app

### Tabs (4)
1. **Home** (`(tabs)/index.tsx`) — overview con barra de progreso total, breakdown por sección, atajo a matches.
2. **Álbum** (`(tabs)/album.tsx`) — grilla virtualizada de los 670 stickers con buscador y filtros (Todos / Faltan / Repetidas). Tap = +1, long-press = -1.
3. **Cambios** (`(tabs)/trades.tsx`) — dos sub-tabs: "Matches con amigos" y "Mi lista" (botón compartir como texto via OS share sheet).
4. **Perfil** (`(tabs)/profile.tsx`) — avatar, username, QR + invite code, botones para escanear código de amigo o buscar por @username, log out.

### Rutas

```
app/
  _layout.tsx                # auth gate, theme provider, query client
  (auth)/
    _layout.tsx
    sign-in.tsx              # Apple/Google buttons
    onboarding.tsx           # elegir username
  (tabs)/
    _layout.tsx              # tab bar (4 tabs)
    index.tsx                # Home
    album.tsx                # Grilla
    trades.tsx               # Matches + Mi lista
    profile.tsx              # Settings
  sticker/[code].tsx         # detalle modal
  friends/[username].tsx     # perfil de amigo
  add-friend/scan.tsx        # cámara para QR
  add-friend/search.tsx      # buscar por @username
```

### Decisiones de UX
- **Tap en sticker = +1, long-press = -1.** Sin menús contextuales para mantener la velocidad de marcado.
- **Compartir lista** abre el share sheet del OS con texto plano del tipo: `"Mundial 2026 — Necesito: 042, 087, 156, 287... | Tengo repe: 023, 142, 412..."`.
- **El QR del Perfil** codifica el `invite_code` y lo lee la cámara del otro usuario sin requerir cuenta de `friend_id`.

## 7. Sync local-first

### Lectura
La UI nunca espera red. Toda query pasa por SQLite local. Las consultas se exponen a la UI vía hooks de TanStack Query con `queryKey` por sección/filtro y se invalidan localmente cuando el sync worker o el usuario modifican datos. La query típica es:

```sql
SELECT s.*, ss.count
FROM stickers s
LEFT JOIN sticker_status ss ON s.code = ss.sticker_code
WHERE s.section = ?
ORDER BY s.number;
```

### Escritura
1. Usuario marca un sticker.
2. App ejecuta `UPDATE sticker_status SET count = count + 1, updated_at = ? WHERE sticker_code = ?` en SQLite.
3. Inserta una fila en `sync_queue`.
4. UI muestra animación + haptic.
5. Sync worker drena la queue en background.

### Sync worker
Triggers:
- Boot del app → pull completo, luego drain.
- App vuelve a foreground → pull rápido + drain.
- `NetInfo` pasa de offline a online → drain inmediato.
- Timer cada 30s en foreground.

Drain:
1. SELECT sync_queue ORDER BY id LIMIT 50.
2. Por cada fila: upsert remoto via `supabase.from('sticker_status').upsert(...)`.
3. Si OK → DELETE de sync_queue.
4. Si falla con timeout/5xx → `attempts += 1`, reintento con backoff exponencial (1s, 5s, 30s, 5min).
5. Si `attempts >= 10` → marca `stuck`, UI muestra banner "Hay un problema sincronizando — tocá para reintentar".

### Conflictos
Last-write-wins por `updated_at`. En el upsert remoto:

```sql
INSERT ... ON CONFLICT (user_id, sticker_code) DO UPDATE
SET count = EXCLUDED.count, updated_at = EXCLUDED.updated_at
WHERE sticker_status.updated_at <= EXCLUDED.updated_at;
```

Suficiente para v1 — el caso real (mismo usuario editando desde dos dispositivos en simultáneo) es raro.

### Realtime
Cliente suscribe a `friend_updates:<user_id>`. Cuando un amigo modifica su `sticker_status`, recibe un evento que solo dispara un `refresh` del cache de matches. Nunca toca el `sticker_status` propio.

## 8. Listas de cambios y matches

### Matches
La pantalla "Cambios" abre con un query a `v_friend_matches` filtrado por `me_id = auth.uid()`. Se agrupa por `friend_id` para mostrar:

```
@juli_panini       — 3 que te faltan: 142, 287, 412
@maria_kr          — 5 que te faltan: 023, 087, 156, 234, 567
```

Tap en un amigo abre `friends/[username].tsx` con detalle bidireccional ("ella tiene X que necesitás, vos tenés Y que ella necesita").

### Mi lista (compartir)
Genera texto plano:

```
Panini Mundial 2026 — @oscar_panini

NECESITO (258 figus):
042, 087, 156, 234, ...

TENGO REPETIDAS (47):
023(×2), 142(×3), 287(×2), ...

Coordinemos por acá 👋
```

Botón "Compartir" abre el share sheet del OS (`expo-sharing`).

## 9. Diseño visual

Intensidad **media** (no sutil, no neón intenso):

- **Fondo:** gradiente radial púrpura → azul oscuro → negro (`#5b1ea3 → #1a0d4d → #000`).
- **Estrellas estáticas** decorativas via `react-native-svg` o capa fija; sin parallax.
- **Cards:** `rgba(28,22,72,0.6)` con borde `rgba(124,92,255,0.3)`, opcional `backdrop-filter: blur` donde el OS lo soporte (iOS via `expo-blur`).
- **Acento principal:** gradiente `#7c5cff → #3b82f6`.
- **Texto:** blanco roto `#e8e6ff`, secundario `#a59cdf`.
- **Glow sutil** en barra de progreso y botón primario (`box-shadow` o equivalente RN via Reanimated).
- **Animaciones:** transiciones de pantalla con Reanimated (slide + fade), `withSpring` al marcar sticker (scale 1.0 → 1.15 → 1.0 con haptic light).

## 10. Manejo de errores

### Red / sync
- **Sin conexión al escribir:** silencioso. Indicador "X cambios pendientes" en header del Home.
- **Falla en push:** backoff exponencial. A los 10 intentos, marca `stuck` y banner para reintentar.
- **JWT expirado:** refresh automático. Si refresh falla → sign-out forzado.

### Auth
- **Cancelado por usuario:** silencioso.
- **Falla técnica:** alerta clara con "Reintentar".
- **Username tomado:** validación inline debounced.

### Datos locales
- **SQLite corrupto** (`PRAGMA integrity_check` al boot): wipe + pull completo del servidor.
- **stickers.json más nuevo que el local:** comparar `version` en `meta`. Si difiere → re-sembrar tabla `stickers` sin tocar `sticker_status`.

### Social
- **Amigo borró cuenta:** RLS oculta sus stickers. UI filtra "amigos sin perfil".
- **QR inválido:** error claro "Código no encontrado".
- **Bloqueo:** sin notificaciones; el bloqueado simplemente no aparece más en buscador del bloqueador.

### Lo que NO hacemos en v1
- Sentry/Bugsnag.
- Pantallas elaboradas de "algo salió mal".
- Reintento manual por sticker individual.

## 11. Testing

### Pirámide deliberadamente flaca

**Unit (Jest)**
- Resolución de conflictos (last-write-wins).
- Calculadora de progreso por sección.
- Generador del texto de "Mi lista".
- Cola de sync (encolar, drenar, backoff).

**Integration**
- Marcar sticker → SQLite → queue → push (con `supabase-js` mockeado o un proyecto Supabase de test).
- Auth: id_token mock → sesión persistida en SecureStore.
- RLS: cliente con JWT de prueba intentando leer stickers de otro usuario → debe fallar.

**E2E (Maestro)**
- Sign in → onboarding → Home con 0%.
- Marcar 5 stickers → progreso actualiza → cerrar app → reabrir → progreso conservado.
- Agregar amigo via invite_code → ver matches.

### Lo que NO testeamos
- Snapshot tests de UI (frágiles, ruido en PRs).
- Coverage targets numéricos.
- Tests del backend Supabase per se; testeamos las RLS via integration.

### CI
- GitHub Actions corre unit + integration en cada PR.
- E2E manual al cerrar features grandes.

## 12. Hitos sugeridos (para el plan)

1. Bootstrap del proyecto Expo + dependencies + theme.
2. Dataset de stickers.json (carga manual de los 670).
3. SQLite schema + carga inicial.
4. Pantalla de Álbum (read-only) con grilla y filtros.
5. Marcado local (tap/long-press) + animación.
6. Supabase setup: schema, RLS, RPC.
7. Sign-in con Apple + Google.
8. Onboarding (username).
9. Sync worker + queue.
10. Pantalla Home (progreso).
11. Pantalla de Cambios + share sheet.
12. Sistema de amigos (QR + búsqueda).
13. Realtime de matches.
14. Pulido visual (animaciones, glow, estrellas).
15. Testing crítico (auth, sync, RLS).
16. Build y publish a TestFlight + internal track de Google Play.
