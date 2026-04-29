# P4 — Amigos + Matches · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema social completo: agregar amigos por QR/invite_code o búsqueda por @username, ver matches automáticos (mis faltantes ↔ repetidas de amigos), y recibir Realtime push cuando un amigo se actualiza.

**Architecture:** Migraciones SQL (friendships, RLS expandida, VIEW de matches, RPCs `accept_invite_code` y `find_user_by_username`, trigger Realtime broadcast). Capa local con `friends_cache` + `friend_matches_cache`. UI: pantalla Profile con QR, pantallas add-friend (scan + search), pantalla de amigo, sub-tab "Matches" real, listener Realtime que invalida queries.

**Tech Stack:** `react-native-qrcode-svg`, `expo-camera`, `react-native-svg` (ya instalado), Supabase Realtime channels, todos los demás de P1/P2/P3.

**Spec referenciada:** `docs/superpowers/specs/2026-04-28-panini-album-design.md` — secciones 4 (friendships, v_friend_matches), 5 (RLS friend-aware, RPC `accept_invite_code`), 7 (Realtime), 8 (matches).

**Precondiciones (estado del repo al empezar P4):**
- P1 + P2 + P3 mergeados.
- Auth funcional, sticker_status sincroniza, RLS actual permite SELECT solo sobre tu propio `sticker_status`.
- Tab Cambios con sub-tab "Mi lista" + share sheet. Sub-tab "Matches" es placeholder.
- Profile real con avatar/username/log out.

**Lo que NO se construye en P4 (queda para P5):**
- Pulido visual final (animaciones, parallax, glow gradient).
- Builds a TestFlight / Play internal.
- Borrar cuenta.
- Push notifications.

---

## Estructura de archivos a crear/modificar

```
panini-album/
├── supabase/migrations/
│   ├── 20260428000004_friendships.sql           # CREATE
│   ├── 20260428000005_sticker_status_rls.sql    # CREATE
│   ├── 20260428000006_friend_matches_view.sql   # CREATE
│   ├── 20260428000007_rpc_invite_code.sql       # CREATE
│   ├── 20260428000008_rpc_find_user.sql         # CREATE
│   └── 20260428000009_realtime_trigger.sql      # CREATE
│
├── src/
│   ├── data/
│   │   ├── schema.ts                            # MODIFY: bump a v3, friends_cache, friend_matches_cache
│   │   └── friendsLocal.ts                      # CREATE: queries locales
│   ├── domain/
│   │   ├── types.ts                             # MODIFY: Friend, FriendMatch, FriendshipStatus
│   │   ├── inviteCode.ts                        # CREATE: validador (puro)
│   │   └── friendMatchBuilder.ts                # CREATE: builder bidireccional (puro)
│   ├── social/
│   │   ├── friendships.ts                       # CREATE: capa remota + cache
│   │   └── realtime.ts                          # CREATE: subscripción al canal
│   └── hooks/
│       ├── useFriends.ts                        # CREATE
│       ├── useMatches.ts                        # CREATE
│       ├── useAddFriend.ts                      # CREATE
│       └── useFindUser.ts                       # CREATE
│
├── app/
│   ├── _layout.tsx                              # MODIFY: FriendUpdatesBridge
│   ├── (tabs)/
│   │   ├── trades.tsx                           # MODIFY: sub-tab Matches real
│   │   └── profile.tsx                          # MODIFY: QR + invite_code card
│   ├── add-friend/
│   │   ├── scan.tsx                             # CREATE: cámara para QR
│   │   └── search.tsx                           # CREATE: búsqueda por @
│   └── friends/
│       ├── index.tsx                            # CREATE: lista de amigos
│       └── [username].tsx                       # CREATE: detalle bidireccional
│
└── tests/
    ├── domain/inviteCode.test.ts
    ├── domain/friendMatchBuilder.test.ts
    ├── data/friendsLocal.test.ts
    └── social/friendships.test.ts
```

---

## Task 1: Migration — `friendships` + RLS

**Files:**
- Create: `supabase/migrations/20260428000004_friendships.sql`

- [ ] **Step 1.1: Crear la migración**

```sql
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
create type public.friendship_source as enum ('qr_code', 'username_search');

create table public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  source public.friendship_source not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (friend_id <> user_id)
);

create index idx_friendships_user on public.friendships (user_id);
create index idx_friendships_friend on public.friendships (friend_id);

alter table public.friendships enable row level security;

create policy "select own friendships"
  on public.friendships for select
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy "manage own side"
  on public.friendships for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

- [ ] **Step 1.2: Aplicar y commit**

```bash
supabase db push
git add supabase/migrations/20260428000004_friendships.sql
git commit -m "feat(db): friendships table with RLS"
```

---

## Task 2: Migration — RLS de `sticker_status` friend-aware

**Files:**
- Create: `supabase/migrations/20260428000005_sticker_status_rls.sql`

- [ ] **Step 2.1: Crear**

```sql
-- Reemplaza la policy de SELECT de P2 por la versión que incluye amigos aceptados
drop policy if exists "select own stickers" on public.sticker_status;

create policy "select own or friends stickers"
  on public.sticker_status for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid()
        and f.friend_id = public.sticker_status.user_id
        and f.status = 'accepted'
    )
  );
```

- [ ] **Step 2.2: Aplicar y commit**

```bash
supabase db push
git add supabase/migrations/20260428000005_sticker_status_rls.sql
git commit -m "feat(db): sticker_status RLS allows accepted friends"
```

---

## Task 3: Migration — VIEW `v_friend_matches`

**Files:**
- Create: `supabase/migrations/20260428000006_friend_matches_view.sql`

- [ ] **Step 3.1: Crear**

```sql
create or replace view public.v_friend_matches as
select
  f.user_id           as me_id,
  f.friend_id         as friend_id,
  ss_friend.sticker_code,
  (ss_friend.count - 1) as extras
from public.friendships f
join public.sticker_status ss_me
  on ss_me.user_id = f.user_id
  and ss_me.count = 0
join public.sticker_status ss_friend
  on ss_friend.user_id = f.friend_id
  and ss_friend.sticker_code = ss_me.sticker_code
  and ss_friend.count > 1
where f.status = 'accepted';
```

- [ ] **Step 3.2: Aplicar y commit**

```bash
supabase db push
git add supabase/migrations/20260428000006_friend_matches_view.sql
git commit -m "feat(db): v_friend_matches view"
```

---

## Task 4: Migration — RPC `accept_invite_code`

**Files:**
- Create: `supabase/migrations/20260428000007_rpc_invite_code.sql`

- [ ] **Step 4.1: Crear**

```sql
create or replace function public.accept_invite_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select id into target_id from public.profiles where invite_code = upper(code);
  if target_id is null then
    raise exception 'Invalid code' using errcode = '22023';
  end if;
  if target_id = caller_id then
    raise exception 'Cannot add yourself' using errcode = '22023';
  end if;

  insert into public.friendships (user_id, friend_id, status, source)
  values (caller_id, target_id, 'accepted', 'qr_code')
  on conflict (user_id, friend_id) do update set status = 'accepted';

  insert into public.friendships (user_id, friend_id, status, source)
  values (target_id, caller_id, 'accepted', 'qr_code')
  on conflict (user_id, friend_id) do update set status = 'accepted';

  return target_id;
end;
$$;

grant execute on function public.accept_invite_code(text) to authenticated;
```

- [ ] **Step 4.2: Aplicar y commit**

```bash
supabase db push
git add supabase/migrations/20260428000007_rpc_invite_code.sql
git commit -m "feat(db): RPC accept_invite_code"
```

---

## Task 5: Migration — RPC `find_user_by_username`

**Files:**
- Create: `supabase/migrations/20260428000008_rpc_find_user.sql`

- [ ] **Step 5.1: Crear**

```sql
create or replace function public.find_user_by_username(uname text)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select id, username, display_name, avatar_url
  from public.profiles
  where username = lower(uname);
$$;

grant execute on function public.find_user_by_username(text) to authenticated;
```

- [ ] **Step 5.2: Aplicar y commit**

```bash
supabase db push
git add supabase/migrations/20260428000008_rpc_find_user.sql
git commit -m "feat(db): RPC find_user_by_username"
```

---

## Task 6: Migration — Realtime broadcast trigger

**Files:**
- Create: `supabase/migrations/20260428000009_realtime_trigger.sql`

- [ ] **Step 6.1: Crear**

```sql
-- Cuando alguien actualiza su sticker_status, emitimos un broadcast
-- al topic friend_updates:<user_id>. Los amigos suscritos lo reciben.
create or replace function public.notify_friend_update()
returns trigger
language plpgsql
security definer
as $$
begin
  perform pg_notify(
    'friend_updates_' || new.user_id::text,
    json_build_object('sticker_code', new.sticker_code, 'count', new.count)::text
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_friend_update on public.sticker_status;
create trigger trg_notify_friend_update
  after insert or update on public.sticker_status
  for each row execute function public.notify_friend_update();
```

> **Nota:** este trigger usa `pg_notify` que el cliente Supabase Realtime puede escuchar via `postgres_changes` channel. La forma "broadcast" del producto Supabase Realtime requiere usar `realtime.send()` explícitamente; aquí preferimos `postgres_changes` directo sobre la tabla `sticker_status` porque ya tenemos RLS apropiada (el subscriptor recibe solo lo que su RLS permite ver).

- [ ] **Step 6.2: Habilitar publication para Realtime en Supabase Dashboard**

Manual: Database → Replication → enable `sticker_status` para `supabase_realtime` publication. Sin esto, los listeners no reciben nada.

- [ ] **Step 6.3: Aplicar y commit**

```bash
supabase db push
git add supabase/migrations/20260428000009_realtime_trigger.sql
git commit -m "feat(db): pg_notify on sticker_status changes for realtime"
```

---

## Task 7: Tipos del dominio

**Files:**
- Modify: `src/domain/types.ts`

- [ ] **Step 7.1: Agregar al final de `src/domain/types.ts`**

```ts
export type FriendshipStatus = "pending" | "accepted" | "blocked";
export type FriendshipSource = "qr_code" | "username_search";

export interface Friend {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: FriendshipStatus;
  source: FriendshipSource;
  createdAt: number;
}

export interface FriendMatch {
  friendId: string;
  stickerCode: string;
  extras: number; // count - 1 del amigo
}

export interface FriendMatchSummary {
  friendId: string;
  username: string;
  displayName: string | null;
  matchCount: number;
  sample: string[]; // primeros 3 sticker codes
}

export interface BidirectionalMatch {
  theyHaveYouNeed: FriendMatch[];
  youHaveTheyNeed: FriendMatch[];
}
```

- [ ] **Step 7.2: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat(domain): friend types"
```

---

## Task 8: Validador de invite_code (TDD)

**Files:**
- Create: `src/domain/inviteCode.ts`, `tests/domain/inviteCode.test.ts`

- [ ] **Step 8.1: Test**

```ts
// tests/domain/inviteCode.test.ts
import { isValidInviteCode, normalizeInviteCode } from "@/domain/inviteCode";

describe("inviteCode", () => {
  it("accepts 8 hex uppercase", () => {
    expect(isValidInviteCode("AB12CD34")).toBe(true);
  });
  it("rejects wrong length", () => {
    expect(isValidInviteCode("ABC")).toBe(false);
    expect(isValidInviteCode("ABCDEFGHIJ")).toBe(false);
  });
  it("rejects non-hex chars", () => {
    expect(isValidInviteCode("ZZZZZZZZ")).toBe(false);
  });
  it("normalizes to upper and trims", () => {
    expect(normalizeInviteCode("  ab12cd34  ")).toBe("AB12CD34");
  });
});
```

- [ ] **Step 8.2: Implementar**

```ts
// src/domain/inviteCode.ts
const RE = /^[A-F0-9]{8}$/;

export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidInviteCode(input: string): boolean {
  return RE.test(normalizeInviteCode(input));
}
```

- [ ] **Step 8.3: Pasa + commit**

```bash
npm test -- inviteCode
git add src/domain/inviteCode.ts tests/domain/inviteCode.test.ts
git commit -m "feat(domain): invite_code validator"
```

---

## Task 9: Builder de matches bidireccional (TDD)

**Files:**
- Create: `src/domain/friendMatchBuilder.ts`, `tests/domain/friendMatchBuilder.test.ts`

- [ ] **Step 9.1: Test**

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
  it("groups by friend and takes first 3 codes", () => {
    const matches = [
      { friendId: "f1", stickerCode: "A1", extras: 1 },
      { friendId: "f1", stickerCode: "A2", extras: 2 },
      { friendId: "f1", stickerCode: "A3", extras: 1 },
      { friendId: "f1", stickerCode: "A4", extras: 1 },
      { friendId: "f2", stickerCode: "A5", extras: 1 }
    ];
    const friends = new Map([
      ["f1", { username: "juli", displayName: "Juli" }],
      ["f2", { username: "maria", displayName: null }]
    ]);
    const r = summarizeMatches(matches, friends);
    expect(r).toHaveLength(2);
    expect(r[0].friendId).toBe("f1");
    expect(r[0].matchCount).toBe(4);
    expect(r[0].sample).toEqual(["A1", "A2", "A3"]);
  });
});
```

- [ ] **Step 9.2: Implementar**

```ts
// src/domain/friendMatchBuilder.ts
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

export function summarizeMatches(
  matches: FriendMatch[],
  friends: Map<string, { username: string; displayName: string | null }>
): FriendMatchSummary[] {
  const grouped = new Map<string, FriendMatch[]>();
  for (const m of matches) {
    const arr = grouped.get(m.friendId) ?? [];
    arr.push(m);
    grouped.set(m.friendId, arr);
  }

  const out: FriendMatchSummary[] = [];
  for (const [friendId, ms] of grouped) {
    const meta = friends.get(friendId);
    if (!meta) continue;
    out.push({
      friendId,
      username: meta.username,
      displayName: meta.displayName,
      matchCount: ms.length,
      sample: ms.slice(0, 3).map((m) => m.stickerCode)
    });
  }
  out.sort((a, b) => b.matchCount - a.matchCount);
  return out;
}
```

- [ ] **Step 9.3: Pasa + commit**

```bash
npm test -- friendMatchBuilder
git add src/domain/friendMatchBuilder.ts tests/domain/friendMatchBuilder.test.ts
git commit -m "feat(domain): bidirectional friend match builder"
```

---

## Task 10: Schema bump v3 + tablas locales de cache

**Files:**
- Modify: `src/data/schema.ts`

- [ ] **Step 10.1: Reemplazar `src/data/schema.ts`** completo

```ts
import { getDb } from "./db";

const SCHEMA_VERSION = 3;

export async function initSchema(): Promise<void> {
  const db = getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stickers (
      code TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      name TEXT NOT NULL,
      team TEXT,
      section TEXT NOT NULL,
      type TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stickers_section ON stickers(section);
    CREATE INDEX IF NOT EXISTS idx_stickers_number ON stickers(number);

    CREATE TABLE IF NOT EXISTS sticker_status (
      sticker_code TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (sticker_code) REFERENCES stickers(code) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sticker_code TEXT NOT NULL,
      count INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_attempts ON sync_queue(attempts);

    CREATE TABLE IF NOT EXISTS friends_cache (
      friend_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS friend_matches_cache (
      friend_id TEXT NOT NULL,
      sticker_code TEXT NOT NULL,
      extras INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (friend_id, sticker_code)
    );
  `);

  await db.runAsync(
    `INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`,
    [String(SCHEMA_VERSION)]
  );
}
```

- [ ] **Step 10.2: Commit**

```bash
git add src/data/schema.ts
git commit -m "feat(data): schema v3 with friends_cache and friend_matches_cache"
```

---

## Task 11: Capa local de amigos (TDD)

**Files:**
- Create: `src/data/friendsLocal.ts`, `tests/data/friendsLocal.test.ts`

- [ ] **Step 11.1: Test**

```ts
/**
 * @jest-environment node
 */
import {
  cacheFriends,
  listCachedFriends,
  cacheMatches,
  listCachedMatchesForFriend,
  listAllCachedMatches,
  removeFriend
} from "@/data/friendsLocal";
import { initSchema } from "@/data/schema";
import { _resetDb } from "@/data/db";
import "../setup-sqlite-mock";

const fr = (id: string, username: string) => ({
  id,
  username,
  displayName: null,
  avatarUrl: null,
  status: "accepted" as const,
  source: "qr_code" as const,
  createdAt: 1
});

beforeEach(async () => {
  _resetDb();
  await initSchema();
});

describe("friendsLocal", () => {
  it("caches and lists friends", async () => {
    await cacheFriends([fr("f1", "juli"), fr("f2", "maria")]);
    const all = await listCachedFriends();
    expect(all).toHaveLength(2);
    expect(all.map((f) => f.username).sort()).toEqual(["juli", "maria"]);
  });

  it("upserts on re-cache", async () => {
    await cacheFriends([fr("f1", "juli")]);
    await cacheFriends([{ ...fr("f1", "juli"), displayName: "Juliana" }]);
    const all = await listCachedFriends();
    expect(all[0].displayName).toBe("Juliana");
  });

  it("caches matches and lists by friend", async () => {
    await cacheMatches("f1", [
      { friendId: "f1", stickerCode: "A1", extras: 2 },
      { friendId: "f1", stickerCode: "A2", extras: 1 }
    ]);
    const r = await listCachedMatchesForFriend("f1");
    expect(r).toHaveLength(2);
    const all = await listAllCachedMatches();
    expect(all).toHaveLength(2);
  });

  it("removeFriend cascades local cache rows", async () => {
    await cacheFriends([fr("f1", "juli")]);
    await cacheMatches("f1", [{ friendId: "f1", stickerCode: "A1", extras: 1 }]);
    await removeFriend("f1");
    expect(await listCachedFriends()).toHaveLength(0);
    expect(await listAllCachedMatches()).toHaveLength(0);
  });
});
```

- [ ] **Step 11.2: Implementar**

```ts
// src/data/friendsLocal.ts
import { getDb } from "./db";
import type { Friend, FriendMatch, FriendshipStatus, FriendshipSource } from "@/domain/types";

interface FriendRow {
  friend_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: FriendshipStatus;
  source: FriendshipSource;
  created_at: number;
}

const toFriend = (r: FriendRow): Friend => ({
  id: r.friend_id,
  username: r.username,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  status: r.status,
  source: r.source,
  createdAt: r.created_at
});

export async function cacheFriends(friends: Friend[]): Promise<void> {
  const db = getDb();
  const now = Date.now();
  for (const f of friends) {
    await db.runAsync(
      `INSERT INTO friends_cache (friend_id, username, display_name, avatar_url, status, source, created_at, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(friend_id) DO UPDATE SET
         username = excluded.username,
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url,
         status = excluded.status,
         source = excluded.source,
         created_at = excluded.created_at,
         fetched_at = excluded.fetched_at`,
      [f.id, f.username, f.displayName, f.avatarUrl, f.status, f.source, f.createdAt, now]
    );
  }
}

export async function listCachedFriends(): Promise<Friend[]> {
  const db = getDb();
  const rows = await db.getAllAsync<FriendRow>(
    `SELECT friend_id, username, display_name, avatar_url, status, source, created_at FROM friends_cache ORDER BY username`
  );
  return rows.map(toFriend);
}

export async function getCachedFriend(friendId: string): Promise<Friend | null> {
  const db = getDb();
  const row = await db.getFirstAsync<FriendRow>(
    `SELECT friend_id, username, display_name, avatar_url, status, source, created_at FROM friends_cache WHERE friend_id = ?`,
    [friendId]
  );
  return row ? toFriend(row) : null;
}

export async function cacheMatches(friendId: string, matches: FriendMatch[]): Promise<void> {
  const db = getDb();
  const now = Date.now();
  await db.runAsync(`DELETE FROM friend_matches_cache WHERE friend_id = ?`, [friendId]);
  for (const m of matches) {
    await db.runAsync(
      `INSERT INTO friend_matches_cache (friend_id, sticker_code, extras, fetched_at)
       VALUES (?, ?, ?, ?)`,
      [m.friendId, m.stickerCode, m.extras, now]
    );
  }
}

export async function listCachedMatchesForFriend(friendId: string): Promise<FriendMatch[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ friend_id: string; sticker_code: string; extras: number }>(
    `SELECT friend_id, sticker_code, extras FROM friend_matches_cache WHERE friend_id = ?`,
    [friendId]
  );
  return rows.map((r) => ({ friendId: r.friend_id, stickerCode: r.sticker_code, extras: r.extras }));
}

export async function listAllCachedMatches(): Promise<FriendMatch[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ friend_id: string; sticker_code: string; extras: number }>(
    `SELECT friend_id, sticker_code, extras FROM friend_matches_cache`
  );
  return rows.map((r) => ({ friendId: r.friend_id, stickerCode: r.sticker_code, extras: r.extras }));
}

export async function removeFriend(friendId: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM friends_cache WHERE friend_id = ?`, [friendId]);
  await db.runAsync(`DELETE FROM friend_matches_cache WHERE friend_id = ?`, [friendId]);
}
```

- [ ] **Step 11.3: Pasa + commit**

```bash
npm test -- friendsLocal
git add src/data/friendsLocal.ts tests/data/friendsLocal.test.ts
git commit -m "feat(data): local friends and matches cache with TDD"
```

---

## Task 12: Capa remota de amigos

**Files:**
- Create: `src/social/friendships.ts`

- [ ] **Step 12.1: Crear**

```ts
import { supabase } from "@/auth/supabaseClient";
import { cacheFriends, cacheMatches } from "@/data/friendsLocal";
import type { Friend, FriendMatch } from "@/domain/types";

interface FriendshipRow {
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
  source: "qr_code" | "username_search";
  created_at: string;
  profiles: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export async function fetchFriends(): Promise<Friend[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select(`
      friend_id, status, source, created_at,
      profiles:friend_id (id, username, display_name, avatar_url)
    `)
    .eq("status", "accepted");
  if (error) throw error;

  const friends: Friend[] = (data ?? []).map((r: unknown) => {
    const row = r as FriendshipRow;
    return {
      id: row.profiles.id,
      username: row.profiles.username,
      displayName: row.profiles.display_name,
      avatarUrl: row.profiles.avatar_url,
      status: row.status,
      source: row.source,
      createdAt: Date.parse(row.created_at)
    };
  });

  await cacheFriends(friends);
  return friends;
}

export async function addFriendByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_invite_code", { code });
  if (error) throw error;
  await fetchFriends();
  return data as string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export async function findUserByUsername(uname: string): Promise<UserSearchResult | null> {
  const { data, error } = await supabase.rpc("find_user_by_username", { uname });
  if (error) throw error;
  const rows = data as UserSearchResult[];
  return rows.length > 0 ? rows[0] : null;
}

export async function requestFriendByUsername(targetId: string): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .insert({ friend_id: targetId, status: "pending", source: "username_search" });
  if (error) throw error;
}

export async function fetchMatches(): Promise<FriendMatch[]> {
  const { data, error } = await supabase
    .from("v_friend_matches")
    .select("friend_id, sticker_code, extras");
  if (error) throw error;
  const matches = (data ?? []).map((r) => ({
    friendId: r.friend_id as string,
    stickerCode: r.sticker_code as string,
    extras: r.extras as number
  }));

  // Recachear local agrupando por friend_id
  const grouped = new Map<string, FriendMatch[]>();
  for (const m of matches) {
    const arr = grouped.get(m.friendId) ?? [];
    arr.push(m);
    grouped.set(m.friendId, arr);
  }
  for (const [fid, ms] of grouped) await cacheMatches(fid, ms);

  return matches;
}

export async function unfriend(friendId: string): Promise<void> {
  // Borra ambas filas (la mía y la del otro lado se cae por RLS — a veces hay que llamar RPC).
  // Para simplificar: borramos solo la mía; la fila contraria queda huérfana hasta que ese usuario la borre.
  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("friend_id", friendId);
  if (error) throw error;
}
```

- [ ] **Step 12.2: Commit**

```bash
git add src/social/friendships.ts
git commit -m "feat(social): friendships remote layer with cache invalidation"
```

---

## Task 13: Hooks de amigos

**Files:**
- Create: `src/hooks/useFriends.ts`, `src/hooks/useMatches.ts`, `src/hooks/useAddFriend.ts`, `src/hooks/useFindUser.ts`

- [ ] **Step 13.1: `src/hooks/useFriends.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchFriends, unfriend } from "@/social/friendships";
import { listCachedFriends } from "@/data/friendsLocal";

export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      try {
        return await fetchFriends();
      } catch {
        return await listCachedFriends();
      }
    }
  });
}

export function useUnfriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendId: string) => unfriend(friendId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friends"] })
  });
}
```

- [ ] **Step 13.2: `src/hooks/useMatches.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchMatches } from "@/social/friendships";
import { listAllCachedMatches } from "@/data/friendsLocal";
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
        return await listAllCachedMatches();
      }
    }
  });

  const summary =
    friends.data && matches.data
      ? summarizeMatches(
          matches.data,
          new Map(friends.data.map((f) => [f.id, { username: f.username, displayName: f.displayName }]))
        )
      : [];

  return { ...matches, summary };
}
```

- [ ] **Step 13.3: `src/hooks/useAddFriend.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addFriendByCode } from "@/social/friendships";

export function useAddFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => addFriendByCode(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    }
  });
}
```

- [ ] **Step 13.4: `src/hooks/useFindUser.ts`**

```ts
import { useMutation } from "@tanstack/react-query";
import { findUserByUsername } from "@/social/friendships";

export function useFindUser() {
  return useMutation({
    mutationFn: (uname: string) => findUserByUsername(uname)
  });
}
```

- [ ] **Step 13.5: Commit**

```bash
git add src/hooks/useFriends.ts src/hooks/useMatches.ts src/hooks/useAddFriend.ts src/hooks/useFindUser.ts
git commit -m "feat(hooks): friends, matches, add-friend, find-user"
```

---

## Task 14: Realtime listener

**Files:**
- Create: `src/social/realtime.ts`

- [ ] **Step 14.1: Crear**

```ts
import { supabase } from "@/auth/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";

type OnFriendUpdate = () => void;

export function subscribeToFriendUpdates(onUpdate: OnFriendUpdate): RealtimeChannel {
  // postgres_changes sobre sticker_status. RLS filtra automáticamente lo que recibimos.
  const channel = supabase
    .channel("friend_updates")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "sticker_status" },
      () => onUpdate()
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "sticker_status" },
      () => onUpdate()
    )
    .subscribe();
  return channel;
}

export function unsubscribe(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}
```

- [ ] **Step 14.2: Commit**

```bash
git add src/social/realtime.ts
git commit -m "feat(social): realtime listener for friend sticker updates"
```

---

## Task 15: Tests de integración de friendships

**Files:**
- Create: `tests/social/friendships.test.ts`

- [ ] **Step 15.1: Test**

```ts
/**
 * @jest-environment node
 */
import { addFriendByCode, findUserByUsername } from "@/social/friendships";
import "../setup-sqlite-mock";
import { initSchema } from "@/data/schema";
import { _resetDb } from "@/data/db";

const rpc = jest.fn();
const select = jest.fn();
const from = jest.fn(() => ({
  select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) })
}));

jest.mock("@/auth/supabaseClient", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (...a: unknown[]) => from(...a)
  }
}));

beforeEach(async () => {
  _resetDb();
  await initSchema();
  rpc.mockReset();
});

it("addFriendByCode calls accept_invite_code RPC", async () => {
  rpc.mockResolvedValueOnce({ data: "user-uuid", error: null });
  const id = await addFriendByCode("AB12CD34");
  expect(rpc).toHaveBeenCalledWith("accept_invite_code", { code: "AB12CD34" });
  expect(id).toBe("user-uuid");
});

it("findUserByUsername returns first match", async () => {
  rpc.mockResolvedValueOnce({
    data: [{ id: "u1", username: "juli", display_name: null, avatar_url: null }],
    error: null
  });
  const u = await findUserByUsername("juli");
  expect(u?.id).toBe("u1");
});

it("findUserByUsername returns null when empty", async () => {
  rpc.mockResolvedValueOnce({ data: [], error: null });
  const u = await findUserByUsername("ghost");
  expect(u).toBeNull();
});
```

- [ ] **Step 15.2: Pasa + commit**

```bash
npm test -- friendships
git add tests/social/friendships.test.ts
git commit -m "test(social): integration tests for addFriendByCode and findUser"
```

---

## Task 16: Profile con QR + invite_code

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 16.1: Instalar dependencias**

```bash
npx expo install react-native-qrcode-svg
```

- [ ] **Step 16.2: Reemplazar `app/(tabs)/profile.tsx`**

```tsx
import { ScrollView, View, Text, Pressable, Image, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import QRCode from "react-native-qrcode-svg";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useSession } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";

function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <View
      className="rounded-full items-center justify-center"
      style={{ width: 80, height: 80, backgroundColor: "#7c5cff" }}
    >
      <Text className="text-white text-2xl font-bold">{initials || "?"}</Text>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const { user } = useSession();

  if (!user) return null;

  const onCopyCode = async () => {
    await Clipboard.setStringAsync(user.invite_code);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copiado", `Tu código ${user.invite_code} está en el portapapeles.`);
  };

  return (
    <StarryBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">PERFIL</Text>

        <GlowCard className="items-center mb-4">
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40 }} />
          ) : (
            <Initials name={user.display_name ?? user.username} />
          )}
          <Text className="text-space-ink text-lg font-bold mt-3">{user.display_name ?? user.username}</Text>
          <Text className="text-space-mute text-sm">@{user.username}</Text>
        </GlowCard>

        <GlowCard className="items-center mb-4">
          <Text className="text-space-mute text-xs tracking-widest mb-2">TU CÓDIGO</Text>
          <View className="bg-white p-3 rounded-lg mb-3">
            <QRCode value={user.invite_code} size={120} backgroundColor="#fff" color="#000" />
          </View>
          <Text className="text-space-ink text-2xl font-mono font-bold tracking-widest">
            {user.invite_code}
          </Text>
          <Pressable onPress={onCopyCode} className="mt-2">
            <Text className="text-space-violet text-xs">Copiar código</Text>
          </Pressable>
        </GlowCard>

        <Pressable
          onPress={() => router.push("/add-friend/scan")}
          className="bg-space-purple rounded-xl py-3 items-center mb-2"
        >
          <Text className="text-white font-semibold">📷 Escanear código de amigo</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/add-friend/search")}
          className="bg-space-mid rounded-xl py-3 items-center mb-2"
        >
          <Text className="text-space-ink font-semibold">⌕ Buscar por @username</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/friends")}
          className="bg-space-mid rounded-xl py-3 items-center mb-2"
        >
          <Text className="text-space-ink font-semibold">👥 Mis amigos</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/profile/edit")}
          className="bg-space-mid rounded-xl py-3 items-center mb-2"
        >
          <Text className="text-space-ink font-semibold">Editar perfil</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            Alert.alert("Cerrar sesión", "¿Seguro?", [
              { text: "Cancelar", style: "cancel" },
              { text: "Salir", style: "destructive", onPress: () => supabase.auth.signOut() }
            ]);
          }}
          className="bg-space-dark border border-red-400/30 rounded-xl py-3 items-center"
        >
          <Text className="text-red-300 font-semibold">Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </StarryBackground>
  );
}
```

- [ ] **Step 16.3: Commit**

```bash
git add app/\(tabs\)/profile.tsx package.json package-lock.json
git commit -m "feat(profile): QR code, invite_code, and add-friend entry points"
```

---

## Task 17: Pantalla scan de QR

**Files:**
- Create: `app/add-friend/scan.tsx`

- [ ] **Step 17.1: Instalar**

```bash
npx expo install expo-camera
```

Y agregar a `app.json` plugins:
```json
[
  "expo-camera",
  { "cameraPermission": "Necesitamos la cámara para escanear códigos de amigos." }
]
```

- [ ] **Step 17.2: Crear `app/add-friend/scan.tsx`**

```tsx
import { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAddFriend } from "@/hooks/useAddFriend";
import { isValidInviteCode, normalizeInviteCode } from "@/domain/inviteCode";

export default function ScanFriend() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const addFriend = useAddFriend();

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission, requestPermission]);

  const onBarcode = async (data: string) => {
    if (scanned) return;
    setScanned(true);
    const code = normalizeInviteCode(data);
    if (!isValidInviteCode(code)) {
      Alert.alert("Código inválido", "El QR no parece un código válido.", [
        { text: "OK", onPress: () => setScanned(false) }
      ]);
      return;
    }
    try {
      await addFriend.mutateAsync(code);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("¡Amigo agregado!", "Ya pueden ver matches.", [
        { text: "Listo", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("Error", String((e as Error).message ?? e), [
        { text: "Reintentar", onPress: () => setScanned(false) }
      ]);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black p-6">
        <Text className="text-space-mute text-center mb-4">
          Necesitamos permiso de cámara para escanear códigos.
        </Text>
        <Pressable onPress={requestPermission} className="bg-space-purple px-6 py-3 rounded-xl">
          <Text className="text-white font-semibold">Conceder permiso</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => onBarcode(data)}
      />
      <View className="absolute inset-0 items-center justify-center pointer-events-none">
        <View
          style={{
            width: 220,
            height: 220,
            borderColor: "#7c5cff",
            borderWidth: 2,
            borderRadius: 24
          }}
        />
        <Text className="text-white mt-4 text-center px-6">
          Apuntá al QR del código de tu amigo.
        </Text>
      </View>
      <Pressable
        onPress={() => router.back()}
        className="absolute top-12 right-4 bg-black/60 rounded-full px-4 py-2"
      >
        <Text className="text-white">Cerrar</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 17.3: Commit**

```bash
git add app/add-friend/scan.tsx app.json package.json package-lock.json
git commit -m "feat(friends): QR scan screen with expo-camera"
```

---

## Task 18: Pantalla búsqueda por username

**Files:**
- Create: `app/add-friend/search.tsx`

- [ ] **Step 18.1: Crear**

```tsx
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useFindUser } from "@/hooks/useFindUser";
import { requestFriendByUsername } from "@/social/friendships";
import { colors } from "@/theme/colors";

export default function SearchFriend() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const find = useFindUser();
  const [result, setResult] = useState<typeof find.data>(undefined);

  useEffect(() => {
    if (q.length < 3) {
      setResult(undefined);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await find.mutateAsync(q.toLowerCase());
        setResult(r);
      } catch {
        setResult(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const onAdd = async () => {
    if (!result) return;
    try {
      await requestFriendByUsername(result.id);
      Alert.alert("Solicitud enviada", `Le mandaste solicitud a @${result.username}.`, [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("Error", String((e as Error).message ?? e));
    }
  };

  return (
    <StarryBackground>
      <View className="flex-1 px-4 pt-14">
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">
          BUSCAR AMIGO
        </Text>
        <GlowCard className="mb-4">
          <Text className="text-space-mute text-xs mb-1">@username</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="oscar_panini"
            placeholderTextColor={colors.dim}
            autoCapitalize="none"
            autoCorrect={false}
            className="text-space-ink text-base bg-space-mid rounded-md px-3 py-2"
            maxLength={20}
          />
        </GlowCard>

        {find.isPending ? (
          <ActivityIndicator color="#7c5cff" />
        ) : result ? (
          <GlowCard>
            <Text className="text-space-ink text-base font-bold">
              {result.display_name ?? result.username}
            </Text>
            <Text className="text-space-mute text-sm mb-3">@{result.username}</Text>
            <Pressable onPress={onAdd} className="bg-space-purple rounded-lg py-2 items-center">
              <Text className="text-white font-semibold">Enviar solicitud</Text>
            </Pressable>
          </GlowCard>
        ) : result === null ? (
          <Text className="text-space-mute text-center">No encontramos a nadie con ese username.</Text>
        ) : null}
      </View>
    </StarryBackground>
  );
}
```

- [ ] **Step 18.2: Commit**

```bash
git add app/add-friend/search.tsx
git commit -m "feat(friends): username search with debounced lookup"
```

---

## Task 19: Lista de amigos

**Files:**
- Create: `app/friends/index.tsx`

- [ ] **Step 19.1: Crear**

```tsx
import { FlatList, View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useFriends } from "@/hooks/useFriends";
import { useMatches } from "@/hooks/useMatches";

export default function FriendsList() {
  const router = useRouter();
  const { data: friends } = useFriends();
  const { summary } = useMatches();
  const matchMap = new Map(summary.map((s) => [s.friendId, s.matchCount]));

  return (
    <StarryBackground>
      <View className="flex-1 px-4 pt-14">
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">AMIGOS</Text>
        <FlatList
          data={friends ?? []}
          keyExtractor={(f) => f.id}
          ListEmptyComponent={
            <Text className="text-space-mute text-center mt-8">
              Todavía no tenés amigos. Compartí tu código en Perfil.
            </Text>
          }
          renderItem={({ item }) => {
            const count = matchMap.get(item.id) ?? 0;
            return (
              <Pressable onPress={() => router.push(`/friends/${item.username}`)}>
                <GlowCard className="mb-2">
                  <Text className="text-space-ink font-semibold">
                    {item.displayName ?? item.username}
                  </Text>
                  <Text className="text-space-mute text-xs">@{item.username}</Text>
                  {count > 0 && (
                    <Text className="text-space-violet text-xs mt-1">
                      {count} match{count === 1 ? "" : "es"} con vos
                    </Text>
                  )}
                </GlowCard>
              </Pressable>
            );
          }}
        />
      </View>
    </StarryBackground>
  );
}
```

- [ ] **Step 19.2: Commit**

```bash
git add app/friends/index.tsx
git commit -m "feat(friends): friends list screen with match counts"
```

---

## Task 20: Detalle de amigo (bidireccional)

**Files:**
- Create: `app/friends/[username].tsx`

- [ ] **Step 20.1: Crear**

```tsx
import { useEffect, useState } from "react";
import { ScrollView, View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { StarryBackground } from "@/ui/StarryBackground";
import { GlowCard } from "@/ui/GlowCard";
import { supabase } from "@/auth/supabaseClient";
import { useFriends } from "@/hooks/useFriends";
import { listStatuses } from "@/data/stickerStatus";
import { buildBidirectional } from "@/domain/friendMatchBuilder";
import type { BidirectionalMatch, StickerStatus } from "@/domain/types";

export default function FriendDetail() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { data: friends } = useFriends();
  const friend = friends?.find((f) => f.username === username);
  const [match, setMatch] = useState<BidirectionalMatch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!friend) return;
    (async () => {
      setLoading(true);
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

  if (!friend) {
    return (
      <StarryBackground>
        <View className="flex-1 items-center justify-center">
          <Text className="text-space-mute">Amigo no encontrado.</Text>
        </View>
      </StarryBackground>
    );
  }

  return (
    <StarryBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-2">
          @{friend.username}
        </Text>
        <Text className="text-space-ink text-xl font-bold mb-4">
          {friend.displayName ?? friend.username}
        </Text>

        {loading ? (
          <ActivityIndicator color="#7c5cff" />
        ) : match ? (
          <>
            <GlowCard className="mb-3">
              <Text className="text-space-mute text-xs mb-1">TIENE QUE NECESITÁS</Text>
              <Text className="text-space-ink text-2xl font-bold">
                {match.theyHaveYouNeed.length}
              </Text>
              <Text className="text-space-mute text-xs mt-1">
                {match.theyHaveYouNeed
                  .slice(0, 10)
                  .map((m) => m.stickerCode)
                  .join(", ")}
                {match.theyHaveYouNeed.length > 10 ? "…" : ""}
              </Text>
            </GlowCard>

            <GlowCard className="mb-3">
              <Text className="text-space-mute text-xs mb-1">TENÉS QUE NECESITA</Text>
              <Text className="text-space-ink text-2xl font-bold">
                {match.youHaveTheyNeed.length}
              </Text>
              <Text className="text-space-mute text-xs mt-1">
                {match.youHaveTheyNeed
                  .slice(0, 10)
                  .map((m) => m.stickerCode)
                  .join(", ")}
                {match.youHaveTheyNeed.length > 10 ? "…" : ""}
              </Text>
            </GlowCard>
          </>
        ) : null}
      </ScrollView>
    </StarryBackground>
  );
}
```

- [ ] **Step 20.2: Commit**

```bash
git add app/friends/\[username\].tsx
git commit -m "feat(friends): bidirectional friend detail screen"
```

---

## Task 21: Sub-tab Matches real

**Files:**
- Modify: `app/(tabs)/trades.tsx`

- [ ] **Step 21.1: Reemplazar el bloque de "Matches" en `app/(tabs)/trades.tsx`**

Importar arriba:
```tsx
import { useMatches } from "@/hooks/useMatches";
import { useRouter } from "expo-router";
```

Reemplazar la rama del placeholder por:

```tsx
{tab === "matches" ? (
  <MatchesView />
) : ...}
```

Y agregar el componente `MatchesView` al mismo archivo:

```tsx
function MatchesView() {
  const router = useRouter();
  const { summary, isLoading } = useMatches();

  if (isLoading) return <Text className="text-space-mute text-center mt-4">Cargando…</Text>;
  if (summary.length === 0) {
    return (
      <GlowCard>
        <Text className="text-space-mute text-center">
          Todavía no hay matches. Sumá amigos desde Perfil.
        </Text>
      </GlowCard>
    );
  }

  return summary.map((s) => (
    <Pressable key={s.friendId} onPress={() => router.push(`/friends/${s.username}`)}>
      <GlowCard className="mb-2">
        <Text className="text-space-ink font-semibold">@{s.username}</Text>
        <Text className="text-space-mute text-xs mt-1">
          {s.matchCount} {s.matchCount === 1 ? "que te falta" : "que te faltan"}
        </Text>
        <Text className="text-space-violet text-xs mt-1">
          {s.sample.join(" · ")}
          {s.matchCount > 3 ? " · …" : ""}
        </Text>
      </GlowCard>
    </Pressable>
  ));
}
```

- [ ] **Step 21.2: Commit**

```bash
git add app/\(tabs\)/trades.tsx
git commit -m "feat(trades): real Matches sub-tab"
```

---

## Task 22: Bridge Realtime en `_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 22.1: Agregar componente `FriendUpdatesBridge`**

En `app/_layout.tsx`, agregar:

```tsx
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeToFriendUpdates, unsubscribe } from "@/social/realtime";

function FriendUpdatesBridge() {
  const { user } = useSession();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const channel = subscribeToFriendUpdates(() => {
      qc.invalidateQueries({ queryKey: ["matches"] });
    });
    return () => unsubscribe(channel);
  }, [user, qc]);

  return null;
}
```

Y agregarlo dentro del provider, debajo de `<SyncEngine />`:

```tsx
<SessionProvider />
<SyncEngine />
<FriendUpdatesBridge />
```

- [ ] **Step 22.2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(realtime): subscribe to friend updates and invalidate matches"
```

---

## Task 23: Smoke test 2-cuentas + README

**Files:**
- Modify: `README.md`

- [ ] **Step 23.1: Smoke test manual con 2 cuentas**

1. iOS Simulator: crear cuenta A con Google. Marcar 5 stickers, algunos con count=2 (repetidas).
2. Anotar el `invite_code` que aparece en Profile de A.
3. Android Emulator (o segundo Simulator): crear cuenta B. Profile → "Escanear código de amigo" → opcionalmente, en lugar de cámara, abrir la búsqueda por @username y buscar la A. (El scanner de QR del simulador no toma input fácil; el botón "Copiar código" + paste en search es alternativa válida.)
4. Verificar que en B aparece A en "Mis amigos".
5. En B, ir a Cambios → Matches. Debería listar A con los stickers que A tiene repetidos y B no tiene.
6. Tap en la entrada de A → ver detalle bidireccional.
7. En A, marcar otro sticker como repetido. Debería refrescarse en B (Realtime) si el Realtime publication está habilitado.

- [ ] **Step 23.2: Actualizar README**

Reemplazar la sección "Estado actual" por:

```md
## Estado actual: P4

- ✅ Browse del álbum, marcar pegadas/repetidas
- ✅ Progreso por sección
- ✅ Buscador y filtros
- ✅ Auth con Google + Apple
- ✅ Sync de tu progreso entre dispositivos
- ✅ Compartir lista de cambios via share sheet
- ✅ Amigos (QR + invite_code + búsqueda por @)
- ✅ Matches automáticos + Realtime
- ⏳ Pulido visual + release — P5
```

- [ ] **Step 23.3: Commit**

```bash
git add README.md
git commit -m "docs: update README for P4 status"
```

---

## Cierre del P4

Al terminar, el repo tiene:
- 6 migraciones SQL (friendships, RLS friend-aware, view de matches, 2 RPCs, trigger Realtime).
- Capa local de cache de friends y matches.
- 4 hooks TanStack Query para amigos y matches.
- Pantallas: Profile con QR, scan QR, search by username, lista de amigos, detalle bidireccional, sub-tab Matches en Cambios.
- Realtime bridge invalidando matches al recibir cambios.

**Próximo plan:** P5 — Pulido visual final (animaciones, parallax, glow gradient, skeletons, empty states) + builds a TestFlight + Play internal track.
