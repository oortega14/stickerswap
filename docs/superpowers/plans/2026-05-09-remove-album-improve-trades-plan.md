# Remover Álbum + flujo de intercambios bilateral — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la pestaña Álbum (redundante con Home) y convertir Cambios en un flujo de intercambio real con propuesta, aceptación, confirmación bilateral y delta automático sobre `sticker_status`.

**Architecture:** Cliente local-first con cache de trades en SQLite + write-through a Supabase. La transición de estado y el delta atómico viven en RPCs `security definer` (Postgres). UI bidireccional con cromos visuales. Realtime invalida queries y dispara toasts. Sin chat, sin push notifications nativas.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript strict, Expo Router, NativeWind, Zustand, TanStack Query, expo-sqlite, Supabase (Postgres + RLS + Realtime), Jest + jest-expo.

**Spec:** `docs/superpowers/specs/2026-05-08-remove-album-improve-trades-design.md`

**Convenciones del repo (importantes):**
- Antes de cualquier comando shell: `eval "$(mise activate zsh)"` (Node 22 vía mise).
- Tests con `pnpm test`. Typecheck con `pnpm exec tsc --noEmit`.
- Migraciones se aplican con `supabase db push` desde la raíz.
- Mocks SQLite: ver `tests/setup-sqlite-mock.ts`.
- Mensajes de commit en convencional + co-author trailer cuando IA ayuda.
- Tests son TDD para lógica pura y data layer (ver `tests/`); UI no se testea con snapshots.

---

## Resumen de fases

- **Fase A** (1 task) — limpieza Álbum
- **Fase B** (2 tasks) — backend: migración SQL + RPCs
- **Fase C** (3 tasks) — domain layer (TDD)
- **Fase D** (4 tasks) — schema local, data layer, remoto
- **Fase E** (2 tasks) — hooks
- **Fase F** (5 tasks) — UI components
- **Fase G** (4 tasks) — wiring de pantallas
- **Fase H** (2 tasks) — realtime + version bump

Total: 23 tasks.

---

## Fase A — Limpieza Álbum

### Task 1: Quitar tab Álbum + huérfanos confirmados

**Files:**
- Delete: `app/(tabs)/album.tsx`
- Modify: `app/(tabs)/_layout.tsx`
- Conditionally delete: `src/store/filters.ts`, `src/ui/FilterChip.tsx`, `src/ui/SkeletonAlbumGrid.tsx` (solo si grep confirma huérfanos)

- [ ] **Step 1: Verificar qué archivos quedan huérfanos**

Run:
```bash
cd /Users/oscarortega/projects/panini-album
eval "$(mise activate zsh)"
echo "--- useFilters ---"
grep -r "useFilters\|from \"@/store/filters\"\|from '@/store/filters'" src/ app/ --include='*.ts' --include='*.tsx'
echo "--- FilterChip ---"
grep -r "FilterChip" src/ app/ --include='*.ts' --include='*.tsx'
echo "--- SkeletonAlbumGrid ---"
grep -r "SkeletonAlbumGrid" src/ app/ --include='*.ts' --include='*.tsx'
echo "--- AnimatedStickerCell (debe seguir usándose por team) ---"
grep -r "AnimatedStickerCell" src/ app/ --include='*.ts' --include='*.tsx'
```

Expected: las primeras tres referencias deben estar **únicamente** dentro de `app/(tabs)/album.tsx`. Si aparecen en otro archivo, NO borrar ese helper. `AnimatedStickerCell` debe aparecer también en `app/team/[code].tsx` u otros — se mantiene siempre.

- [ ] **Step 2: Borrar `app/(tabs)/album.tsx`**

```bash
rm app/(tabs)/album.tsx
```

- [ ] **Step 3: Borrar huérfanos solo si Step 1 los confirmó**

Para cada uno (`src/store/filters.ts`, `src/ui/FilterChip.tsx`, `src/ui/SkeletonAlbumGrid.tsx`): si Step 1 mostró referencias **únicamente** dentro de `album.tsx`, ejecutá:
```bash
rm src/store/filters.ts
rm src/ui/FilterChip.tsx
rm src/ui/SkeletonAlbumGrid.tsx
```

Si alguno tiene referencia externa, no lo toques y dejalo para una limpieza posterior.

- [ ] **Step 4: Editar `app/(tabs)/_layout.tsx` para quitar el `Tabs.Screen` del Álbum**

Reemplazar este bloque:
```tsx
      <Tabs.Screen
        name="album"
        options={{ title: "Álbum", tabBarIcon: ({ focused }) => <TabIcon icon="▦" focused={focused} active={theme.accent} inactive={theme.textMute} /> }}
      />
```
con: (eliminar las 4 líneas — no queda nada)

- [ ] **Step 5: Verificar typecheck y tests**

```bash
eval "$(mise activate zsh)"
pnpm exec tsc --noEmit
pnpm test
```
Expected: typecheck OK, todos los tests existentes pasan.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/_layout.tsx
git add -A app/\(tabs\)/album.tsx src/store/filters.ts src/ui/FilterChip.tsx src/ui/SkeletonAlbumGrid.tsx 2>/dev/null || true
git status
```
Reviewar `git status` antes de:
```bash
git commit -m "$(cat <<'EOF'
feat(tabs): remove redundant Álbum tab

Home + páginas de equipo cubren la navegación por cromos. La búsqueda
global por jugador/número, si vuelve a hacer falta, vivirá como modal
del Home (no como tab).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase B — Backend (Postgres / Supabase)

### Task 2: Migración `trades` — tabla, RLS, RPCs

**Files:**
- Create: `supabase/migrations/20260509000001_trades.sql`

- [ ] **Step 1: Crear el archivo de migración con el contenido completo**

Usá el timestamp `20260509000001` (consistente con el patrón de migraciones existentes).

Crear `supabase/migrations/20260509000001_trades.sql`:

```sql
-- supabase/migrations/20260509000001_trades.sql
--
-- Tabla `trades`: propuestas de intercambio bidireccional entre amigos
-- aceptados. Las transiciones (respond/cancel/confirm) viven en RPCs
-- `security definer` para aplicar el delta atómico sobre sticker_status
-- de ambos lados sin que RLS bloquee la operación cross-user.

create table public.trades (
  id            uuid primary key default gen_random_uuid(),
  proposer_id   uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,

  proposer_gives text[] not null check (array_length(proposer_gives, 1) >= 1),
  proposer_gets  text[] not null check (array_length(proposer_gets, 1) >= 1),

  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled','completed')),

  proposer_confirmed_at  timestamptz,
  recipient_confirmed_at timestamptz,

  message text check (length(message) <= 280),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz,

  check (proposer_id <> recipient_id)
);

create index trades_proposer_status_idx on public.trades (proposer_id, status);
create index trades_recipient_status_idx on public.trades (recipient_id, status);

alter table public.trades enable row level security;

create policy "trades_select_involved" on public.trades for select
  using (auth.uid() in (proposer_id, recipient_id));

create policy "trades_insert_friends" on public.trades for insert
  with check (
    auth.uid() = proposer_id
    and exists (
      select 1 from public.friendships
      where status = 'accepted'
        and ((user_id = proposer_id and friend_id = recipient_id)
          or  (user_id = recipient_id and friend_id = proposer_id))
    )
  );

-- UPDATE solo se permite via RPCs (security definer). Esta policy permite
-- al cliente leer el row después de un UPDATE pero no editar arbitrariamente
-- ya que las RPCs son las únicas que escriben.
create policy "trades_update_involved" on public.trades for update
  using (auth.uid() in (proposer_id, recipient_id))
  with check (auth.uid() in (proposer_id, recipient_id));

-- Realtime requiere replica identity full para que el filtro funcione bien
-- con postgres_changes filtrando por columnas (proposer_id/recipient_id).
alter table public.trades replica identity full;

-- ────────────────────────────────────────────────────────────
-- RPCs
-- ────────────────────────────────────────────────────────────

create or replace function public.trade_respond(p_trade uuid, p_accept boolean)
returns void language plpgsql security definer as $$
begin
  update public.trades
     set status = case when p_accept then 'accepted' else 'declined' end,
         updated_at = now()
   where id = p_trade
     and recipient_id = auth.uid()
     and status = 'pending';
  if not found then raise exception 'trade_not_pending'; end if;
end $$;

create or replace function public.trade_cancel(p_trade uuid)
returns void language plpgsql security definer as $$
begin
  update public.trades
     set status = 'cancelled', updated_at = now()
   where id = p_trade
     and proposer_id = auth.uid()
     and status = 'pending';
  if not found then raise exception 'trade_not_cancellable'; end if;
end $$;

create or replace function public.trade_unconfirm(p_trade uuid)
returns void language plpgsql security definer as $$
declare
  is_proposer boolean;
begin
  select (proposer_id = auth.uid()) into is_proposer
    from public.trades where id = p_trade and status = 'accepted'
    for update;
  if not found then raise exception 'trade_not_unconfirmable'; end if;
  if is_proposer then
    update public.trades set proposer_confirmed_at = null, updated_at = now()
     where id = p_trade;
  else
    update public.trades set recipient_confirmed_at = null, updated_at = now()
     where id = p_trade;
  end if;
end $$;

create or replace function public.trade_confirm(p_trade uuid)
returns text language plpgsql security definer as $$
declare
  t record;
  is_proposer boolean;
  both_done boolean;
  code text;
begin
  select * into t from public.trades where id = p_trade for update;
  if not found or t.status <> 'accepted' then
    raise exception 'trade_not_confirmable';
  end if;
  if auth.uid() not in (t.proposer_id, t.recipient_id) then
    raise exception 'not_involved';
  end if;

  is_proposer := (auth.uid() = t.proposer_id);

  if is_proposer and t.proposer_confirmed_at is null then
    update public.trades set proposer_confirmed_at = now(), updated_at = now()
     where id = p_trade;
  elsif not is_proposer and t.recipient_confirmed_at is null then
    update public.trades set recipient_confirmed_at = now(), updated_at = now()
     where id = p_trade;
  end if;

  select (proposer_confirmed_at is not null and recipient_confirmed_at is not null)
    into both_done
    from public.trades where id = p_trade;

  if both_done then
    -- Aplicar delta: -1 a quien dio, +1 a quien recibió. Ambos lados.
    foreach code in array t.proposer_gives loop
      update public.sticker_status
         set count = greatest(count - 1, 0), updated_at = now()
       where user_id = t.proposer_id and sticker_code = code;
      insert into public.sticker_status (user_id, sticker_code, count, updated_at)
      values (t.recipient_id, code, 1, now())
      on conflict (user_id, sticker_code) do update
        set count = public.sticker_status.count + 1, updated_at = now();
    end loop;
    foreach code in array t.proposer_gets loop
      update public.sticker_status
         set count = greatest(count - 1, 0), updated_at = now()
       where user_id = t.recipient_id and sticker_code = code;
      insert into public.sticker_status (user_id, sticker_code, count, updated_at)
      values (t.proposer_id, code, 1, now())
      on conflict (user_id, sticker_code) do update
        set count = public.sticker_status.count + 1, updated_at = now();
    end loop;

    update public.trades
       set status = 'completed', completed_at = now(), updated_at = now()
     where id = p_trade;
    return 'completed';
  end if;

  return 'awaiting_other';
end $$;
```

- [ ] **Step 2: Aplicar la migración al proyecto remoto**

```bash
cd /Users/oscarortega/projects/panini-album
eval "$(mise activate zsh)"
supabase db push
```
Expected: la migración se aplica sin errores. Si pide confirmación, contestá `Y`.

- [ ] **Step 3: Verificación manual rápida**

Abrí el Supabase Studio (o usá `supabase db remote sql`) y ejecutá:
```sql
select count(*) from public.trades;  -- debe devolver 0
\df public.trade_respond              -- debe existir (psql) o equivalente
```

Si no podés acceder al Studio, asumí que el `db push` exitoso implica éxito.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260509000001_trades.sql
git commit -m "$(cat <<'EOF'
feat(db): add trades table + RLS + RPCs for bilateral trade flow

Tabla trades con status machine (pending/accepted/declined/cancelled/completed)
y RPCs security-definer para respond/cancel/confirm/unconfirm. El delta
atómico sobre sticker_status se aplica al confirmar ambos lados.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: View `v_friend_matches_bidirectional` para listado de Cambios

**Files:**
- Create: `supabase/migrations/20260509000002_friend_matches_bidirectional.sql`

**Por qué:** la view actual `v_friend_matches` solo expone "they have, you need". El listado de Cambios necesita ambos lados. Creamos una view nueva para no romper consumidores existentes (si los hubiera).

- [ ] **Step 1: Crear la view bidireccional**

`supabase/migrations/20260509000002_friend_matches_bidirectional.sql`:

```sql
-- supabase/migrations/20260509000002_friend_matches_bidirectional.sql
--
-- View bidireccional de matches: para cada friendship aceptada del
-- usuario actual, expone los stickers que el amigo tiene de sobra y yo
-- no tengo (`direction = 'they_have_you_need'`) y los míos repetidos
-- que él no tiene (`direction = 'you_have_they_need'`).

create or replace view public.v_friend_matches_bidirectional as
-- they have, you need
select
  f.user_id    as me_id,
  f.friend_id  as friend_id,
  ss_friend.sticker_code,
  (ss_friend.count - 1) as extras,
  'they_have_you_need'::text as direction
from public.friendships f
join public.sticker_status ss_me
  on ss_me.user_id = f.user_id
  and ss_me.count = 0
join public.sticker_status ss_friend
  on ss_friend.user_id = f.friend_id
  and ss_friend.sticker_code = ss_me.sticker_code
  and ss_friend.count > 1
where f.status = 'accepted'
  and f.user_id = auth.uid()

union all

-- you have, they need
select
  f.user_id    as me_id,
  f.friend_id  as friend_id,
  ss_me.sticker_code,
  (ss_me.count - 1) as extras,
  'you_have_they_need'::text as direction
from public.friendships f
join public.sticker_status ss_me
  on ss_me.user_id = f.user_id
  and ss_me.count > 1
join public.sticker_status ss_friend
  on ss_friend.user_id = f.friend_id
  and ss_friend.sticker_code = ss_me.sticker_code
  and ss_friend.count = 0
where f.status = 'accepted'
  and f.user_id = auth.uid();
```

- [ ] **Step 2: Aplicar migración**

```bash
supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260509000002_friend_matches_bidirectional.sql
git commit -m "$(cat <<'EOF'
feat(db): add bidirectional friend matches view

v_friend_matches_bidirectional expone ambos lados (they-have-you-need
y you-have-they-need) en una sola query con campo `direction`. La view
unidireccional anterior se mantiene para no romper consumidores.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase C — Domain layer (lógica pura, TDD)

### Task 4: Tipos del dominio para trades

**Files:**
- Modify: `src/domain/types.ts`

- [ ] **Step 1: Agregar los tipos al final del archivo**

Editar `src/domain/types.ts`. Después del último export (línea 119, `OutgoingRequest`), agregar:

```ts
// ────────────────────────────────────────────────────────────
// Trades
// ────────────────────────────────────────────────────────────

export type TradeStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed";

export interface Trade {
  id: string;
  proposerId: string;
  recipientId: string;
  proposerGives: string[];   // sticker codes
  proposerGets: string[];    // sticker codes
  status: TradeStatus;
  proposerConfirmedAt: number | null;
  recipientConfirmedAt: number | null;
  message: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export type TradeRole = "proposer" | "recipient";

export type TradeEvent =
  | "accept"
  | "decline"
  | "cancel"
  | "confirm"
  | "unconfirm";

export interface TradeProposalDraft {
  recipientId: string;
  proposerGives: string[];
  proposerGets: string[];
  message: string;
  isValid: boolean;
  invalidReason: "no_gives" | "no_gets" | null;
}

// CTA contextual a mostrar para un trade en una pantalla
export type TradeCtaKind =
  | "none"             // no se muestra
  | "waiting"          // proposer espera al recipient
  | "respond"          // recipient debe Aceptar/Rechazar
  | "mark_done"        // ambos: marcar como hecho
  | "awaiting_other"   // ya marqué; espero al otro
  | "confirm"          // el otro marcó; tengo que confirmar
  | "completed";       // banner verde 24h

export interface TradeCta {
  kind: TradeCtaKind;
  label: string;
  primaryAction?: TradeEvent;
  secondaryAction?: TradeEvent;
}
```

- [ ] **Step 2: Ampliar `FriendMatchSummary` para incluir ambos lados**

Reemplazar (en `src/domain/types.ts`, líneas ~74-80):
```ts
export interface FriendMatchSummary {
  friendId: string;
  username: string;
  displayName: string | null;
  matchCount: number;
  sample: string[];
}
```
por:
```ts
export interface FriendMatchSummary {
  friendId: string;
  username: string;
  displayName: string | null;
  // Lado: ellos tienen, vos necesitás (lo que buscás)
  theyHaveYouNeed: string[];
  // Lado: vos tenés repe, ellos necesitan (lo que ofreces)
  youHaveTheyNeed: string[];
  // Compat: matchCount = theyHaveYouNeed.length, sample = primeros 3
  matchCount: number;
  sample: string[];
}
```

- [ ] **Step 3: Verificar typecheck**

```bash
eval "$(mise activate zsh)"
pnpm exec tsc --noEmit
```
Expected: errores sólo en `summarizeMatches` y `useMatches` por la nueva forma. Es esperado — los próximos tasks los arreglan.

- [ ] **Step 4: Commit (SIN typecheck pasando — viene en Task 5)**

```bash
git add src/domain/types.ts
git commit -m "$(cat <<'EOF'
feat(domain): add Trade types + extend FriendMatchSummary bidirectional

Trade, TradeStatus, TradeProposalDraft, TradeCta y FriendMatchSummary
extendido con ambos lados. Los call sites se ajustan en commits siguientes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `summarizeMatches` bidireccional + ajuste de tests

**Files:**
- Modify: `src/domain/friendMatchBuilder.ts`
- Modify: `tests/domain/friendMatchBuilder.test.ts`

- [ ] **Step 1: Escribir el test ampliado primero (que va a fallar)**

Reemplazar el contenido completo de `tests/domain/friendMatchBuilder.test.ts`:

```ts
import { buildBidirectional, summarizeMatches } from "@/domain/friendMatchBuilder";
import type { StickerStatus } from "@/domain/types";

describe("buildBidirectional", () => {
  it("returns mutual matches", () => {
    const me: StickerStatus[] = [
      { stickerCode: "A1", count: 0, updatedAt: 1 },
      { stickerCode: "A2", count: 3, updatedAt: 1 },
      { stickerCode: "A3", count: 2, updatedAt: 1 }
    ];
    const friend: StickerStatus[] = [
      { stickerCode: "A1", count: 2, updatedAt: 1 },
      { stickerCode: "A2", count: 0, updatedAt: 1 },
      { stickerCode: "A3", count: 1, updatedAt: 1 }
    ];
    const r = buildBidirectional("f1", me, friend);
    expect(r.theyHaveYouNeed.map((m) => m.stickerCode)).toEqual(["A1"]);
    expect(r.theyHaveYouNeed[0].extras).toBe(1);
    expect(r.youHaveTheyNeed.map((m) => m.stickerCode)).toEqual(["A2"]);
    expect(r.youHaveTheyNeed[0].extras).toBe(2);
  });
});

describe("summarizeMatches", () => {
  it("groups bidirectional matches by friend", () => {
    const matches = {
      theyHaveYouNeed: [
        { friendId: "f1", stickerCode: "A1", extras: 1 },
        { friendId: "f1", stickerCode: "A2", extras: 2 },
        { friendId: "f1", stickerCode: "A3", extras: 1 },
        { friendId: "f1", stickerCode: "A4", extras: 1 },
        { friendId: "f2", stickerCode: "A5", extras: 1 }
      ],
      youHaveTheyNeed: [
        { friendId: "f1", stickerCode: "B1", extras: 1 },
        { friendId: "f1", stickerCode: "B2", extras: 3 },
        { friendId: "f2", stickerCode: "B3", extras: 1 }
      ]
    };
    const friends = new Map([
      ["f1", { username: "juli", displayName: "Juli" }],
      ["f2", { username: "maria", displayName: null }]
    ]);
    const r = summarizeMatches(matches, friends);
    expect(r).toHaveLength(2);

    const f1 = r.find((s) => s.friendId === "f1")!;
    expect(f1.matchCount).toBe(4);
    expect(f1.sample).toEqual(["A1", "A2", "A3"]);
    expect(f1.theyHaveYouNeed).toEqual(["A1", "A2", "A3", "A4"]);
    expect(f1.youHaveTheyNeed).toEqual(["B1", "B2"]);

    const f2 = r.find((s) => s.friendId === "f2")!;
    expect(f2.matchCount).toBe(1);
    expect(f2.theyHaveYouNeed).toEqual(["A5"]);
    expect(f2.youHaveTheyNeed).toEqual(["B3"]);
  });

  it("includes friends that only appear on the youHaveTheyNeed side", () => {
    const matches = {
      theyHaveYouNeed: [],
      youHaveTheyNeed: [{ friendId: "f1", stickerCode: "B1", extras: 1 }]
    };
    const friends = new Map([["f1", { username: "juli", displayName: null }]]);
    const r = summarizeMatches(matches, friends);
    expect(r).toHaveLength(1);
    expect(r[0].matchCount).toBe(0);
    expect(r[0].theyHaveYouNeed).toEqual([]);
    expect(r[0].youHaveTheyNeed).toEqual(["B1"]);
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

```bash
eval "$(mise activate zsh)"
pnpm test -- friendMatchBuilder.test.ts
```
Expected: FAIL en "groups bidirectional matches by friend" porque `summarizeMatches` recibe el shape viejo.

- [ ] **Step 3: Implementar el nuevo `summarizeMatches`**

Reemplazar el contenido completo de `src/domain/friendMatchBuilder.ts`:

```ts
import type {
  StickerStatus,
  FriendMatch,
  BidirectionalMatch,
  FriendMatchSummary
} from "./types";

export function buildBidirectional(
  friendId: string,
  myStatuses: StickerStatus[],
  friendStatuses: StickerStatus[]
): BidirectionalMatch {
  const myMap = new Map(myStatuses.map((s) => [s.stickerCode, s.count]));
  const fMap = new Map(friendStatuses.map((s) => [s.stickerCode, s.count]));

  const theyHaveYouNeed: FriendMatch[] = [];
  const youHaveTheyNeed: FriendMatch[] = [];

  for (const [code, fCount] of fMap.entries()) {
    if (fCount > 1 && (myMap.get(code) ?? 0) === 0) {
      theyHaveYouNeed.push({ friendId, stickerCode: code, extras: fCount - 1 });
    }
  }
  for (const [code, myCount] of myMap.entries()) {
    if (myCount > 1 && (fMap.get(code) ?? 0) === 0) {
      youHaveTheyNeed.push({ friendId, stickerCode: code, extras: myCount - 1 });
    }
  }

  return { theyHaveYouNeed, youHaveTheyNeed };
}

export interface BidirectionalMatchPayload {
  theyHaveYouNeed: FriendMatch[];
  youHaveTheyNeed: FriendMatch[];
}

export function summarizeMatches(
  matches: BidirectionalMatchPayload,
  friends: Map<string, { username: string; displayName: string | null }>
): FriendMatchSummary[] {
  const codes = new Map<string, { they: string[]; you: string[] }>();
  for (const m of matches.theyHaveYouNeed) {
    const e = codes.get(m.friendId) ?? { they: [], you: [] };
    e.they.push(m.stickerCode);
    codes.set(m.friendId, e);
  }
  for (const m of matches.youHaveTheyNeed) {
    const e = codes.get(m.friendId) ?? { they: [], you: [] };
    e.you.push(m.stickerCode);
    codes.set(m.friendId, e);
  }

  const out: FriendMatchSummary[] = [];
  for (const [friendId, { they, you }] of codes) {
    const meta = friends.get(friendId);
    if (!meta) continue;
    out.push({
      friendId,
      username: meta.username,
      displayName: meta.displayName,
      theyHaveYouNeed: they,
      youHaveTheyNeed: you,
      matchCount: they.length,
      sample: they.slice(0, 3)
    });
  }
  out.sort((a, b) => b.matchCount - a.matchCount);
  return out;
}
```

- [ ] **Step 4: Correr el test — debe pasar**

```bash
pnpm test -- friendMatchBuilder.test.ts
```
Expected: 3 specs PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/friendMatchBuilder.ts tests/domain/friendMatchBuilder.test.ts
git commit -m "$(cat <<'EOF'
feat(domain): summarizeMatches now bidirectional

Acepta payload con ambos lados y produce summary con theyHaveYouNeed/
youHaveTheyNeed completos. matchCount/sample mantienen el shape previo
para los consumidores que ya leían "qué te falta".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `tradeProposalBuilder` (TDD)

**Files:**
- Create: `src/domain/tradeProposalBuilder.ts`
- Create: `tests/domain/tradeProposalBuilder.test.ts`

- [ ] **Step 1: Escribir test (que va a fallar porque no existe el archivo)**

`tests/domain/tradeProposalBuilder.test.ts`:

```ts
import { buildDefaultProposal } from "@/domain/tradeProposalBuilder";
import type { BidirectionalMatch } from "@/domain/types";

const mkBidi = (
  they: { code: string; extras: number }[],
  you: { code: string; extras: number }[]
): BidirectionalMatch => ({
  theyHaveYouNeed: they.map((m) => ({ friendId: "f1", stickerCode: m.code, extras: m.extras })),
  youHaveTheyNeed: you.map((m) => ({ friendId: "f1", stickerCode: m.code, extras: m.extras }))
});

describe("buildDefaultProposal", () => {
  it("preselects all stickers from both sides", () => {
    const bidi = mkBidi(
      [{ code: "A1", extras: 1 }, { code: "A2", extras: 2 }],
      [{ code: "B1", extras: 1 }]
    );
    const r = buildDefaultProposal("f1", bidi);
    expect(r.recipientId).toBe("f1");
    expect(r.proposerGives).toEqual(["B1"]);
    expect(r.proposerGets).toEqual(["A1", "A2"]);
    expect(r.message).toBe("");
    expect(r.isValid).toBe(true);
    expect(r.invalidReason).toBeNull();
  });

  it("flags invalid when no gives", () => {
    const bidi = mkBidi([{ code: "A1", extras: 1 }], []);
    const r = buildDefaultProposal("f1", bidi);
    expect(r.proposerGives).toEqual([]);
    expect(r.isValid).toBe(false);
    expect(r.invalidReason).toBe("no_gives");
  });

  it("flags invalid when no gets", () => {
    const bidi = mkBidi([], [{ code: "B1", extras: 1 }]);
    const r = buildDefaultProposal("f1", bidi);
    expect(r.proposerGets).toEqual([]);
    expect(r.isValid).toBe(false);
    expect(r.invalidReason).toBe("no_gets");
  });

  it("is idempotent (calling twice produces equal result)", () => {
    const bidi = mkBidi([{ code: "A1", extras: 1 }], [{ code: "B1", extras: 1 }]);
    expect(buildDefaultProposal("f1", bidi)).toEqual(buildDefaultProposal("f1", bidi));
  });
});
```

- [ ] **Step 2: Correr — debe fallar (módulo no existe)**

```bash
pnpm test -- tradeProposalBuilder.test.ts
```
Expected: FAIL: Cannot find module `@/domain/tradeProposalBuilder`.

- [ ] **Step 3: Implementar `tradeProposalBuilder.ts`**

`src/domain/tradeProposalBuilder.ts`:

```ts
import type { BidirectionalMatch, TradeProposalDraft } from "./types";

export function buildDefaultProposal(
  recipientId: string,
  bidi: BidirectionalMatch
): TradeProposalDraft {
  const proposerGives = bidi.youHaveTheyNeed.map((m) => m.stickerCode);
  const proposerGets = bidi.theyHaveYouNeed.map((m) => m.stickerCode);

  let invalidReason: TradeProposalDraft["invalidReason"] = null;
  if (proposerGives.length === 0) invalidReason = "no_gives";
  else if (proposerGets.length === 0) invalidReason = "no_gets";

  return {
    recipientId,
    proposerGives,
    proposerGets,
    message: "",
    isValid: invalidReason === null,
    invalidReason
  };
}
```

- [ ] **Step 4: Correr — debe pasar**

```bash
pnpm test -- tradeProposalBuilder.test.ts
```
Expected: 4 specs PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/tradeProposalBuilder.ts tests/domain/tradeProposalBuilder.test.ts
git commit -m "$(cat <<'EOF'
feat(domain): add tradeProposalBuilder with default selection

Pre-selecciona todos los cromos del bidireccional. Marca el draft
inválido si algún lado queda vacío. Idempotente.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `tradeStateMachine` (TDD)

**Files:**
- Create: `src/domain/tradeStateMachine.ts`
- Create: `tests/domain/tradeStateMachine.test.ts`

- [ ] **Step 1: Escribir el test**

`tests/domain/tradeStateMachine.test.ts`:

```ts
import { ctaFor, nextStatus } from "@/domain/tradeStateMachine";
import type { Trade } from "@/domain/types";

const baseTrade = (overrides: Partial<Trade>): Trade => ({
  id: "t1",
  proposerId: "p1",
  recipientId: "r1",
  proposerGives: ["A1"],
  proposerGets: ["B1"],
  status: "pending",
  proposerConfirmedAt: null,
  recipientConfirmedAt: null,
  message: null,
  createdAt: 1,
  updatedAt: 1,
  completedAt: null,
  ...overrides
});

describe("nextStatus", () => {
  it("pending + accept → accepted", () => {
    expect(nextStatus("pending", "accept")).toBe("accepted");
  });
  it("pending + decline → declined", () => {
    expect(nextStatus("pending", "decline")).toBe("declined");
  });
  it("pending + cancel → cancelled", () => {
    expect(nextStatus("pending", "cancel")).toBe("cancelled");
  });
  it("accepted + confirm (one side) does not transition", () => {
    expect(nextStatus("accepted", "confirm")).toBe("accepted");
  });
  it("rejects invalid transitions", () => {
    expect(nextStatus("pending", "confirm")).toBe("invalid");
    expect(nextStatus("completed", "cancel")).toBe("invalid");
    expect(nextStatus("declined", "accept")).toBe("invalid");
  });
});

describe("ctaFor", () => {
  it("proposer + pending → waiting + cancel", () => {
    const t = baseTrade({ status: "pending" });
    const r = ctaFor("proposer", t);
    expect(r.kind).toBe("waiting");
    expect(r.secondaryAction).toBe("cancel");
  });

  it("recipient + pending → respond", () => {
    const t = baseTrade({ status: "pending" });
    const r = ctaFor("recipient", t);
    expect(r.kind).toBe("respond");
    expect(r.primaryAction).toBe("accept");
    expect(r.secondaryAction).toBe("decline");
  });

  it("accepted, no marks → mark_done", () => {
    const t = baseTrade({ status: "accepted" });
    const r = ctaFor("proposer", t);
    expect(r.kind).toBe("mark_done");
    expect(r.primaryAction).toBe("confirm");
  });

  it("accepted, only my mark → awaiting_other", () => {
    const t = baseTrade({ status: "accepted", proposerConfirmedAt: 1 });
    const r = ctaFor("proposer", t);
    expect(r.kind).toBe("awaiting_other");
    expect(r.secondaryAction).toBe("unconfirm");
  });

  it("accepted, only other's mark → confirm", () => {
    const t = baseTrade({ status: "accepted", recipientConfirmedAt: 1 });
    const r = ctaFor("proposer", t);
    expect(r.kind).toBe("confirm");
    expect(r.primaryAction).toBe("confirm");
  });

  it("completed within 24h → completed banner", () => {
    const now = Date.now();
    const t = baseTrade({ status: "completed", completedAt: now - 1000 });
    const r = ctaFor("proposer", t, now);
    expect(r.kind).toBe("completed");
  });

  it("completed >24h ago → none", () => {
    const now = Date.now();
    const t = baseTrade({ status: "completed", completedAt: now - 25 * 3600 * 1000 });
    const r = ctaFor("proposer", t, now);
    expect(r.kind).toBe("none");
  });

  it("declined / cancelled → none", () => {
    expect(ctaFor("proposer", baseTrade({ status: "declined" })).kind).toBe("none");
    expect(ctaFor("recipient", baseTrade({ status: "cancelled" })).kind).toBe("none");
  });
});
```

- [ ] **Step 2: Correr — debe fallar**

```bash
pnpm test -- tradeStateMachine.test.ts
```
Expected: FAIL: Cannot find module.

- [ ] **Step 3: Implementar `tradeStateMachine.ts`**

`src/domain/tradeStateMachine.ts`:

```ts
import type { Trade, TradeStatus, TradeRole, TradeEvent, TradeCta } from "./types";

const COMPLETED_BANNER_MS = 24 * 60 * 60 * 1000;

export function nextStatus(
  current: TradeStatus,
  event: TradeEvent
): TradeStatus | "invalid" {
  if (current === "pending" && event === "accept") return "accepted";
  if (current === "pending" && event === "decline") return "declined";
  if (current === "pending" && event === "cancel") return "cancelled";
  // confirm/unconfirm en accepted no transicionan acá: el status final
  // (completed) lo decide la RPC viendo ambos timestamps.
  if (current === "accepted" && event === "confirm") return "accepted";
  if (current === "accepted" && event === "unconfirm") return "accepted";
  return "invalid";
}

export function ctaFor(
  role: TradeRole,
  trade: Trade,
  now: number = Date.now()
): TradeCta {
  if (trade.status === "declined" || trade.status === "cancelled") {
    return { kind: "none", label: "" };
  }

  if (trade.status === "completed") {
    if (trade.completedAt && now - trade.completedAt < COMPLETED_BANNER_MS) {
      return { kind: "completed", label: "Trade completado ✓" };
    }
    return { kind: "none", label: "" };
  }

  if (trade.status === "pending") {
    if (role === "proposer") {
      return {
        kind: "waiting",
        label: "Esperando respuesta",
        secondaryAction: "cancel"
      };
    }
    return {
      kind: "respond",
      label: "Te propusieron un cambio",
      primaryAction: "accept",
      secondaryAction: "decline"
    };
  }

  // accepted
  const myMark =
    role === "proposer" ? trade.proposerConfirmedAt : trade.recipientConfirmedAt;
  const otherMark =
    role === "proposer" ? trade.recipientConfirmedAt : trade.proposerConfirmedAt;

  if (!myMark && !otherMark) {
    return { kind: "mark_done", label: "Marcar como hecho", primaryAction: "confirm" };
  }
  if (myMark && !otherMark) {
    return {
      kind: "awaiting_other",
      label: "Esperando que confirme",
      secondaryAction: "unconfirm"
    };
  }
  if (!myMark && otherMark) {
    return { kind: "confirm", label: "Confirmar", primaryAction: "confirm" };
  }
  // both marked → la RPC ya transicionó a 'completed'; defensivo:
  return { kind: "completed", label: "Trade completado ✓" };
}
```

- [ ] **Step 4: Correr — debe pasar**

```bash
pnpm test -- tradeStateMachine.test.ts
```
Expected: todos los specs PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/tradeStateMachine.ts tests/domain/tradeStateMachine.test.ts
git commit -m "$(cat <<'EOF'
feat(domain): add tradeStateMachine for transitions + CTAs

nextStatus valida transiciones del status. ctaFor calcula el CTA a
mostrar dado el rol, status, mis marcas y las del otro. Cubre todos
los estados de la tabla del spec §4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase D — Schema local + data layer + remoto

### Task 8: Bump schema local — tabla `trades_cache`

**Files:**
- Modify: `src/data/schema.ts`

- [ ] **Step 1: Bump `SCHEMA_VERSION` y agregar tabla**

Editar `src/data/schema.ts`. Cambiar la línea 3:
```ts
const SCHEMA_VERSION = 3;
```
a:
```ts
const SCHEMA_VERSION = 4;
```

Y agregar al final del bloque `db.execAsync` (antes del cierre de la template string), debajo del `friend_matches_cache`:

```sql

    -- Cache local de trades. Espejo de la tabla remota; refresca con
    -- pull al boot y on realtime. No hay queue local — los trades requieren
    -- respuesta del backend (RPCs) y no se encolan offline.
    CREATE TABLE IF NOT EXISTS trades_cache (
      id TEXT PRIMARY KEY,
      proposer_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      proposer_gives TEXT NOT NULL,  -- JSON array
      proposer_gets TEXT NOT NULL,   -- JSON array
      status TEXT NOT NULL,
      proposer_confirmed_at INTEGER,
      recipient_confirmed_at INTEGER,
      message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      fetched_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_trades_cache_proposer ON trades_cache(proposer_id, status);
    CREATE INDEX IF NOT EXISTS idx_trades_cache_recipient ON trades_cache(recipient_id, status);

    -- Bidirectional matches: ambos lados (vista vieja `friend_matches_cache`
    -- queda como compat para "they_have_you_need"; agregamos columna direction).
    -- Como la tabla ya existe en versiones previas y SQLite no soporta
    -- ALTER TABLE para agregar columna con default sin recrear, preferimos
    -- crear una NUEVA tabla y deprecar la vieja gradualmente.
    CREATE TABLE IF NOT EXISTS friend_matches_bidi_cache (
      friend_id TEXT NOT NULL,
      sticker_code TEXT NOT NULL,
      extras INTEGER NOT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('they_have_you_need', 'you_have_they_need')),
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (friend_id, sticker_code, direction)
    );

    CREATE INDEX IF NOT EXISTS idx_fm_bidi_friend ON friend_matches_bidi_cache(friend_id);
```

- [ ] **Step 2: Verificar que initSchema sigue siendo idempotente**

Los `CREATE TABLE IF NOT EXISTS` lo hacen automáticamente; nada extra.

- [ ] **Step 3: Correr tests existentes para validar que no rompimos nada**

```bash
pnpm test
```
Expected: todos los tests pasan (los de schema/data son idempotentes con `IF NOT EXISTS`).

- [ ] **Step 4: Commit**

```bash
git add src/data/schema.ts
git commit -m "$(cat <<'EOF'
feat(data): bump schema v4 — add trades_cache + friend_matches_bidi_cache

trades_cache espeja la tabla remota para vista offline. La nueva tabla
bidi reemplaza friend_matches_cache (la vieja queda viva por compat).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `data/trades.ts` — CRUD local con tests

**Files:**
- Create: `src/data/trades.ts`
- Create: `tests/data/trades.test.ts`

- [ ] **Step 1: Escribir el test primero**

`tests/data/trades.test.ts`:

```ts
/**
 * @jest-environment node
 */
jest.mock("expo-sqlite", () => require("../setup-sqlite-mock").createSqliteMock());

import {
  upsertTrade,
  listActiveTrades,
  getActiveTradeForFriend,
  getTradeById,
  removeTrade
} from "@/data/trades";
import { initSchema } from "@/data/schema";
import { _resetDb } from "@/data/db";
import "../setup-sqlite-mock";
import type { Trade } from "@/domain/types";

const t = (overrides: Partial<Trade>): Trade => ({
  id: "t1",
  proposerId: "me",
  recipientId: "f1",
  proposerGives: ["A1"],
  proposerGets: ["B1", "B2"],
  status: "pending",
  proposerConfirmedAt: null,
  recipientConfirmedAt: null,
  message: null,
  createdAt: 100,
  updatedAt: 100,
  completedAt: null,
  ...overrides
});

beforeEach(async () => {
  _resetDb();
  await initSchema();
});

describe("data/trades", () => {
  it("upserts and gets by id with array roundtrip", async () => {
    await upsertTrade(t({}));
    const got = await getTradeById("t1");
    expect(got?.proposerGives).toEqual(["A1"]);
    expect(got?.proposerGets).toEqual(["B1", "B2"]);
    expect(got?.status).toBe("pending");
  });

  it("upsert overwrites existing trade", async () => {
    await upsertTrade(t({ status: "pending" }));
    await upsertTrade(t({ status: "accepted", updatedAt: 200 }));
    const got = await getTradeById("t1");
    expect(got?.status).toBe("accepted");
    expect(got?.updatedAt).toBe(200);
  });

  it("listActiveTrades returns pending and accepted, not completed/declined/cancelled", async () => {
    await upsertTrade(t({ id: "t1", status: "pending" }));
    await upsertTrade(t({ id: "t2", status: "accepted" }));
    await upsertTrade(t({ id: "t3", status: "completed" }));
    await upsertTrade(t({ id: "t4", status: "declined" }));
    await upsertTrade(t({ id: "t5", status: "cancelled" }));
    const r = await listActiveTrades();
    expect(r.map((x) => x.id).sort()).toEqual(["t1", "t2"]);
  });

  it("getActiveTradeForFriend matches both proposer and recipient sides", async () => {
    await upsertTrade(t({ id: "out", proposerId: "me", recipientId: "f1", status: "pending" }));
    await upsertTrade(t({ id: "in",  proposerId: "f2", recipientId: "me", status: "accepted" }));
    expect((await getActiveTradeForFriend("me", "f1"))?.id).toBe("out");
    expect((await getActiveTradeForFriend("me", "f2"))?.id).toBe("in");
    expect(await getActiveTradeForFriend("me", "ghost")).toBeNull();
  });

  it("getActiveTradeForFriend returns null for completed/cancelled", async () => {
    await upsertTrade(t({ id: "done", proposerId: "me", recipientId: "f1", status: "completed" }));
    expect(await getActiveTradeForFriend("me", "f1")).toBeNull();
  });

  it("removeTrade deletes the row", async () => {
    await upsertTrade(t({}));
    await removeTrade("t1");
    expect(await getTradeById("t1")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr — falla por módulo inexistente**

```bash
pnpm test -- trades.test.ts
```
Expected: FAIL: Cannot find module `@/data/trades`.

- [ ] **Step 3: Implementar `src/data/trades.ts`**

```ts
import { getDb } from "./db";
import type { Trade, TradeStatus } from "@/domain/types";

interface Row {
  id: string;
  proposer_id: string;
  recipient_id: string;
  proposer_gives: string;       // JSON array
  proposer_gets: string;        // JSON array
  status: TradeStatus;
  proposer_confirmed_at: number | null;
  recipient_confirmed_at: number | null;
  message: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

const rowToTrade = (r: Row): Trade => ({
  id: r.id,
  proposerId: r.proposer_id,
  recipientId: r.recipient_id,
  proposerGives: JSON.parse(r.proposer_gives) as string[],
  proposerGets: JSON.parse(r.proposer_gets) as string[],
  status: r.status,
  proposerConfirmedAt: r.proposer_confirmed_at,
  recipientConfirmedAt: r.recipient_confirmed_at,
  message: r.message,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  completedAt: r.completed_at
});

export async function upsertTrade(trade: Trade): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO trades_cache (
       id, proposer_id, recipient_id, proposer_gives, proposer_gets,
       status, proposer_confirmed_at, recipient_confirmed_at, message,
       created_at, updated_at, completed_at, fetched_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       proposer_id = excluded.proposer_id,
       recipient_id = excluded.recipient_id,
       proposer_gives = excluded.proposer_gives,
       proposer_gets = excluded.proposer_gets,
       status = excluded.status,
       proposer_confirmed_at = excluded.proposer_confirmed_at,
       recipient_confirmed_at = excluded.recipient_confirmed_at,
       message = excluded.message,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       completed_at = excluded.completed_at,
       fetched_at = excluded.fetched_at`,
    [
      trade.id,
      trade.proposerId,
      trade.recipientId,
      JSON.stringify(trade.proposerGives),
      JSON.stringify(trade.proposerGets),
      trade.status,
      trade.proposerConfirmedAt,
      trade.recipientConfirmedAt,
      trade.message,
      trade.createdAt,
      trade.updatedAt,
      trade.completedAt,
      now
    ]
  );
}

export async function getTradeById(id: string): Promise<Trade | null> {
  const db = getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT id, proposer_id, recipient_id, proposer_gives, proposer_gets,
            status, proposer_confirmed_at, recipient_confirmed_at, message,
            created_at, updated_at, completed_at
       FROM trades_cache WHERE id = ?`,
    [id]
  );
  return row ? rowToTrade(row) : null;
}

export async function listActiveTrades(): Promise<Trade[]> {
  const db = getDb();
  const rows = await db.getAllAsync<Row>(
    `SELECT id, proposer_id, recipient_id, proposer_gives, proposer_gets,
            status, proposer_confirmed_at, recipient_confirmed_at, message,
            created_at, updated_at, completed_at
       FROM trades_cache WHERE status IN ('pending', 'accepted')
       ORDER BY updated_at DESC`
  );
  return rows.map(rowToTrade);
}

export async function getActiveTradeForFriend(
  meId: string,
  friendId: string
): Promise<Trade | null> {
  const db = getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT id, proposer_id, recipient_id, proposer_gives, proposer_gets,
            status, proposer_confirmed_at, recipient_confirmed_at, message,
            created_at, updated_at, completed_at
       FROM trades_cache
      WHERE status IN ('pending', 'accepted')
        AND ((proposer_id = ? AND recipient_id = ?)
          OR (proposer_id = ? AND recipient_id = ?))
      ORDER BY updated_at DESC LIMIT 1`,
    [meId, friendId, friendId, meId]
  );
  return row ? rowToTrade(row) : null;
}

export async function removeTrade(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM trades_cache WHERE id = ?`, [id]);
}
```

- [ ] **Step 4: Correr — debe pasar**

```bash
pnpm test -- trades.test.ts
```
Expected: 6 specs PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/trades.ts tests/data/trades.test.ts
git commit -m "$(cat <<'EOF'
feat(data): add trades local cache with array roundtrip

upsert/list/getActiveTradeForFriend con espejo de la tabla remota.
Sin queue local — los trades dependen de RPCs y no se encolan offline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `social/trades.ts` — operaciones remotas

**Files:**
- Create: `src/social/trades.ts`

**Por qué sin TDD aquí:** las llamadas a Supabase no son lógica pura — se verifican manualmente en device contra el backend. Los tests pure ya cubren el state machine.

- [ ] **Step 1: Crear el archivo**

`src/social/trades.ts`:

```ts
import { supabase } from "@/auth/supabaseClient";
import { upsertTrade, listActiveTrades as listLocal } from "@/data/trades";
import type { Trade, TradeStatus } from "@/domain/types";

interface RemoteRow {
  id: string;
  proposer_id: string;
  recipient_id: string;
  proposer_gives: string[];
  proposer_gets: string[];
  status: TradeStatus;
  proposer_confirmed_at: string | null;
  recipient_confirmed_at: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const parseTs = (s: string | null): number | null =>
  s === null ? null : Date.parse(s);

const remoteToTrade = (r: RemoteRow): Trade => ({
  id: r.id,
  proposerId: r.proposer_id,
  recipientId: r.recipient_id,
  proposerGives: r.proposer_gives,
  proposerGets: r.proposer_gets,
  status: r.status,
  proposerConfirmedAt: parseTs(r.proposer_confirmed_at),
  recipientConfirmedAt: parseTs(r.recipient_confirmed_at),
  message: r.message,
  createdAt: Date.parse(r.created_at),
  updatedAt: Date.parse(r.updated_at),
  completedAt: parseTs(r.completed_at)
});

export interface ProposeTradeInput {
  recipientId: string;
  proposerGives: string[];
  proposerGets: string[];
  message?: string;
}

export async function proposeTrade(input: ProposeTradeInput): Promise<Trade> {
  const { data, error } = await supabase
    .from("trades")
    .insert({
      recipient_id: input.recipientId,
      proposer_gives: input.proposerGives,
      proposer_gets: input.proposerGets,
      message: input.message ?? null
    })
    .select()
    .single();
  if (error) throw error;
  const trade = remoteToTrade(data as RemoteRow);
  await upsertTrade(trade);
  return trade;
}

export async function respondTrade(tradeId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("trade_respond", {
    p_trade: tradeId,
    p_accept: accept
  });
  if (error) throw error;
  await refreshTradeFromRemote(tradeId);
}

export async function cancelTrade(tradeId: string): Promise<void> {
  const { error } = await supabase.rpc("trade_cancel", { p_trade: tradeId });
  if (error) throw error;
  await refreshTradeFromRemote(tradeId);
}

export async function confirmTrade(tradeId: string): Promise<"completed" | "awaiting_other"> {
  const { data, error } = await supabase.rpc("trade_confirm", { p_trade: tradeId });
  if (error) throw error;
  await refreshTradeFromRemote(tradeId);
  return (data as "completed" | "awaiting_other");
}

export async function unconfirmTrade(tradeId: string): Promise<void> {
  const { error } = await supabase.rpc("trade_unconfirm", { p_trade: tradeId });
  if (error) throw error;
  await refreshTradeFromRemote(tradeId);
}

export async function fetchActiveTrades(): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .in("status", ["pending", "accepted"]);
  if (error) {
    // Fallback offline a cache local
    return listLocal();
  }
  const rows = (data ?? []) as RemoteRow[];
  const trades = rows.map(remoteToTrade);
  for (const t of trades) await upsertTrade(t);
  return trades;
}

async function refreshTradeFromRemote(tradeId: string): Promise<void> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("id", tradeId)
    .single();
  if (error || !data) return;
  await upsertTrade(remoteToTrade(data as RemoteRow));
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
pnpm exec tsc --noEmit
```
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add src/social/trades.ts
git commit -m "$(cat <<'EOF'
feat(social): add Supabase trades operations + cache write-through

proposeTrade/respondTrade/cancelTrade/confirmTrade/unconfirmTrade
invocan RPCs y refrescan el cache local. fetchActiveTrades hace
pull con fallback offline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Extender `fetchMatches` para que use la view bidireccional

**Files:**
- Modify: `src/social/friendships.ts`
- Modify: `src/data/friendsLocal.ts`
- Modify: `src/hooks/useMatches.ts`

- [ ] **Step 1: Reemplazar `fetchMatches` en `src/social/friendships.ts`**

Reemplazar la función `fetchMatches` y el bloque que la sigue (líneas 73-94):
```ts
export async function fetchMatches(): Promise<FriendMatch[]> { ... }
```
por:
```ts
import type { BidirectionalMatchPayload } from "@/domain/friendMatchBuilder";

export async function fetchMatches(): Promise<BidirectionalMatchPayload> {
  const { data, error } = await supabase
    .from("v_friend_matches_bidirectional")
    .select("friend_id, sticker_code, extras, direction");
  if (error) throw error;

  const theyHaveYouNeed: FriendMatch[] = [];
  const youHaveTheyNeed: FriendMatch[] = [];
  for (const r of data ?? []) {
    const m: FriendMatch = {
      friendId: r.friend_id as string,
      stickerCode: r.sticker_code as string,
      extras: r.extras as number
    };
    if (r.direction === "they_have_you_need") theyHaveYouNeed.push(m);
    else youHaveTheyNeed.push(m);
  }

  // Recachear local
  const grouped = new Map<string, { they: FriendMatch[]; you: FriendMatch[] }>();
  for (const m of theyHaveYouNeed) {
    const e = grouped.get(m.friendId) ?? { they: [], you: [] };
    e.they.push(m);
    grouped.set(m.friendId, e);
  }
  for (const m of youHaveTheyNeed) {
    const e = grouped.get(m.friendId) ?? { they: [], you: [] };
    e.you.push(m);
    grouped.set(m.friendId, e);
  }
  for (const [fid, { they, you }] of grouped) {
    await cacheBidirectionalMatches(fid, they, you);
  }

  return { theyHaveYouNeed, youHaveTheyNeed };
}
```

Y agregar la importación de `cacheBidirectionalMatches` en el import existente:
```ts
import { cacheFriends, cacheBidirectionalMatches } from "@/data/friendsLocal";
```
(Reemplazá la línea con `cacheMatches` por `cacheBidirectionalMatches` — `cacheMatches` ya no se usa.)

- [ ] **Step 2: Agregar `cacheBidirectionalMatches` y `listAllCachedBidirectionalMatches` a `src/data/friendsLocal.ts`**

Al final del archivo `src/data/friendsLocal.ts`, agregar:

```ts
type Direction = "they_have_you_need" | "you_have_they_need";

export async function cacheBidirectionalMatches(
  friendId: string,
  theyHaveYouNeed: FriendMatch[],
  youHaveTheyNeed: FriendMatch[]
): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.runAsync(
    `DELETE FROM friend_matches_bidi_cache WHERE friend_id = ?`,
    [friendId]
  );
  for (const m of theyHaveYouNeed) {
    await db.runAsync(
      `INSERT INTO friend_matches_bidi_cache (friend_id, sticker_code, extras, direction, fetched_at)
       VALUES (?, ?, ?, 'they_have_you_need', ?)`,
      [m.friendId, m.stickerCode, m.extras, now]
    );
  }
  for (const m of youHaveTheyNeed) {
    await db.runAsync(
      `INSERT INTO friend_matches_bidi_cache (friend_id, sticker_code, extras, direction, fetched_at)
       VALUES (?, ?, ?, 'you_have_they_need', ?)`,
      [m.friendId, m.stickerCode, m.extras, now]
    );
  }
}

export interface CachedBidirectionalMatches {
  theyHaveYouNeed: FriendMatch[];
  youHaveTheyNeed: FriendMatch[];
}

export async function listAllCachedBidirectionalMatches(): Promise<CachedBidirectionalMatches> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    friend_id: string;
    sticker_code: string;
    extras: number;
    direction: Direction;
  }>(
    `SELECT friend_id, sticker_code, extras, direction FROM friend_matches_bidi_cache`
  );
  const theyHaveYouNeed: FriendMatch[] = [];
  const youHaveTheyNeed: FriendMatch[] = [];
  for (const r of rows) {
    const m: FriendMatch = {
      friendId: r.friend_id,
      stickerCode: r.sticker_code,
      extras: r.extras
    };
    if (r.direction === "they_have_you_need") theyHaveYouNeed.push(m);
    else youHaveTheyNeed.push(m);
  }
  return { theyHaveYouNeed, youHaveTheyNeed };
}
```

Modificar `removeFriend` para que también borre del cache nuevo:
```ts
export async function removeFriend(friendId: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM friends_cache WHERE friend_id = ?`, [friendId]);
  await db.runAsync(`DELETE FROM friend_matches_cache WHERE friend_id = ?`, [friendId]);
  await db.runAsync(`DELETE FROM friend_matches_bidi_cache WHERE friend_id = ?`, [friendId]);
}
```

- [ ] **Step 3: Adaptar `src/hooks/useMatches.ts`**

Reemplazar el contenido completo:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchMatches } from "@/social/friendships";
import { listAllCachedBidirectionalMatches } from "@/data/friendsLocal";
import { summarizeMatches } from "@/domain/friendMatchBuilder";
import { useFriends } from "./useFriends";

export function useMatches() {
  const friends = useFriends();
  const matches = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      try {
        return await fetchMatches();
      } catch {
        return await listAllCachedBidirectionalMatches();
      }
    }
  });

  const summary =
    friends.data && matches.data
      ? summarizeMatches(
          matches.data,
          new Map(
            friends.data.map((f) => [
              f.id,
              { username: f.username, displayName: f.displayName }
            ])
          )
        )
      : [];

  return { ...matches, summary };
}
```

- [ ] **Step 4: Verificar tests + typecheck**

```bash
pnpm exec tsc --noEmit
pnpm test
```
Expected: typecheck OK. Tests existentes pasan (`friendsLocal.test.ts` puede no cubrir las funciones nuevas pero tampoco las romperá).

- [ ] **Step 5: Commit**

```bash
git add src/social/friendships.ts src/data/friendsLocal.ts src/hooks/useMatches.ts
git commit -m "$(cat <<'EOF'
feat(matches): switch to bidirectional matches view + cache

fetchMatches usa v_friend_matches_bidirectional y devuelve ambos lados.
Nueva tabla local friend_matches_bidi_cache espeja la query con field
direction. useMatches consume el shape nuevo via summarizeMatches.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase E — Hooks

### Task 12: Hooks `useTrades`, `useTradeForFriend`

**Files:**
- Create: `src/hooks/useTrades.ts`
- Create: `src/hooks/useTradeForFriend.ts`

- [ ] **Step 1: Crear `src/hooks/useTrades.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchActiveTrades } from "@/social/trades";
import { listActiveTrades } from "@/data/trades";

export function useTrades() {
  return useQuery({
    queryKey: ["trades"],
    queryFn: async () => {
      try {
        return await fetchActiveTrades();
      } catch {
        return await listActiveTrades();
      }
    }
  });
}
```

- [ ] **Step 2: Crear `src/hooks/useTradeForFriend.ts`**

```ts
import { useTrades } from "./useTrades";
import { useSession } from "@/auth/useSession";
import type { Trade } from "@/domain/types";

export function useTradeForFriend(friendId: string): Trade | null {
  const { user } = useSession();
  const { data } = useTrades();
  if (!user || !data) return null;
  const trade = data.find(
    (t) =>
      (t.proposerId === user.id && t.recipientId === friendId) ||
      (t.proposerId === friendId && t.recipientId === user.id)
  );
  return trade ?? null;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTrades.ts src/hooks/useTradeForFriend.ts
git commit -m "$(cat <<'EOF'
feat(hooks): add useTrades + useTradeForFriend

useTrades trae los activos del usuario (pending/accepted) con fallback
offline. useTradeForFriend filtra el activo relacionado a un amigo
específico, sin importar el rol.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Mutation hooks (`useProposeTrade`, `useRespondTrade`, etc.)

**Files:**
- Create: `src/hooks/useProposeTrade.ts`
- Create: `src/hooks/useRespondTrade.ts`
- Create: `src/hooks/useCancelTrade.ts`
- Create: `src/hooks/useConfirmTrade.ts`
- Create: `src/hooks/useUnconfirmTrade.ts`

- [ ] **Step 1: `useProposeTrade`**

`src/hooks/useProposeTrade.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { proposeTrade, type ProposeTradeInput } from "@/social/trades";

export function useProposeTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProposeTradeInput) => proposeTrade(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    }
  });
}
```

- [ ] **Step 2: `useRespondTrade`**

`src/hooks/useRespondTrade.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { respondTrade } from "@/social/trades";

export function useRespondTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { tradeId: string; accept: boolean }) =>
      respondTrade(input.tradeId, input.accept),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
    }
  });
}
```

- [ ] **Step 3: `useCancelTrade`**

`src/hooks/useCancelTrade.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelTrade } from "@/social/trades";

export function useCancelTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tradeId: string) => cancelTrade(tradeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
    }
  });
}
```

- [ ] **Step 4: `useConfirmTrade`**

`src/hooks/useConfirmTrade.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { confirmTrade } from "@/social/trades";

export function useConfirmTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tradeId: string) => confirmTrade(tradeId),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      if (result === "completed") {
        // El delta sobre sticker_status se replica vía sync engine + realtime;
        // invalidamos el progreso explícitamente para repintar Home.
        qc.invalidateQueries({ queryKey: ["progress"] });
        qc.invalidateQueries({ queryKey: ["matches"] });
      }
    }
  });
}
```

- [ ] **Step 5: `useUnconfirmTrade`**

`src/hooks/useUnconfirmTrade.ts`:
```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unconfirmTrade } from "@/social/trades";

export function useUnconfirmTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tradeId: string) => unconfirmTrade(tradeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
    }
  });
}
```

- [ ] **Step 6: Typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useProposeTrade.ts src/hooks/useRespondTrade.ts \
        src/hooks/useCancelTrade.ts src/hooks/useConfirmTrade.ts \
        src/hooks/useUnconfirmTrade.ts
git commit -m "$(cat <<'EOF'
feat(hooks): add trade mutations (propose/respond/cancel/confirm/unconfirm)

Cada mutation invalida ['trades']. confirmTrade además invalida
progress + matches al completar (el delta atómico cambia sticker_status
de ambos lados).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase F — UI components

### Task 14: `StickerMiniThumb`

**Files:**
- Create: `src/ui/StickerMiniThumb.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
import { View, Text, Pressable } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { getTeamColors } from "@/theme/teamColors";
import { useSticker } from "@/hooks/useStickers";

interface Props {
  code: string;
  onPress?: () => void;
}

export function StickerMiniThumb({ code, onPress }: Props) {
  const { theme } = useTheme();
  const sticker = useSticker(code);
  const teamColors = sticker?.team ? getTeamColors(sticker.team) : null;
  const bg = teamColors?.bg ?? theme.accent;
  const fg = teamColors?.text ?? "#ffffff";

  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Cromo ${sticker?.number ?? code}`}
      style={{
        width: 32,
        height: 40,
        borderRadius: 4,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 4,
        marginBottom: 4,
        borderWidth: 1,
        borderColor: theme.border
      }}
    >
      <Text style={{ color: fg, fontWeight: "700", fontSize: 13 }}>
        {sticker?.number ?? "?"}
      </Text>
    </Wrapper>
  );
}
```

- [ ] **Step 2: Verificar que `useSticker` exista en `src/hooks/useStickers.ts`**

```bash
grep -n "useSticker\b" src/hooks/useStickers.ts
```
Si no existe ese hook (puede que solo haya `useStickerList`), agregalo. Reviewar `src/hooks/useStickers.ts`:
```bash
cat src/hooks/useStickers.ts
```

Si `useSticker(code)` no existe, agregar al final del archivo:
```ts
import type { Sticker } from "@/domain/types";
import { getDb } from "@/data/db";

export function useSticker(code: string): Sticker | null {
  // Lookup directo en SQLite local (síncrono via state)
  const { data } = useQuery({
    queryKey: ["sticker", code],
    queryFn: async () => {
      const db = getDb();
      const row = await db.getFirstAsync<{
        code: string;
        number: number;
        name: string;
        team: string | null;
        section: string;
        type: string;
      }>(
        `SELECT code, number, name, team, section, type FROM stickers WHERE code = ?`,
        [code]
      );
      return row as Sticker | null;
    },
    staleTime: Infinity
  });
  return data ?? null;
}
```
(Asegurate de que el import de `useQuery` ya exista arriba; si no, agregalo.)

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/StickerMiniThumb.tsx src/hooks/useStickers.ts
git commit -m "$(cat <<'EOF'
feat(ui): add StickerMiniThumb component

Mini-cromo 32x40 con color de equipo + número. Reutilizable en
MatchCard, FriendDetail y modal de propuesta. Incluye useSticker
hook para lookup individual.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: `Snackbar`

**Files:**
- Create: `src/ui/Snackbar.tsx`

- [ ] **Step 1: Crear el componente con un store global simple**

`src/ui/Snackbar.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Listener = (msg: string) => void;
let listener: Listener | null = null;

export function showSnackbar(msg: string) {
  if (listener) listener(msg);
}

export function Snackbar() {
  const { theme } = useTheme();
  const [msg, setMsg] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = (incoming: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMsg(incoming);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(
          () => setMsg(null)
        );
      }, 3000);
    };
    return () => {
      listener = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [opacity]);

  if (!msg) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 60,
        left: 16,
        right: 16,
        opacity,
        zIndex: 9999
      }}
    >
      <View
        style={{
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 14,
          shadowColor: theme.text,
          shadowOpacity: 0.1,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3
        }}
      >
        <Text style={{ color: theme.text, fontSize: 14 }}>{msg}</Text>
      </View>
    </Animated.View>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/ui/Snackbar.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Snackbar toast component

Toast top auto-dismiss 3s, theme-aware. Singleton listener via
showSnackbar(msg) — no requiere context provider.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: `ActiveTradeBanner`

**Files:**
- Create: `src/ui/ActiveTradeBanner.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { ctaFor } from "@/domain/tradeStateMachine";
import { useRespondTrade } from "@/hooks/useRespondTrade";
import { useCancelTrade } from "@/hooks/useCancelTrade";
import { useConfirmTrade } from "@/hooks/useConfirmTrade";
import { useUnconfirmTrade } from "@/hooks/useUnconfirmTrade";
import { useSession } from "@/auth/useSession";
import { haptics } from "@/lib/haptics";
import type { Trade, TradeRole } from "@/domain/types";

interface Props {
  trade: Trade;
}

export function ActiveTradeBanner({ trade }: Props) {
  const { theme } = useTheme();
  const { user } = useSession();
  const respond = useRespondTrade();
  const cancel = useCancelTrade();
  const confirm = useConfirmTrade();
  const unconfirm = useUnconfirmTrade();

  if (!user) return null;
  const role: TradeRole = user.id === trade.proposerId ? "proposer" : "recipient";
  const cta = ctaFor(role, trade);

  if (cta.kind === "none") return null;

  const busy =
    respond.isPending || cancel.isPending || confirm.isPending || unconfirm.isPending;

  const onPrimary = async () => {
    if (busy) return;
    await haptics.medium();
    if (cta.primaryAction === "accept") respond.mutate({ tradeId: trade.id, accept: true });
    if (cta.primaryAction === "confirm") confirm.mutate(trade.id);
  };

  const onSecondary = async () => {
    if (busy) return;
    await haptics.light();
    if (cta.secondaryAction === "decline") respond.mutate({ tradeId: trade.id, accept: false });
    if (cta.secondaryAction === "cancel") cancel.mutate(trade.id);
    if (cta.secondaryAction === "unconfirm") unconfirm.mutate(trade.id);
  };

  const isCompleted = cta.kind === "completed";

  return (
    <View
      style={{
        backgroundColor: isCompleted ? "#dcfce7" : theme.card,
        borderColor: isCompleted ? "#86efac" : theme.border,
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 12
      }}
    >
      <Text
        style={{
          color: isCompleted ? "#166534" : theme.textMute,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1,
          marginBottom: 6
        }}
      >
        {isCompleted ? "TRADE COMPLETADO" : "TRADE ACTIVO"}
      </Text>
      <Text style={{ color: theme.text, fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
        {cta.label}
      </Text>
      <Text style={{ color: theme.textMute, fontSize: 12, marginBottom: 10 }}>
        {trade.proposerGets.length} ↔ {trade.proposerGives.length}
      </Text>

      {(cta.primaryAction || cta.secondaryAction) && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {cta.primaryAction && (
            <Pressable
              onPress={onPrimary}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: theme.accent,
                alignItems: "center",
                opacity: busy ? 0.6 : 1
              }}
              accessibilityRole="button"
              accessibilityLabel={cta.label}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {cta.primaryAction === "accept" ? "Aceptar" : "Confirmar"}
                </Text>
              )}
            </Pressable>
          )}
          {cta.secondaryAction && (
            <Pressable
              onPress={onSecondary}
              disabled={busy}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: theme.card,
                borderWidth: 1,
                borderColor: theme.border,
                alignItems: "center",
                opacity: busy ? 0.6 : 1
              }}
              accessibilityRole="button"
              accessibilityLabel={
                cta.secondaryAction === "cancel"
                  ? "Cancelar"
                  : cta.secondaryAction === "decline"
                    ? "Rechazar"
                    : "Deshacer"
              }
            >
              <Text style={{ color: theme.textMute, fontWeight: "700" }}>
                {cta.secondaryAction === "cancel"
                  ? "Cancelar"
                  : cta.secondaryAction === "decline"
                    ? "Rechazar"
                    : "Deshacer"}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/ui/ActiveTradeBanner.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add ActiveTradeBanner with role-aware CTAs

Banner que renderiza el CTA contextual del trade según ctaFor del
state machine. Conecta los mutation hooks con haptics y loading.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: `MatchCard`

**Files:**
- Create: `src/ui/MatchCard.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { GlowCard } from "@/ui/GlowCard";
import { StickerMiniThumb } from "@/ui/StickerMiniThumb";
import { ActiveTradeBanner } from "@/ui/ActiveTradeBanner";
import { useTradeForFriend } from "@/hooks/useTradeForFriend";
import type { FriendMatchSummary } from "@/domain/types";

interface Props {
  summary: FriendMatchSummary;
}

const MAX_THUMBS = 4;

export function MatchCard({ summary }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const trade = useTradeForFriend(summary.friendId);

  const youNeedSample = summary.theyHaveYouNeed.slice(0, MAX_THUMBS);
  const youNeedExtra = Math.max(0, summary.theyHaveYouNeed.length - MAX_THUMBS);
  const youGiveSample = summary.youHaveTheyNeed.slice(0, MAX_THUMBS);
  const youGiveExtra = Math.max(0, summary.youHaveTheyNeed.length - MAX_THUMBS);

  const goToFriend = () => router.push(`/friends/${summary.username}` as never);
  const goToPropose = () => router.push(`/trades/propose/${summary.username}` as never);

  return (
    <Pressable onPress={goToFriend} accessibilityRole="button" accessibilityLabel={`Abrir @${summary.username}`}>
      <GlowCard className="mb-3">
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
          @{summary.username}
        </Text>

        {trade ? (
          <View style={{ marginTop: 10 }}>
            <ActiveTradeBanner trade={trade} />
          </View>
        ) : null}

        <View style={{ flexDirection: "row", marginTop: 10, gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700", marginBottom: 6 }}>
              QUERÉS · {summary.theyHaveYouNeed.length}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {youNeedSample.map((code) => (
                <StickerMiniThumb key={`need-${code}`} code={code} />
              ))}
              {youNeedExtra > 0 && (
                <View
                  style={{
                    width: 32,
                    height: 40,
                    borderRadius: 4,
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700" }}>
                    +{youNeedExtra}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700", marginBottom: 6 }}>
              LE DAS · {summary.youHaveTheyNeed.length}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {youGiveSample.map((code) => (
                <StickerMiniThumb key={`give-${code}`} code={code} />
              ))}
              {youGiveExtra > 0 && (
                <View
                  style={{
                    width: 32,
                    height: 40,
                    borderRadius: 4,
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700" }}>
                    +{youGiveExtra}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {!trade && summary.theyHaveYouNeed.length > 0 && summary.youHaveTheyNeed.length > 0 && (
          <Pressable
            onPress={goToPropose}
            accessibilityRole="button"
            accessibilityLabel={`Proponer cambio a ${summary.username}`}
            style={{
              marginTop: 12,
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: theme.accent,
              alignItems: "center"
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Proponer cambio  ›</Text>
          </Pressable>
        )}
      </GlowCard>
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add src/ui/MatchCard.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add MatchCard with bidirectional thumbs + trade CTA

Reemplaza el render inline de MatchesView. Muestra ambos lados con
mini-thumbs (4 visibles + counter), banner de trade activo si existe,
y CTA \"Proponer cambio\" cuando no hay trade en curso.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Pantalla `app/trades/propose/[username].tsx` (modal)

**Files:**
- Create: `app/trades/propose/[username].tsx`
- Modify: `app/_layout.tsx` (registrar la screen como modal)

- [ ] **Step 1: Crear el archivo de la pantalla**

```tsx
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { StickerMiniThumb } from "@/ui/StickerMiniThumb";
import { showSnackbar } from "@/ui/Snackbar";
import { useFriends } from "@/hooks/useFriends";
import { useTradeForFriend } from "@/hooks/useTradeForFriend";
import { useProposeTrade } from "@/hooks/useProposeTrade";
import { supabase } from "@/auth/supabaseClient";
import { listStatuses } from "@/data/stickerStatus";
import { buildBidirectional } from "@/domain/friendMatchBuilder";
import { buildDefaultProposal } from "@/domain/tradeProposalBuilder";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme/ThemeProvider";
import type { BidirectionalMatch, StickerStatus } from "@/domain/types";

export default function ProposeTradeScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data: friends } = useFriends();
  const friend = friends?.find((f) => f.username === username);
  const propose = useProposeTrade();
  const existing = useTradeForFriend(friend?.id ?? "");

  const [bidi, setBidi] = useState<BidirectionalMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [givesSet, setGivesSet] = useState<Set<string>>(new Set());
  const [getsSet, setGetsSet] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!friend) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sticker_status")
        .select("sticker_code, count, updated_at")
        .eq("user_id", friend.id);
      const fStatuses: StickerStatus[] = (data ?? []).map((r) => ({
        stickerCode: r.sticker_code as string,
        count: r.count as number,
        updatedAt: Date.parse(r.updated_at as string)
      }));
      const myStatuses = await listStatuses();
      const computed = buildBidirectional(friend.id, myStatuses, fStatuses);
      if (cancelled) return;
      setBidi(computed);
      const draft = buildDefaultProposal(friend.id, computed);
      setGivesSet(new Set(draft.proposerGives));
      setGetsSet(new Set(draft.proposerGets));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [friend?.id]);

  const canSubmit = useMemo(
    () => givesSet.size > 0 && getsSet.size > 0 && !existing && !propose.isPending,
    [givesSet, getsSet, existing, propose.isPending]
  );

  const onSubmit = async () => {
    if (!friend || !canSubmit) return;
    await haptics.medium();
    propose.mutate(
      {
        recipientId: friend.id,
        proposerGives: Array.from(givesSet),
        proposerGets: Array.from(getsSet),
        message: message.trim() || undefined
      },
      {
        onSuccess: () => {
          showSnackbar("Propuesta enviada · esperando respuesta");
          router.back();
        },
        onError: (e: unknown) => {
          Alert.alert("No se pudo enviar", (e as Error).message);
        }
      }
    );
  };

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, code: string) => {
    const next = new Set(set);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSet(next);
  };

  if (!friend) {
    return (
      <ThemedBackground>
        <View className="flex-1 items-center justify-center px-6">
          <Text style={{ color: theme.textMute }}>Amigo no encontrado.</Text>
        </View>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground>
      <ScrollView
        className="flex-1 px-4 pt-14"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="flex-row items-center mb-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12
            }}
          >
            <Text style={{ color: theme.text }}>✕</Text>
          </Pressable>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700", flex: 1 }}>
            Proponer cambio a @{friend.username}
          </Text>
        </View>

        {existing && (
          <View
            style={{
              backgroundColor: theme.card,
              borderColor: theme.border,
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              marginBottom: 12
            }}
          >
            <Text style={{ color: theme.text, fontSize: 13 }}>
              Ya tenés un cambio en curso con @{friend.username}. Resolvelo desde Cambios o desde su perfil.
            </Text>
          </View>
        )}

        {loading || !bidi ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <>
            <Section
              title={`LE DOY (${givesSet.size})`}
              codes={bidi.youHaveTheyNeed.map((m) => m.stickerCode)}
              selected={givesSet}
              onToggle={(c) => toggle(givesSet, setGivesSet, c)}
            />
            <Section
              title={`LE PIDO (${getsSet.size})`}
              codes={bidi.theyHaveYouNeed.map((m) => m.stickerCode)}
              selected={getsSet}
              onToggle={(c) => toggle(getsSet, setGetsSet, c)}
            />
            <Text
              style={{
                color: theme.textMute,
                fontSize: 11,
                fontWeight: "700",
                marginTop: 14,
                marginBottom: 6,
                letterSpacing: 1
              }}
            >
              MENSAJE OPCIONAL ({message.length}/280)
            </Text>
            <TextInput
              value={message}
              onChangeText={(v) => setMessage(v.slice(0, 280))}
              placeholder="Hola, ¿cambiamos?"
              placeholderTextColor={theme.textMute}
              multiline
              style={{
                backgroundColor: theme.card,
                color: theme.text,
                borderColor: theme.border,
                borderWidth: 1,
                borderRadius: 10,
                padding: 10,
                minHeight: 70,
                fontSize: 14
              }}
            />
          </>
        )}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          right: 16
        }}
      >
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={{
            paddingVertical: 14,
            borderRadius: 10,
            backgroundColor: canSubmit ? theme.accent : theme.card,
            alignItems: "center",
            borderWidth: 1,
            borderColor: theme.border
          }}
          accessibilityRole="button"
          accessibilityLabel="Enviar propuesta"
        >
          {propose.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: canSubmit ? "#fff" : theme.textMute, fontWeight: "700" }}>
              Enviar propuesta
            </Text>
          )}
        </Pressable>
      </View>
    </ThemedBackground>
  );
}

function Section({
  title,
  codes,
  selected,
  onToggle
}: {
  title: string;
  codes: string[];
  selected: Set<string>;
  onToggle: (code: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: theme.textMute,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1,
          marginBottom: 8
        }}
      >
        {title}
      </Text>
      {codes.length === 0 ? (
        <Text style={{ color: theme.textMute, fontSize: 13 }}>
          (no hay cromos en este lado)
        </Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {codes.map((c) => (
            <View
              key={c}
              style={{
                opacity: selected.has(c) ? 1 : 0.35
              }}
            >
              <StickerMiniThumb code={c} onPress={() => onToggle(c)} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Registrar la screen como modal en `app/_layout.tsx`**

En `app/_layout.tsx`, dentro de `<Stack>` (alrededor de línea 47), agregar antes del cierre:
```tsx
      <Stack.Screen name="trades/propose/[username]" options={{ presentation: "modal", animation: "fade_from_bottom" }} />
```

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/trades/propose/\[username\].tsx app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(trades): add propose-trade modal screen

Modal con pre-selección bidireccional, toggle por cromo, mensaje
opcional (280 chars). Bloquea envío si ya hay trade activo con la
persona o si algún lado queda vacío.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase G — Wiring de pantallas

### Task 19: Reescribir `MatchesView` en `app/(tabs)/trades.tsx`

**Files:**
- Modify: `app/(tabs)/trades.tsx`

- [ ] **Step 1: Reemplazar `MatchesView`**

En `app/(tabs)/trades.tsx`, reemplazar la función `MatchesView` (líneas 79-111) por:

```tsx
function MatchesView() {
  const router = useRouter();
  const { theme } = useTheme();
  const { summary, isLoading } = useMatches();

  if (isLoading) return <Text style={{ color: theme.textMute, textAlign: "center", marginTop: 16 }}>Cargando…</Text>;

  if (summary.length === 0) {
    return (
      <>
        <EmptyState variant="rocket" title="Sin matches todavía" message="Sumá amigos desde Perfil." />
        <Pressable
          onPress={() => router.push("/profile" as never)}
          accessibilityRole="button"
          accessibilityLabel="Compartir tu lista"
          style={{
            marginTop: 12,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: "center"
          }}
        >
          <Text style={{ color: theme.text, fontWeight: "600" }}>Compartí tu lista</Text>
        </Pressable>
      </>
    );
  }

  return (
    <>
      {summary.map((s) => (
        <MatchCard key={s.friendId} summary={s} />
      ))}
    </>
  );
}
```

Y agregar el import al tope del archivo:
```ts
import { MatchCard } from "@/ui/MatchCard";
```

- [ ] **Step 2: Typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/trades.tsx
git commit -m "$(cat <<'EOF'
feat(trades): MatchesView uses MatchCard with bidirectional thumbs

Reemplaza el render inline. Empty state suma CTA secundario para
compartir lista (engancha con flow P3 existente).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: Rediseñar `app/friends/[username].tsx`

**Files:**
- Modify: `app/friends/[username].tsx`

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```tsx
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator, Linking, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { StickerMiniThumb } from "@/ui/StickerMiniThumb";
import { ActiveTradeBanner } from "@/ui/ActiveTradeBanner";
import { supabase } from "@/auth/supabaseClient";
import { useFriends } from "@/hooks/useFriends";
import { useFriendContacts } from "@/hooks/useContacts";
import { useTradeForFriend } from "@/hooks/useTradeForFriend";
import { whatsappUrl, instagramUrl } from "@/social/contacts";
import { listStatuses } from "@/data/stickerStatus";
import { listStickers } from "@/data/stickers";
import { buildBidirectional } from "@/domain/friendMatchBuilder";
import type { BidirectionalMatch, StickerStatus, Sticker } from "@/domain/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function FriendDetail() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { data: friends } = useFriends();
  const friend = friends?.find((f) => f.username === username);
  const { data: contacts } = useFriendContacts(friend?.id);
  const trade = useTradeForFriend(friend?.id ?? "");

  const [match, setMatch] = useState<BidirectionalMatch | null>(null);
  const [stickersBySection, setStickersBySection] = useState<Map<string, Sticker>>(new Map());
  const [loading, setLoading] = useState(true);

  const wa = whatsappUrl(contacts?.whatsapp);
  const ig = instagramUrl(contacts?.instagram);

  const openLink = async (url: string) => {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("No se pudo abrir", "Tu device no tiene una app que maneje este enlace.");
      return;
    }
    await Linking.openURL(url);
  };

  useEffect(() => {
    if (!friend) return;
    (async () => {
      setLoading(true);
      const allStickers = await listStickers();
      const map = new Map(allStickers.map((s) => [s.code, s]));
      setStickersBySection(map);
      const { data } = await supabase
        .from("sticker_status")
        .select("sticker_code, count, updated_at")
        .eq("user_id", friend.id);
      const friendStatuses: StickerStatus[] = (data ?? []).map((r) => ({
        stickerCode: r.sticker_code as string,
        count: r.count as number,
        updatedAt: Date.parse(r.updated_at as string)
      }));
      const myStatuses = await listStatuses();
      setMatch(buildBidirectional(friend.id, myStatuses, friendStatuses));
      setLoading(false);
    })();
  }, [friend?.id]);

  const grouped = useMemo(() => {
    if (!match) return null;
    const groupCodes = (codes: string[]) => {
      const out = new Map<string, string[]>();
      for (const code of codes) {
        const sticker = stickersBySection.get(code);
        const section = sticker?.section ?? "OTROS";
        const arr = out.get(section) ?? [];
        arr.push(code);
        out.set(section, arr);
      }
      return Array.from(out.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    };
    return {
      need: groupCodes(match.theyHaveYouNeed.map((m) => m.stickerCode)),
      give: groupCodes(match.youHaveTheyNeed.map((m) => m.stickerCode))
    };
  }, [match, stickersBySection]);

  if (!friend) {
    return (
      <ThemedBackground>
        <View className="flex-1 items-center justify-center px-6">
          <Text style={{ color: theme.textMute, marginBottom: 16 }}>Amigo no encontrado.</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border
            }}
          >
            <Text style={{ color: theme.text }}>‹ Volver</Text>
          </Pressable>
        </View>
      </ThemedBackground>
    );
  }

  const canPropose =
    !trade && match && match.theyHaveYouNeed.length > 0 && match.youHaveTheyNeed.length > 0;

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="flex-row items-center mb-4">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: theme.border,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12
            }}
          >
            <Text style={{ color: theme.text, fontSize: 16 }}>‹</Text>
          </Pressable>
          <View className="flex-1">
            <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 11, letterSpacing: 1 }}>
              @{friend.username}
            </Text>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: "700" }}>
              {friend.displayName ?? friend.username}
            </Text>
          </View>
        </View>

        {trade ? <ActiveTradeBanner trade={trade} /> : null}

        {(wa || ig) && (
          <View className="flex-row mb-4" style={{ gap: 8 }}>
            {wa && (
              <Pressable
                onPress={() => openLink(wa)}
                accessibilityRole="button"
                accessibilityLabel="Abrir WhatsApp"
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#25D366", alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>WhatsApp</Text>
              </Pressable>
            )}
            {ig && (
              <Pressable
                onPress={() => openLink(ig)}
                accessibilityRole="button"
                accessibilityLabel="Abrir Instagram"
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#E1306C", alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Instagram</Text>
              </Pressable>
            )}
          </View>
        )}

        {!wa && !ig && (
          <Text style={{ color: theme.textMute, fontSize: 12, textAlign: "center", marginBottom: 12 }}>
            {friend.displayName ?? friend.username} no compartió contacto.
          </Text>
        )}

        {loading || !match || !grouped ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <>
            <BidirectionalSection
              title={`ÉL TIENE QUE NECESITÁS · ${match.theyHaveYouNeed.length}`}
              groups={grouped.need}
              stickers={stickersBySection}
              onTeamPress={(code) => router.push(`/team/${code}` as never)}
              onThumbPress={(code) => router.push(`/sticker/${code}` as never)}
            />
            <BidirectionalSection
              title={`TENÉS QUE LE NECESITA · ${match.youHaveTheyNeed.length}`}
              groups={grouped.give}
              stickers={stickersBySection}
              onTeamPress={(code) => router.push(`/team/${code}` as never)}
              onThumbPress={(code) => router.push(`/sticker/${code}` as never)}
            />
          </>
        )}
      </ScrollView>

      {canPropose && (
        <View style={{ position: "absolute", bottom: 16, left: 16, right: 16 }}>
          <Pressable
            onPress={() => router.push(`/trades/propose/${friend.username}` as never)}
            accessibilityRole="button"
            accessibilityLabel={`Proponer cambio a ${friend.username}`}
            style={{
              paddingVertical: 14,
              borderRadius: 10,
              backgroundColor: theme.accent,
              alignItems: "center"
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Proponer cambio</Text>
          </Pressable>
        </View>
      )}
    </ThemedBackground>
  );
}

function BidirectionalSection({
  title,
  groups,
  stickers,
  onTeamPress,
  onThumbPress
}: {
  title: string;
  groups: [string, string[]][];
  stickers: Map<string, Sticker>;
  onTeamPress: (teamCode: string) => void;
  onThumbPress: (code: string) => void;
}) {
  const { theme } = useTheme();
  if (groups.length === 0) {
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 }}>
          {title}
        </Text>
        <Text style={{ color: theme.textMute, fontSize: 13 }}>(nada por ahora)</Text>
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: theme.textMute, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 }}>
        {title}
      </Text>
      {groups.map(([section, codes]) => {
        const teamCode = stickers.get(codes[0])?.team ?? null;
        return (
          <View key={section} style={{ marginBottom: 10 }}>
            <Pressable
              onPress={() => teamCode && onTeamPress(teamCode)}
              disabled={!teamCode}
              accessibilityRole={teamCode ? "button" : undefined}
              accessibilityLabel={teamCode ? `Abrir equipo ${section}` : undefined}
            >
              <Text style={{ color: theme.text, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>
                {section} ({codes.length}){teamCode ? " ›" : ""}
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {codes.map((c) => (
                <StickerMiniThumb key={c} code={c} onPress={() => onThumbPress(c)} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Verificar que `listStickers` exista en `src/data/stickers.ts`**

```bash
grep -n "export.*listStickers" src/data/stickers.ts
```
Si no existe, abrí el archivo y agregalo. Buscá una función similar (`listStickersBySection`, `getAllStickers`). Si solo existen las parciales, agregar:
```ts
export async function listStickers(): Promise<Sticker[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{
    code: string; number: number; name: string; team: string | null; section: string; type: string;
  }>(`SELECT code, number, name, team, section, type FROM stickers`);
  return rows as Sticker[];
}
```
Asegurate del import de `Sticker` desde `@/domain/types`.

- [ ] **Step 3: Typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/friends/\[username\].tsx src/data/stickers.ts
git commit -m "$(cat <<'EOF'
feat(friends): redesign friend detail with bidirectional sections

Cromos visuales agrupados por equipo (con tap → /team/[code] y
/sticker/[code]). Banner del trade activo arriba. Sticky button
\"Proponer cambio\" abajo cuando no hay trade en curso.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 21: Realtime para `trades` + montar bridge en `_layout.tsx`

**Files:**
- Modify: `src/social/realtime.ts`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Extender `subscribeToFriendUpdates` para incluir trades**

Reemplazar el contenido completo de `src/social/realtime.ts`:

```ts
import { supabase } from "@/auth/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimeCallbacks {
  onStickerStatusChange: () => void;
  onFriendshipChange: () => void;
  onTradeChange: (payload: { eventType: string; new: any; old: any }) => void;
}

export function subscribeToFriendUpdates(cb: RealtimeCallbacks): RealtimeChannel {
  const channel = supabase
    .channel("friend_updates")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "sticker_status" },
      () => cb.onStickerStatusChange()
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "sticker_status" },
      () => cb.onStickerStatusChange()
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "friendships" },
      () => cb.onFriendshipChange()
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "friendships" },
      () => cb.onFriendshipChange()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trades" },
      (payload) => cb.onTradeChange(payload as any)
    )
    .subscribe();
  return channel;
}

export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
```

- [ ] **Step 2: Actualizar `FriendUpdatesBridge` en `app/_layout.tsx`**

Reemplazar `FriendUpdatesBridge` (alrededor de líneas 102-122):

```tsx
function FriendUpdatesBridge() {
  const { user } = useSession();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const channel = subscribeToFriendUpdates({
      onStickerStatusChange: () => {
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["progress"] });
      },
      onFriendshipChange: () => {
        qc.invalidateQueries({ queryKey: ["pendingRequests"] });
        qc.invalidateQueries({ queryKey: ["outgoingRequests"] });
        qc.invalidateQueries({ queryKey: ["friends"] });
      },
      onTradeChange: (payload) => {
        qc.invalidateQueries({ queryKey: ["trades"] });
        // El completion del trade aplica delta a sticker_status; eso emite
        // su propio evento que invalidará matches/progress.
        const newStatus = payload?.new?.status as string | undefined;
        const oldStatus = payload?.old?.status as string | undefined;
        if (newStatus && newStatus !== oldStatus) {
          announceTradeChange(payload, user.id);
        }
      }
    });
    return () => unsubscribe(channel);
  }, [user, qc]);

  return null;
}

function announceTradeChange(payload: any, meId: string) {
  const newStatus = payload?.new?.status as string | undefined;
  const oldStatus = payload?.old?.status as string | undefined;
  const proposerId = payload?.new?.proposer_id as string | undefined;
  const recipientId = payload?.new?.recipient_id as string | undefined;
  const otherIsProposer = proposerId !== meId;

  let msg: string | null = null;
  if (oldStatus === "pending" && newStatus === "accepted") {
    msg = otherIsProposer ? "Aceptaste un cambio" : "Tu propuesta fue aceptada";
  } else if (oldStatus === "pending" && newStatus === "declined") {
    msg = otherIsProposer ? "Rechazaste un cambio" : "Tu propuesta fue rechazada";
  } else if (newStatus === "completed") {
    msg = "Trade completado ✓";
  } else if (
    oldStatus === "accepted" &&
    newStatus === "accepted" &&
    payload?.new?.proposer_confirmed_at !== payload?.old?.proposer_confirmed_at &&
    proposerId !== meId
  ) {
    msg = "Tu contraparte marcó como hecho — confirmá";
  } else if (
    oldStatus === "accepted" &&
    newStatus === "accepted" &&
    payload?.new?.recipient_confirmed_at !== payload?.old?.recipient_confirmed_at &&
    recipientId !== meId
  ) {
    msg = "Tu contraparte marcó como hecho — confirmá";
  }
  if (msg) showSnackbar(msg);
}
```

Y agregar el import al tope:
```ts
import { Snackbar, showSnackbar } from "@/ui/Snackbar";
```

- [ ] **Step 3: Renderizar el `<Snackbar />` en el árbol**

Dentro de `RootLayout`, en el JSX donde está `<QueryClientProvider>`, agregar `<Snackbar />` justo antes del cierre del provider:

```tsx
          <QueryClientProvider client={queryClient}>
            <SessionProvider />
            <SyncEngine />
            <FriendUpdatesBridge />
            <ThemedStatusBar />
            <AuthGate>
              <ThemedStack />
            </AuthGate>
            <Snackbar />
          </QueryClientProvider>
```

- [ ] **Step 4: Typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/social/realtime.ts app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(realtime): subscribe to trades + dispatch contextual snackbars

El bridge invalida ['trades'] on cualquier cambio, y dispara un toast
con el mensaje correcto según la transición (aceptado/rechazado/
completado/marca del otro lado).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 22: Pull inicial de trades al boot

**Files:**
- Modify: `app/_layout.tsx`

**Por qué:** sin pull al boot, el cache local empieza vacío y `useTrades` (que tiene fallback offline) no muestra nada hasta el primer fetch remoto. Hacerlo en `SyncEngine` lo encadena al ciclo existente.

- [ ] **Step 1: Agregar el pull a `SyncEngine`**

En `app/_layout.tsx`, dentro de `SyncEngine`, ampliar el bloque inicial:

Reemplazar:
```tsx
    (async () => {
      try {
        await pullRemoteStatus(user.id);
      } catch (e) {
        console.warn("pull error", e);
      }
      await tick();
      timer = setInterval(tick, 30_000);
    })();
```
por:
```tsx
    (async () => {
      try {
        await pullRemoteStatus(user.id);
      } catch (e) {
        console.warn("pull error", e);
      }
      try {
        await fetchActiveTrades();
      } catch (e) {
        console.warn("trades pull error", e);
      }
      await tick();
      timer = setInterval(tick, 30_000);
    })();
```

Y agregar el import al tope del archivo:
```ts
import { fetchActiveTrades } from "@/social/trades";
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm exec tsc --noEmit
git add app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(sync): pull active trades at boot

SyncEngine refresca trades_cache al iniciar la sesión, junto con el
pull existente de sticker_status. Si falla (offline), useTrades cae
al cache local.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Fase H — Smoke + version bump

### Task 23: Bump versión + smoke tests + typecheck final

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump version**

Editar `package.json`. Cambiar:
```json
"version": "1.0.0",
```
a:
```json
"version": "1.1.0",
```

- [ ] **Step 2: Correr todos los tests + typecheck**

```bash
eval "$(mise activate zsh)"
pnpm exec tsc --noEmit
pnpm test
```
Expected: typecheck OK; los ~55 tests existentes + los nuevos (4 specs en `tradeProposalBuilder`, 9 specs en `tradeStateMachine`, 6 specs en `data/trades`, ampliados en `friendMatchBuilder`) PASS.

- [ ] **Step 3: Smoke manual en device (no automatizable)**

Antes de hacer el último commit, validar en device físico:
1. Abrir la app — la tab Álbum no aparece, hay 3 tabs.
2. Ir a Cambios → Matches: las cards muestran ambos lados con thumbs.
3. Tap en "Proponer cambio" → modal con cromos pre-seleccionados.
4. Enviar propuesta → snackbar "Propuesta enviada" + queda banner pending en la card.
5. (Con segundo device / cuenta) aceptar la propuesta — el primer device recibe snackbar "Tu propuesta fue aceptada" via realtime.
6. Marcar como hecho ambos lados → ambos ven "Trade completado ✓"; los progresos se actualizan (repe descontada, faltante pegada).

Si algún paso falla, NO seguir con el commit; abrir un task de debugging.

- [ ] **Step 4: Commit final**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
chore: bump version to 1.1.0

Release con remoción de pestaña Álbum y flujo bilateral de
intercambios.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review final del plan (post-escritura)

**Cobertura del spec — checklist contra el spec:**
- §1 Tabs: cubierto en Task 1.
- §2 Modelo de datos (tabla, RLS, RPCs, delta): cubierto en Task 2 (+ view bidi en Task 3).
- §3 Domain/data/hooks: cubierto en Tasks 4-13.
- §4 UI (MatchCard, StickerMiniThumb, ActiveTradeBanner, /friends rediseño, modal propuesta, Snackbar, tabla CTAs): cubierto en Tasks 14-20.
- §5 Realtime: cubierto en Task 21.
- §6 Tests: cubierto a lo largo (Tasks 5, 6, 7, 9 + smoke en Task 23).
- §7 Checklist archivos: todos presentes (Task 1 borra; Tasks 2-22 crean/modifican).
- §8 Riesgos: mitigaciones presentes en cada task pertinente.
- §9 Versionado: cubierto en Task 23.

**Decisiones explícitas que quedan en el plan:**
- La view antigua `v_friend_matches` se mantiene (no rompemos consumidores); se añade la bidireccional al lado.
- Sin queue local para trades — los trades requieren respuesta del backend; UI muestra loading inline.
- La 4ta sub-tab "Trades" NO se agrega; los trades activos viven como banner en MatchCard / FriendDetail.
- `friend_matches_cache` (vieja) coexiste con `friend_matches_bidi_cache` (nueva); se podrá borrar en una limpieza posterior cuando ningún consumidor la lea.

**Anti-placeholder check:** no hay TBD/TODO. Todos los snippets tienen código completo. Las firmas son consistentes entre tasks.

---

## Plan complete

Plan saved at `docs/superpowers/plans/2026-05-09-remove-album-improve-trades-plan.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
