# Nearby Trade Matches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que usuarios opted-in en una misma ciudad descubran a otros con quienes pueden hacer trades bidireccionales, reusando la infraestructura existente de friendships.

**Architecture:** El servidor calcula scores agregados via vista SQL `v_nearby_matches` (security_invoker=off, no leak de stickers crudos). Los requests son friendship rows con `source='nearby_match'` y mensaje opcional 280 chars. UI agrega un sub-tab "Cerca de mí" en Cambios y un step de location en el onboarding.

**Tech Stack:** Expo Router, Supabase (Postgres + RLS + Realtime), TanStack Query, Zustand, NativeWind, Jest TDD para lógica pura y data layer.

**Reference spec:** `docs/superpowers/specs/2026-05-03-nearby-trade-matches-design.md`

---

## File Structure

**New files:**
```
src/lib/citySlug.ts                    — normalización de ciudad → slug
src/domain/nearbyScore.ts              — score = min, sort, filter (lógica pura)
src/social/locationProfile.ts          — update country/city/discoverable
src/social/nearbyMatches.ts            — fetchers + RPC wrappers
src/hooks/useNearbyMatches.ts          — TanStack Query wrapper
src/hooks/usePendingRequests.ts        — TanStack Query wrapper + count

app/(auth)/location.tsx                — step de country+city+discoverable
app/profile/requests.tsx               — inbox de pending requests
app/nearby/[username].tsx              — modal detalle + request

supabase/migrations/20260503000001_profiles_location.sql
supabase/migrations/20260503000002_friendships_message.sql
supabase/migrations/20260503000003_v_nearby_matches.sql
supabase/migrations/20260503000004_v_pending_requests.sql
supabase/migrations/20260503000005_rpc_nearby_trade.sql
supabase/migrations/20260503000006_rpc_friend_requests.sql

tests/lib/citySlug.test.ts
tests/domain/nearbyScore.test.ts
tests/social/nearbyMatches.test.ts
```

**Modified files:**
```
src/domain/types.ts                    — añade NearbyMatch, PendingRequest, FriendshipSource extra
src/auth/useSession.ts                 — extender ProfileUser con country/city/discoverable
app/(auth)/onboarding.tsx              — al guardar username, ir a /location en lugar de marcar completed
app/profile/edit.tsx                   — añadir sección Ubicación e intercambios
app/(tabs)/profile.tsx                 — link a /profile/requests
app/(tabs)/trades.tsx                  — añadir sub-tab "nearby"
```

---

## Task 1: citySlug utility (TDD)

**Files:**
- Create: `src/lib/citySlug.ts`
- Test: `tests/lib/citySlug.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/citySlug.test.ts
import { citySlug } from "@/lib/citySlug";

describe("citySlug", () => {
  it("lowercases and trims", () => {
    expect(citySlug("  ARMENIA  ")).toBe("armenia");
  });

  it("removes accents", () => {
    expect(citySlug("Bogotá")).toBe("bogota");
    expect(citySlug("São Paulo")).toBe("sao-paulo");
  });

  it("collapses internal spaces to hyphens", () => {
    expect(citySlug("San José de Cúcuta")).toBe("san-jose-de-cucuta");
  });

  it("strips non-alphanumeric except hyphens", () => {
    expect(citySlug("Quito #1!")).toBe("quito-1");
  });

  it("returns empty string for empty input", () => {
    expect(citySlug("")).toBe("");
    expect(citySlug("   ")).toBe("");
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm test tests/lib/citySlug.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement citySlug**

```ts
// src/lib/citySlug.ts
/**
 * Normaliza un nombre de ciudad para hacer match exacto entre usuarios:
 *   "Bogotá"        → "bogota"
 *   "San José"      → "san-jose"
 *   "  ARMENIA  "   → "armenia"
 *   "Quito #1!"     → "quito-1"
 */
export function citySlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")    // strip non-alphanumeric (preserve spaces and hyphens)
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-")             // collapse multiple hyphens
    .replace(/^-|-$/g, "");          // trim leading/trailing hyphens
}
```

- [ ] **Step 4: Verify tests pass**

Run: `pnpm test tests/lib/citySlug.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/citySlug.ts tests/lib/citySlug.test.ts
git commit -m "feat: add citySlug normalizer for nearby matching"
```

---

## Task 2: nearbyScore domain logic (TDD)

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/nearbyScore.ts`
- Test: `tests/domain/nearbyScore.test.ts`

- [ ] **Step 1: Add types**

Modify `src/domain/types.ts`. Add at the end:

```ts
export interface NearbyMatchRaw {
  themId: string;
  username: string;
  displayName: string | null;
  cityLabel: string;
  theyHaveINeed: number;
  iHaveTheyNeed: number;
}

export interface NearbyMatch extends NearbyMatchRaw {
  score: number; // min(theyHaveINeed, iHaveTheyNeed)
}

export interface PendingRequest {
  requesterId: string;
  username: string;
  displayName: string | null;
  cityLabel: string | null;
  message: string | null;
  source: "qr_code" | "username_search" | "nearby_match";
  createdAt: number;
}
```

Also extend `FriendshipSource`:

```ts
export type FriendshipSource = "qr_code" | "username_search" | "nearby_match";
```

- [ ] **Step 2: Write failing tests**

```ts
// tests/domain/nearbyScore.test.ts
import { rankNearbyMatches } from "@/domain/nearbyScore";
import type { NearbyMatchRaw } from "@/domain/types";

const raw = (themId: string, theyHaveINeed: number, iHaveTheyNeed: number, username = themId): NearbyMatchRaw => ({
  themId,
  username,
  displayName: null,
  cityLabel: "Armenia",
  theyHaveINeed,
  iHaveTheyNeed
});

describe("rankNearbyMatches", () => {
  it("computes score = min(theyHaveINeed, iHaveTheyNeed)", () => {
    const r = rankNearbyMatches([raw("a", 10, 3)]);
    expect(r[0].score).toBe(3);
  });

  it("sorts by score desc", () => {
    const r = rankNearbyMatches([
      raw("a", 5, 5),
      raw("b", 10, 10),
      raw("c", 2, 2)
    ]);
    expect(r.map((m) => m.themId)).toEqual(["b", "a", "c"]);
  });

  it("filters out score < 1", () => {
    const r = rankNearbyMatches([
      raw("a", 0, 5),       // score 0
      raw("b", 5, 0),       // score 0
      raw("c", 1, 1),       // score 1
      raw("d", 0, 0)        // score 0
    ]);
    expect(r.map((m) => m.themId)).toEqual(["c"]);
  });

  it("ties break alphabetically by username (stable)", () => {
    const r = rankNearbyMatches([
      raw("a", 5, 5, "zoe"),
      raw("b", 5, 5, "ana"),
      raw("c", 5, 5, "marco")
    ]);
    expect(r.map((m) => m.username)).toEqual(["ana", "marco", "zoe"]);
  });

  it("returns empty array for empty input", () => {
    expect(rankNearbyMatches([])).toEqual([]);
  });
});
```

- [ ] **Step 3: Verify tests fail**

Run: `pnpm test tests/domain/nearbyScore.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement nearbyScore**

```ts
// src/domain/nearbyScore.ts
import type { NearbyMatch, NearbyMatchRaw } from "./types";

/**
 * Calcula score = min(theyHaveINeed, iHaveTheyNeed) para cada match,
 * filtra los que tengan score < 1 (sin trade bidireccional posible),
 * y ordena por score desc, desempatando alfabéticamente por username.
 */
export function rankNearbyMatches(raw: NearbyMatchRaw[]): NearbyMatch[] {
  return raw
    .map((m) => ({ ...m, score: Math.min(m.theyHaveINeed, m.iHaveTheyNeed) }))
    .filter((m) => m.score >= 1)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.username.localeCompare(b.username);
    });
}
```

- [ ] **Step 5: Verify tests pass**

Run: `pnpm test tests/domain/nearbyScore.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/domain/nearbyScore.ts tests/domain/nearbyScore.test.ts
git commit -m "feat: add nearbyScore ranking (min, filter, sort)"
```

---

## Task 3: SQL migration — profiles location columns

**Files:**
- Create: `supabase/migrations/20260503000001_profiles_location.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260503000001_profiles_location.sql

-- Columnas para discovery local
alter table public.profiles
  add column country     text,
  add column city_slug   text,
  add column city_label  text,
  add column discoverable boolean not null default false;

-- Index parcial para que las queries de "cerca de mí" sean rápidas
create index idx_profiles_location on public.profiles (country, city_slug)
  where discoverable = true;

-- Si alguien marca discoverable=true tiene que tener país y ciudad
alter table public.profiles
  add constraint profiles_discoverable_requires_location
  check (
    discoverable = false
    or (country is not null and city_slug is not null)
  );
```

- [ ] **Step 2: Apply locally and verify**

Run: `supabase db push`
Expected: migration applied without errors. Verify in Supabase Studio that the 4 new columns and the constraint exist.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260503000001_profiles_location.sql
git commit -m "feat(db): add country/city/discoverable to profiles"
```

---

## Task 4: SQL migration — friendships message + nearby_match source

**Files:**
- Create: `supabase/migrations/20260503000002_friendships_message.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260503000002_friendships_message.sql

-- Nuevo source para friendships originadas en match nearby
alter type public.friendship_source add value if not exists 'nearby_match';

-- Mensaje opcional adjunto al request (max 280 chars, estilo tweet)
alter table public.friendships
  add column message text check (message is null or length(message) <= 280);
```

- [ ] **Step 2: Apply locally and verify**

Run: `supabase db push`
Expected: applied. Verify the enum has 3 values and `message` column exists.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260503000002_friendships_message.sql
git commit -m "feat(db): add message column + nearby_match source to friendships"
```

---

## Task 5: SQL migration — v_nearby_matches view

**Files:**
- Create: `supabase/migrations/20260503000003_v_nearby_matches.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260503000003_v_nearby_matches.sql

-- Index parcial para acelerar el filter de "extras" (count > 1)
create index if not exists idx_sticker_status_extras
  on public.sticker_status (user_id, sticker_code)
  where count > 1;

-- Vista que calcula matches bidireccionales con usuarios de la misma ciudad.
-- security_invoker=off para que pueda leer sticker_status de otros users SOLO
-- como agregados (count) — los stickers individuales nunca se devuelven.
create view public.v_nearby_matches with (security_invoker = off) as
with me as (
  select id, country, city_slug
  from public.profiles
  where id = auth.uid()
    and discoverable = true
    and country is not null
    and city_slug is not null
),
candidates as (
  select p.id, p.username, p.display_name, p.city_label
  from public.profiles p, me
  where p.id <> me.id
    and p.country = me.country
    and p.city_slug = me.city_slug
    and p.discoverable = true
    and not exists (
      select 1 from public.friendships f
      where (f.user_id = me.id and f.friend_id = p.id)
         or (f.user_id = p.id and f.friend_id = me.id)
    )
),
their_extras as (
  select c.id as them_id, t.sticker_code
  from candidates c
  join public.sticker_status t on t.user_id = c.id and t.count > 1
  left join public.sticker_status m on m.user_id = (select id from me) and m.sticker_code = t.sticker_code
  where coalesce(m.count, 0) = 0
),
my_extras as (
  select c.id as them_id, m.sticker_code
  from candidates c
  join public.sticker_status m on m.user_id = (select id from me) and m.count > 1
  left join public.sticker_status t on t.user_id = c.id and t.sticker_code = m.sticker_code
  where coalesce(t.count, 0) = 0
)
select
  (select id from me)        as me_id,
  c.id                       as them_id,
  c.username,
  c.display_name,
  c.city_label,
  coalesce((select count(*) from their_extras te where te.them_id = c.id), 0)::int as they_have_i_need,
  coalesce((select count(*) from my_extras me2 where me2.them_id = c.id), 0)::int as i_have_they_need
from candidates c;

grant select on public.v_nearby_matches to authenticated;
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db push`
Expected: applied. Try `select * from v_nearby_matches` as a logged-in user — should return 0 rows for a fresh account.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260503000003_v_nearby_matches.sql
git commit -m "feat(db): add v_nearby_matches view with bidirectional scoring"
```

---

## Task 6: SQL migration — v_pending_requests view

**Files:**
- Create: `supabase/migrations/20260503000004_v_pending_requests.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260503000004_v_pending_requests.sql

-- Vista de requests pending recibidos por el usuario actual.
-- security_invoker=on porque la RLS de friendships ya filtra a friend_id=auth.uid().
create view public.v_pending_incoming_requests with (security_invoker = on) as
select
  f.user_id     as requester_id,
  p.username,
  p.display_name,
  p.city_label,
  f.message,
  f.source,
  f.created_at
from public.friendships f
join public.profiles p on p.id = f.user_id
where f.friend_id = auth.uid() and f.status = 'pending';

grant select on public.v_pending_incoming_requests to authenticated;
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db push`
Expected: applied. `select * from v_pending_incoming_requests` returns rows where current user is the recipient.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260503000004_v_pending_requests.sql
git commit -m "feat(db): add v_pending_incoming_requests view"
```

---

## Task 7: SQL migration — request_nearby_trade RPC

**Files:**
- Create: `supabase/migrations/20260503000005_rpc_nearby_trade.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260503000005_rpc_nearby_trade.sql

create function public.request_nearby_trade(target_id uuid, msg text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_count int;
  same_city boolean;
begin
  -- Validar mensaje
  if msg is not null and length(msg) > 280 then
    raise exception 'message_too_long';
  end if;

  -- Validar misma ciudad y ambos discoverable
  select exists (
    select 1
    from public.profiles me, public.profiles them
    where me.id = auth.uid()
      and them.id = target_id
      and me.discoverable = true
      and them.discoverable = true
      and me.country is not distinct from them.country
      and me.city_slug is not distinct from them.city_slug
  ) into same_city;

  if not same_city then
    raise exception 'not_in_same_city';
  end if;

  -- Rate limit: máximo 5 pending por nearby creados por mí en las últimas 24h
  select count(*) into pending_count
  from public.friendships
  where user_id = auth.uid()
    and status = 'pending'
    and source = 'nearby_match'
    and created_at > now() - interval '24 hours';

  if pending_count >= 5 then
    raise exception 'too_many_requests';
  end if;

  -- Crear el row pending. Si ya existe (cualquier estado/source) es no-op.
  insert into public.friendships (user_id, friend_id, status, source, message)
  values (auth.uid(), target_id, 'pending', 'nearby_match', msg)
  on conflict (user_id, friend_id) do nothing;
end;
$$;

grant execute on function public.request_nearby_trade(uuid, text) to authenticated;
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db push`
Expected: applied. Try calling with a fake target_id — should error `not_in_same_city`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260503000005_rpc_nearby_trade.sql
git commit -m "feat(db): add request_nearby_trade RPC with rate limit + validation"
```

---

## Task 8: SQL migration — accept/decline friend request RPCs

**Files:**
- Create: `supabase/migrations/20260503000006_rpc_friend_requests.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260503000006_rpc_friend_requests.sql

create function public.accept_friend_request(requester_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.friendships
    set status = 'accepted'
    where user_id = requester_id
      and friend_id = auth.uid()
      and status = 'pending';

  if not found then
    raise exception 'request_not_found';
  end if;

  -- Mirror row del lado mío
  insert into public.friendships (user_id, friend_id, status, source)
  values (auth.uid(), requester_id, 'accepted', 'nearby_match')
  on conflict (user_id, friend_id) do update set status = 'accepted';
end;
$$;

create function public.decline_friend_request(requester_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friendships
  where user_id = requester_id
    and friend_id = auth.uid()
    and status = 'pending';
end;
$$;

grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.decline_friend_request(uuid) to authenticated;
```

- [ ] **Step 2: Apply and verify**

Run: `supabase db push`
Expected: applied. Functions visible in Supabase Studio under Database → Functions.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260503000006_rpc_friend_requests.sql
git commit -m "feat(db): add accept_friend_request + decline_friend_request RPCs"
```

---

## Task 9: locationProfile data layer

**Files:**
- Create: `src/social/locationProfile.ts`
- Modify: `src/auth/useSession.ts` (extend ProfileUser)

- [ ] **Step 1: Extend ProfileUser type**

In `src/auth/useSession.ts`, modify the `ProfileUser` interface:

```ts
export interface ProfileUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  invite_code: string;
  onboarding_completed: boolean;
  country: string | null;
  city_slug: string | null;
  city_label: string | null;
  discoverable: boolean;
}
```

Then update the two `select` columns in `fetchProfile` (lines ~80 and ~113) to include the new fields:

```ts
.select("id, username, display_name, avatar_url, invite_code, onboarding_completed, country, city_slug, city_label, discoverable")
```

(Both occurrences — initial select and the fallback insert select.)

Update the local `data` type annotation accordingly:

```ts
let data: {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  invite_code: string;
  onboarding_completed: boolean;
  country: string | null;
  city_slug: string | null;
  city_label: string | null;
  discoverable: boolean;
} | null = null;
```

- [ ] **Step 2: Create locationProfile.ts**

```ts
// src/social/locationProfile.ts
import { supabase } from "@/auth/supabaseClient";
import { citySlug } from "@/lib/citySlug";

export interface LocationUpdate {
  country: string | null;     // ISO-2 ('CO', 'MX', 'OT', …) o null para limpiar
  cityLabel: string | null;   // 'Armenia' (display) o null
  discoverable: boolean;
}

/**
 * Persiste país, ciudad y flag de discoverable. La validación de constraint la
 * hace Postgres (discoverable=true requiere country y city_slug no nulos).
 */
export async function updateLocation(userId: string, u: LocationUpdate): Promise<void> {
  const slug = u.cityLabel ? citySlug(u.cityLabel) : null;
  const { error } = await supabase
    .from("profiles")
    .update({
      country: u.country,
      city_label: u.cityLabel,
      city_slug: slug,
      discoverable: u.discoverable
    })
    .eq("id", userId);
  if (error) throw error;
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 4: Commit**

```bash
git add src/auth/useSession.ts src/social/locationProfile.ts
git commit -m "feat: add updateLocation + extend ProfileUser with location fields"
```

---

## Task 10: nearbyMatches data layer (TDD for shape mapping)

**Files:**
- Create: `src/social/nearbyMatches.ts`
- Test: `tests/social/nearbyMatches.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/social/nearbyMatches.test.ts
import { mapNearbyRow, mapPendingRow } from "@/social/nearbyMatches";

describe("mapNearbyRow", () => {
  it("converts snake_case row from view to NearbyMatchRaw", () => {
    const row = {
      me_id: "u1",
      them_id: "u2",
      username: "maria",
      display_name: "María",
      city_label: "Armenia",
      they_have_i_need: 12,
      i_have_they_need: 8
    };
    expect(mapNearbyRow(row)).toEqual({
      themId: "u2",
      username: "maria",
      displayName: "María",
      cityLabel: "Armenia",
      theyHaveINeed: 12,
      iHaveTheyNeed: 8
    });
  });

  it("preserves null displayName", () => {
    const row = {
      me_id: "u1",
      them_id: "u2",
      username: "maria",
      display_name: null,
      city_label: "Armenia",
      they_have_i_need: 0,
      i_have_they_need: 0
    };
    expect(mapNearbyRow(row).displayName).toBeNull();
  });
});

describe("mapPendingRow", () => {
  it("converts row to PendingRequest with parsed timestamp", () => {
    const row = {
      requester_id: "u3",
      username: "juan",
      display_name: null,
      city_label: "Armenia",
      message: "vi que tenés Messi",
      source: "nearby_match" as const,
      created_at: "2026-05-03T17:00:00Z"
    };
    const out = mapPendingRow(row);
    expect(out.requesterId).toBe("u3");
    expect(out.message).toBe("vi que tenés Messi");
    expect(out.source).toBe("nearby_match");
    expect(out.createdAt).toBe(Date.parse("2026-05-03T17:00:00Z"));
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm test tests/social/nearbyMatches.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement nearbyMatches.ts**

```ts
// src/social/nearbyMatches.ts
import { supabase } from "@/auth/supabaseClient";
import type { NearbyMatchRaw, PendingRequest, FriendshipSource } from "@/domain/types";

interface NearbyRow {
  me_id: string;
  them_id: string;
  username: string;
  display_name: string | null;
  city_label: string;
  they_have_i_need: number;
  i_have_they_need: number;
}

interface PendingRow {
  requester_id: string;
  username: string;
  display_name: string | null;
  city_label: string | null;
  message: string | null;
  source: FriendshipSource;
  created_at: string;
}

export function mapNearbyRow(r: NearbyRow): NearbyMatchRaw {
  return {
    themId: r.them_id,
    username: r.username,
    displayName: r.display_name,
    cityLabel: r.city_label,
    theyHaveINeed: r.they_have_i_need,
    iHaveTheyNeed: r.i_have_they_need
  };
}

export function mapPendingRow(r: PendingRow): PendingRequest {
  return {
    requesterId: r.requester_id,
    username: r.username,
    displayName: r.display_name,
    cityLabel: r.city_label,
    message: r.message,
    source: r.source,
    createdAt: Date.parse(r.created_at)
  };
}

export async function fetchNearbyMatches(): Promise<NearbyMatchRaw[]> {
  const { data, error } = await supabase
    .from("v_nearby_matches")
    .select("me_id, them_id, username, display_name, city_label, they_have_i_need, i_have_they_need");
  if (error) throw error;
  return (data ?? []).map(mapNearbyRow);
}

export async function fetchPendingRequests(): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from("v_pending_incoming_requests")
    .select("requester_id, username, display_name, city_label, message, source, created_at");
  if (error) throw error;
  return (data ?? []).map(mapPendingRow);
}

export async function requestNearbyTrade(targetId: string, message: string | null): Promise<void> {
  const { error } = await supabase.rpc("request_nearby_trade", { target_id: targetId, msg: message });
  if (error) throw error;
}

export async function acceptFriendRequest(requesterId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_friend_request", { requester_id: requesterId });
  if (error) throw error;
}

export async function declineFriendRequest(requesterId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_friend_request", { requester_id: requesterId });
  if (error) throw error;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `pnpm test tests/social/nearbyMatches.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/social/nearbyMatches.ts tests/social/nearbyMatches.test.ts
git commit -m "feat: add nearbyMatches fetchers + RPC wrappers + row mappers"
```

---

## Task 11: TanStack Query hooks

**Files:**
- Create: `src/hooks/useNearbyMatches.ts`
- Create: `src/hooks/usePendingRequests.ts`

- [ ] **Step 1: Implement useNearbyMatches**

```ts
// src/hooks/useNearbyMatches.ts
import { useQuery } from "@tanstack/react-query";
import { fetchNearbyMatches } from "@/social/nearbyMatches";
import { rankNearbyMatches } from "@/domain/nearbyScore";

export function useNearbyMatches() {
  return useQuery({
    queryKey: ["nearbyMatches"],
    queryFn: async () => {
      const raw = await fetchNearbyMatches();
      return rankNearbyMatches(raw);
    },
    staleTime: 60_000
  });
}
```

- [ ] **Step 2: Implement usePendingRequests**

```ts
// src/hooks/usePendingRequests.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPendingRequests,
  acceptFriendRequest,
  declineFriendRequest
} from "@/social/nearbyMatches";

export function usePendingRequests() {
  return useQuery({
    queryKey: ["pendingRequests"],
    queryFn: fetchPendingRequests,
    staleTime: 30_000
  });
}

export function usePendingRequestsCount() {
  const q = usePendingRequests();
  return q.data?.length ?? 0;
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendingRequests"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] });
    }
  });
}

export function useDeclineRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendingRequests"] });
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] });
    }
  });
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useNearbyMatches.ts src/hooks/usePendingRequests.ts
git commit -m "feat: add useNearbyMatches + usePendingRequests hooks"
```

---

## Task 12: Onboarding location step

**Files:**
- Create: `app/(auth)/location.tsx`
- Modify: `app/(auth)/onboarding.tsx`
- Modify: `app/(auth)/_layout.tsx` (registrar la nueva ruta si fuese necesario)

- [ ] **Step 1: Create the location screen**

```tsx
// app/(auth)/location.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, Switch, ScrollView } from "react-native";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useSession, useSessionStore } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";
import { updateLocation } from "@/social/locationProfile";
import { useTheme } from "@/theme/ThemeProvider";

const COUNTRIES: { code: string; label: string }[] = [
  { code: "AR", label: "Argentina" },
  { code: "BR", label: "Brasil" },
  { code: "CO", label: "Colombia" },
  { code: "MX", label: "México" },
  { code: "US", label: "Estados Unidos" },
  { code: "CA", label: "Canadá" },
  { code: "ES", label: "España" },
  { code: "FR", label: "Francia" },
  { code: "DE", label: "Alemania" },
  { code: "PT", label: "Portugal" },
  { code: "UY", label: "Uruguay" },
  { code: "EC", label: "Ecuador" },
  { code: "PY", label: "Paraguay" },
  { code: "CL", label: "Chile" },
  { code: "PE", label: "Perú" },
  { code: "JP", label: "Japón" },
  { code: "KR", label: "Corea del Sur" },
  // (Lista corta para MVP — expandible. "OT" cubre el resto.)
  { code: "OT", label: "Otro" }
];

export default function LocationStep() {
  const { user } = useSession();
  const { theme } = useTheme();
  const [country, setCountry] = useState<string | null>("CO"); // default Colombia
  const [city, setCity] = useState("");
  const [discoverable, setDiscoverable] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const canContinue = !discoverable || (country !== null && city.trim().length > 0);

  const onSave = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      await updateLocation(user.id, {
        country: discoverable ? country : null,
        cityLabel: discoverable ? city.trim() : null,
        discoverable
      });
      // Marcar onboarding completo
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);
      if (error) throw error;
      // Reflejar en el store
      useSessionStore.getState().setProfile({
        ...user,
        country: discoverable ? country : null,
        city_label: discoverable ? city.trim() : null,
        city_slug: null, // recalculado server-side via update
        discoverable,
        onboarding_completed: true
      });
    } catch (e: unknown) {
      Alert.alert("No se pudo guardar", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-6 pt-24" keyboardShouldPersistTaps="handled">
        <Text className="text-space-violet font-bold text-2xl mb-1">¿Dónde estás?</Text>
        <Text className="text-space-mute mb-6">
          Para que personas de tu ciudad puedan proponerte intercambios.
        </Text>

        <GlowCard className="mb-3">
          <Text className="text-space-mute text-xs mb-2">País</Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {COUNTRIES.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => setCountry(c.code)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: country === c.code ? theme.accent : theme.card,
                  borderWidth: 1,
                  borderColor: theme.border
                }}
                accessibilityRole="button"
                accessibilityLabel={`País ${c.label}`}
                accessibilityState={{ selected: country === c.code }}
              >
                <Text style={{ color: country === c.code ? "#fff" : theme.text, fontSize: 13 }}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlowCard>

        <GlowCard className="mb-3">
          <Text className="text-space-mute text-xs mb-1">Ciudad</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Armenia"
            placeholderTextColor={theme.textMute}
            autoCapitalize="words"
            autoCorrect={false}
            className="text-space-ink text-base bg-space-mid rounded-md px-3 py-2"
            maxLength={50}
          />
        </GlowCard>

        <GlowCard className="mb-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-space-ink text-base font-semibold">
                Que me encuentren para intercambiar
              </Text>
              <Text className="text-space-mute text-xs mt-1">
                Personas de tu ciudad podrán mandarte solicitudes. Lo apagás cuando quieras desde Perfil.
              </Text>
            </View>
            <Switch
              value={discoverable}
              onValueChange={setDiscoverable}
              trackColor={{ false: theme.textMute, true: theme.accent }}
              thumbColor={theme.card}
              accessibilityRole="switch"
              accessibilityLabel="Discoverable"
              accessibilityState={{ checked: discoverable }}
            />
          </View>
        </GlowCard>

        <Pressable
          disabled={!canContinue || saving}
          onPress={onSave}
          className={`rounded-xl py-4 items-center ${canContinue ? "bg-space-purple" : "bg-space-mid"}`}
          accessibilityLabel="Continuar"
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Continuar</Text>}
        </Pressable>
      </ScrollView>
    </ThemedBackground>
  );
}
```

- [ ] **Step 2: Modify onboarding.tsx (username step) to navigate to location**

In `app/(auth)/onboarding.tsx`, replace the `onSave` function. Currently it sets `onboarding_completed=true` and updates the local store. Now it should set `username` only and navigate to `/location`.

Replace lines 40-60 (the current `onSave` body) with:

```ts
  const onSave = async () => {
    if (state !== "valid" || !user) return;
    Keyboard.dismiss();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: value })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      Alert.alert("No se pudo guardar", error.message);
      return;
    }
    // Reflejar el username en el store; onboarding_completed lo marcará el step de location.
    useSessionStore.getState().setProfile({
      ...user,
      username: value
    });
    router.push("/(auth)/location" as never);
  };
```

Then add `import { useRouter } from "expo-router";` at the top, and `const router = useRouter();` inside the component.

- [ ] **Step 3: Verify the (auth) layout doesn't need changes**

Read `app/(auth)/_layout.tsx`. Expo Router auto-routes files in `(auth)/`, so `location.tsx` is reachable as `/(auth)/location` without additional config. Confirm by viewing the file — should have a `<Stack>` or similar wrapping. If the layout uses an explicit `<Stack.Screen name="…">` whitelist, add the new screen there.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 5: Manual smoke test**

1. Apply migrations + restart Metro.
2. Sign out and sign in fresh (or wipe profile.onboarding_completed manually in Supabase).
3. Pick a username, hit Continue.
4. Should land on the location screen.
5. Pick country, type city, leave discoverable=on, hit Continue → should land on home.
6. Verify in Supabase that `country`, `city_slug`, `city_label`, `discoverable` are populated and `onboarding_completed=true`.

- [ ] **Step 6: Commit**

```bash
git add app/(auth)/location.tsx app/(auth)/onboarding.tsx
git commit -m "feat: add location step in onboarding (country + city + discoverable)"
```

---

## Task 13: Profile edit — location section

**Files:**
- Modify: `app/profile/edit.tsx`

- [ ] **Step 1: Add location section to edit.tsx**

Replace the entire content of `app/profile/edit.tsx` with:

```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, Switch } from "react-native";
import { useRouter } from "expo-router";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useSession, useSessionStore } from "@/auth/useSession";
import { supabase } from "@/auth/supabaseClient";
import { updateLocation } from "@/social/locationProfile";
import { citySlug } from "@/lib/citySlug";
import { useTheme } from "@/theme/ThemeProvider";

const COUNTRIES = [
  { code: "AR", label: "Argentina" },
  { code: "BR", label: "Brasil" },
  { code: "CO", label: "Colombia" },
  { code: "MX", label: "México" },
  { code: "US", label: "Estados Unidos" },
  { code: "CA", label: "Canadá" },
  { code: "ES", label: "España" },
  { code: "FR", label: "Francia" },
  { code: "DE", label: "Alemania" },
  { code: "PT", label: "Portugal" },
  { code: "UY", label: "Uruguay" },
  { code: "EC", label: "Ecuador" },
  { code: "PY", label: "Paraguay" },
  { code: "CL", label: "Chile" },
  { code: "PE", label: "Perú" },
  { code: "JP", label: "Japón" },
  { code: "KR", label: "Corea del Sur" },
  { code: "OT", label: "Otro" }
];

export default function EditProfile() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSession();
  const [name, setName] = useState(user?.display_name ?? "");
  const [country, setCountry] = useState<string | null>(user?.country ?? null);
  const [city, setCity] = useState(user?.city_label ?? "");
  const [discoverable, setDiscoverable] = useState(user?.discoverable ?? false);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const onSave = async () => {
    if (name.trim().length < 1) {
      Alert.alert("Nombre vacío", "Poné al menos un caracter.");
      return;
    }
    if (discoverable && (!country || city.trim().length === 0)) {
      Alert.alert("Faltan datos", "Si querés ser discoverable, necesitás país y ciudad.");
      return;
    }
    setSaving(true);
    try {
      // Display name
      const { error: nameErr } = await supabase
        .from("profiles")
        .update({ display_name: name.trim() })
        .eq("id", user.id);
      if (nameErr) throw nameErr;

      // Location + discoverable
      await updateLocation(user.id, {
        country: discoverable ? country : null,
        cityLabel: discoverable ? city.trim() : null,
        discoverable
      });

      // Reflejar en el store
      useSessionStore.getState().setProfile({
        ...user,
        display_name: name.trim(),
        country: discoverable ? country : null,
        city_label: discoverable ? city.trim() : null,
        city_slug: discoverable && city.trim().length > 0 ? citySlug(city.trim()) : null,
        discoverable
      });
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">EDITAR</Text>

        <GlowCard className="mb-4">
          <Text className="text-space-mute text-xs mb-1">Nombre para mostrar</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Tu nombre"
            placeholderTextColor={theme.textMute}
            className="text-space-ink text-base bg-space-mid rounded-md px-3 py-2"
            maxLength={40}
          />
        </GlowCard>

        <Text className="text-space-mute text-xs tracking-widest mb-2 mt-2">UBICACIÓN E INTERCAMBIOS</Text>

        <GlowCard className="mb-3">
          <Text className="text-space-mute text-xs mb-2">País</Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {COUNTRIES.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => setCountry(c.code)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: country === c.code ? theme.accent : theme.card,
                  borderWidth: 1,
                  borderColor: theme.border
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: country === c.code }}
              >
                <Text style={{ color: country === c.code ? "#fff" : theme.text, fontSize: 13 }}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlowCard>

        <GlowCard className="mb-3">
          <Text className="text-space-mute text-xs mb-1">Ciudad</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Armenia"
            placeholderTextColor={theme.textMute}
            autoCapitalize="words"
            autoCorrect={false}
            className="text-space-ink text-base bg-space-mid rounded-md px-3 py-2"
            maxLength={50}
          />
        </GlowCard>

        <GlowCard className="mb-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-space-ink text-base font-semibold">Que me encuentren</Text>
              <Text className="text-space-mute text-xs mt-1">
                Si lo apagás, dejás de aparecer en "Cerca de mí" de otros. Tus matches con amigos siguen igual.
              </Text>
            </View>
            <Switch
              value={discoverable}
              onValueChange={setDiscoverable}
              trackColor={{ false: theme.textMute, true: theme.accent }}
              thumbColor={theme.card}
              accessibilityRole="switch"
              accessibilityState={{ checked: discoverable }}
            />
          </View>
        </GlowCard>

        <Pressable
          onPress={onSave}
          disabled={saving}
          className="bg-space-purple rounded-xl py-4 items-center mb-2"
          accessibilityLabel="Guardar"
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Guardar</Text>}
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          className="py-3 items-center"
          accessibilityLabel="Cancelar"
          accessibilityRole="button"
        >
          <Text className="text-space-mute">Cancelar</Text>
        </Pressable>
      </ScrollView>
    </ThemedBackground>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 3: Commit**

```bash
git add app/profile/edit.tsx
git commit -m "feat: add location section to profile edit"
```

---

## Task 14: Pending requests inbox screen + Profile link

**Files:**
- Create: `app/profile/requests.tsx`
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Create the requests inbox**

```tsx
// app/profile/requests.tsx
import { ScrollView, View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { EmptyState } from "@/ui/EmptyState";
import {
  usePendingRequests,
  useAcceptRequest,
  useDeclineRequest
} from "@/hooks/usePendingRequests";
import { useTheme } from "@/theme/ThemeProvider";

export default function RequestsInbox() {
  const router = useRouter();
  const { theme } = useTheme();
  const { data, isLoading } = usePendingRequests();
  const accept = useAcceptRequest();
  const decline = useDeclineRequest();

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>Solicitudes</Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Volver"
            accessibilityRole="button"
          >
            <Text style={{ color: theme.textMute, fontSize: 14 }}>‹ Volver</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={theme.accent} />
        ) : !data || data.length === 0 ? (
          <EmptyState variant="rocket" title="Sin solicitudes" message="Cuando alguien te pida un intercambio, aparece acá." />
        ) : (
          data.map((r) => (
            <GlowCard key={r.requesterId} className="mb-3">
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
                @{r.username}
                {r.cityLabel ? <Text style={{ color: theme.textMute, fontSize: 12, fontWeight: "400" }}>  · {r.cityLabel}</Text> : null}
              </Text>
              {r.message ? (
                <Text style={{ color: theme.text, fontSize: 14, marginTop: 6 }}>"{r.message}"</Text>
              ) : null}
              <View className="flex-row mt-3" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => accept.mutate(r.requesterId)}
                  disabled={accept.isPending || decline.isPending}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: theme.accent,
                    alignItems: "center"
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Aceptar solicitud de ${r.username}`}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Aceptar</Text>
                </Pressable>
                <Pressable
                  onPress={() => decline.mutate(r.requesterId)}
                  disabled={accept.isPending || decline.isPending}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.border,
                    alignItems: "center"
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Rechazar solicitud de ${r.username}`}
                >
                  <Text style={{ color: theme.textMute, fontWeight: "700" }}>Rechazar</Text>
                </Pressable>
              </View>
            </GlowCard>
          ))
        )}
      </ScrollView>
    </ThemedBackground>
  );
}
```

- [ ] **Step 2: Add link in Profile tab**

In `app/(tabs)/profile.tsx`, find the block of "Mis amigos" Pressable (around line 114-121) and insert above it (or below it) a new Pressable:

```tsx
<Pressable
  onPress={() => router.push("/profile/requests" as never)}
  className="bg-space-mid rounded-xl py-3 items-center mb-2"
  accessibilityLabel="Solicitudes"
  accessibilityRole="button"
>
  <Text className="text-space-ink font-semibold">📨 Solicitudes</Text>
</Pressable>
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 4: Commit**

```bash
git add app/profile/requests.tsx app/(tabs)/profile.tsx
git commit -m "feat: add pending requests inbox screen + profile link"
```

---

## Task 15: Tab "Cerca de mí" en Cambios

**Files:**
- Modify: `app/(tabs)/trades.tsx`

- [ ] **Step 1: Modify trades.tsx**

Replace the `Tab` type and the `MatchesView` import block. The full updated file should:

1. Add `nearby` to the `Tab` type.
2. Add a third option to the SegmentedControl.
3. Render `<NearbyView />` when `tab === "nearby"`.

Replace the file contents with:

```tsx
import { useState } from "react";
import { ScrollView, View, Text, Pressable, Switch, Share } from "react-native";
import { useRouter } from "expo-router";
import { haptics } from "@/lib/haptics";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { GlowGradientCard } from "@/ui/GlowGradientCard";
import { EmptyState } from "@/ui/EmptyState";
import { SegmentedControl } from "@/ui/SegmentedControl";
import { ProgressBar } from "@/ui/ProgressBar";
import { useMyList } from "@/hooks/useMyList";
import { useMatches } from "@/hooks/useMatches";
import { useNearbyMatches } from "@/hooks/useNearbyMatches";
import { useTradePrefs } from "@/store/tradePreferences";
import { useSession } from "@/auth/useSession";
import { useTheme } from "@/theme/ThemeProvider";

type Tab = "matches" | "mine" | "nearby";

export default function Trades() {
  const [tab, setTab] = useState<Tab>("mine");
  const { data, text, isLoading } = useMyList();
  const { groupBySection, setGroupBySection } = useTradePrefs();
  const { theme } = useTheme();

  const onShare = async () => {
    if (!text) return;
    await haptics.success();
    await Share.share({ message: text, title: "Mi lista de cambios" });
  };

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-space-violet font-bold tracking-widest text-sm mb-4">CAMBIOS</Text>

        <View className="mb-4">
          <SegmentedControl<Tab>
            options={[
              { value: "matches", label: "Matches" },
              { value: "mine", label: "Mi lista" },
              { value: "nearby", label: "Cerca de mí" }
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === "matches" ? (
          <MatchesView />
        ) : tab === "nearby" ? (
          <NearbyView />
        ) : isLoading || !data ? (
          <Text className="text-space-mute text-center mt-4">Cargando…</Text>
        ) : (
          <>
            <View className="flex-row gap-3 mb-3">
              <GlowCard className="flex-1">
                <Text className="text-space-mute text-xs">NECESITO</Text>
                <Text className="text-space-ink text-2xl font-bold">{data.needed.length}</Text>
              </GlowCard>
              <GlowCard className="flex-1">
                <Text className="text-space-mute text-xs">REPETIDAS</Text>
                <Text className="text-space-ink text-2xl font-bold">{data.duplicates.length}</Text>
              </GlowCard>
            </View>

            <GlowCard className="mb-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-space-ink text-sm">Agrupar por sección</Text>
                <Switch
                  value={groupBySection}
                  onValueChange={setGroupBySection}
                  trackColor={{ false: theme.textMute, true: theme.accent }}
                  thumbColor={theme.card}
                />
              </View>
            </GlowCard>

            <GlowCard className="mb-4">
              <Text className="text-space-mute text-xs mb-2 tracking-widest">VISTA PREVIA</Text>
              <Text className="text-space-ink text-xs" style={{ fontFamily: "Courier" }}>
                {text || "Sin contenido para compartir aún."}
              </Text>
            </GlowCard>

            <GlowGradientCard>
              <Pressable
                onPress={onShare}
                disabled={!text}
                className={`rounded-xl py-4 items-center ${text ? "" : "opacity-50"}`}
                accessibilityLabel="Compartir mi lista"
                accessibilityRole="button"
              >
                <Text className="text-white font-semibold">Compartir mi lista</Text>
              </Pressable>
            </GlowGradientCard>
          </>
        )}
      </ScrollView>
    </ThemedBackground>
  );
}

function MatchesView() {
  const router = useRouter();
  const { summary, isLoading } = useMatches();

  if (isLoading) return <Text className="text-space-mute text-center mt-4">Cargando…</Text>;
  if (summary.length === 0) {
    return <EmptyState variant="rocket" title="Sin matches todavía" message="Sumá amigos desde Perfil." />;
  }

  return (
    <>
      {summary.map((s) => (
        <Pressable
          key={s.friendId}
          onPress={() => router.push(`/friends/${s.username}` as never)}
          accessibilityLabel={`Ver matches con @${s.username}`}
          accessibilityRole="button"
        >
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
      ))}
    </>
  );
}

function NearbyView() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSession();
  const { data, isLoading } = useNearbyMatches();

  if (!user?.discoverable) {
    return (
      <EmptyState
        variant="rocket"
        title="Activá la discoverabilidad"
        message="Andá a Perfil → Editar para activar 'Que me encuentren' y que personas de tu ciudad puedan contactarte."
      />
    );
  }
  if (isLoading) return <Text className="text-space-mute text-center mt-4">Cargando…</Text>;
  if (!data || data.length === 0) {
    return <EmptyState variant="rocket" title="Sin matches cerca todavía" message={`Nadie en ${user.city_label ?? "tu ciudad"} tiene complementarios con vos por ahora. Volvé después.`} />;
  }

  return (
    <>
      {data.map((m) => {
        const maxScore = data[0]?.score ?? m.score;
        const pct = maxScore > 0 ? m.score / maxScore : 0;
        return (
          <Pressable
            key={m.themId}
            onPress={() => router.push(`/nearby/${m.username}` as never)}
            accessibilityLabel={`Ver match con @${m.username}, score ${m.score}`}
            accessibilityRole="button"
          >
            <GlowCard className="mb-2">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-space-ink font-semibold">@{m.username}</Text>
                <Text style={{ color: theme.accent, fontWeight: "700" }}>score {m.score}</Text>
              </View>
              <Text className="text-space-mute text-xs mb-2">
                necesitás {m.theyHaveINeed} · podés dar {m.iHaveTheyNeed}
              </Text>
              <ProgressBar pct={pct} height={3} from={theme.accent} to={theme.accent} />
            </GlowCard>
          </Pressable>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/trades.tsx
git commit -m "feat: add 'Cerca de mí' tab in Cambios with ranked nearby matches"
```

---

## Task 16: Modal de detalle + request — `app/nearby/[username].tsx`

**Files:**
- Create: `app/nearby/[username].tsx`

- [ ] **Step 1: Create the modal screen**

```tsx
// app/nearby/[username].tsx
import { useMemo, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ThemedBackground } from "@/ui/ThemedBackground";
import { GlowCard } from "@/ui/GlowCard";
import { useNearbyMatches } from "@/hooks/useNearbyMatches";
import { requestNearbyTrade } from "@/social/nearbyMatches";
import { useTheme } from "@/theme/ThemeProvider";

export default function NearbyDetail() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const { data } = useNearbyMatches();
  const [msg, setMsg] = useState("");

  const match = useMemo(() => data?.find((m) => m.username === username) ?? null, [data, username]);

  const send = useMutation({
    mutationFn: (m: { id: string; message: string | null }) => requestNearbyTrade(m.id, m.message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nearbyMatches"] });
      Alert.alert("Solicitud enviada", "Si la acepta, los datos van a aparecer en Matches.");
      router.back();
    },
    onError: (e: unknown) => {
      const msg = (e as Error).message;
      const human =
        msg.includes("too_many_requests") ? "Llegaste al límite de 5 solicitudes pending por día. Esperá a que respondan."
        : msg.includes("not_in_same_city") ? "Esta persona ya no está en tu ciudad o se desactivó."
        : msg.includes("message_too_long") ? "El mensaje no puede tener más de 280 caracteres."
        : msg;
      Alert.alert("No se pudo enviar", human);
    }
  });

  if (!match) {
    return (
      <ThemedBackground>
        <View className="flex-1 items-center justify-center px-6">
          <Text style={{ color: theme.textMute }}>Match no encontrado.</Text>
          <Pressable onPress={() => router.back()} className="mt-4">
            <Text style={{ color: theme.accent }}>Volver</Text>
          </Pressable>
        </View>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground>
      <ScrollView className="flex-1 px-4 pt-14" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between mb-4">
          <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>@{match.username}</Text>
          <Pressable onPress={() => router.back()} accessibilityLabel="Cerrar" accessibilityRole="button">
            <Text style={{ color: theme.textMute }}>✕</Text>
          </Pressable>
        </View>

        <Text style={{ color: theme.textMute, fontSize: 13, marginBottom: 16 }}>
          {match.cityLabel} · score {match.score}
        </Text>

        <GlowCard className="mb-3">
          <Text className="text-space-mute text-xs tracking-widest mb-1">ELLOS TIENEN, VOS NECESITÁS</Text>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800" }}>{match.theyHaveINeed}</Text>
        </GlowCard>

        <GlowCard className="mb-4">
          <Text className="text-space-mute text-xs tracking-widest mb-1">VOS TENÉS, ELLOS NECESITAN</Text>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "800" }}>{match.iHaveTheyNeed}</Text>
        </GlowCard>

        <GlowCard className="mb-4">
          <Text className="text-space-mute text-xs mb-1">Mensaje (opcional)</Text>
          <TextInput
            value={msg}
            onChangeText={setMsg}
            placeholder="vi que tenés Messi argentino…"
            placeholderTextColor={theme.textMute}
            multiline
            maxLength={280}
            style={{
              color: theme.text,
              backgroundColor: theme.card,
              borderRadius: 8,
              padding: 10,
              minHeight: 60,
              fontSize: 14
            }}
          />
          <Text style={{ color: theme.textMute, fontSize: 11, marginTop: 4, textAlign: "right" }}>
            {msg.length}/280
          </Text>
        </GlowCard>

        <Pressable
          onPress={() => send.mutate({ id: match.themId, message: msg.trim() || null })}
          disabled={send.isPending}
          className="bg-space-purple rounded-xl py-4 items-center"
          accessibilityRole="button"
          accessibilityLabel="Solicitar trade"
        >
          {send.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Solicitar trade</Text>}
        </Pressable>
      </ScrollView>
    </ThemedBackground>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 3: Manual smoke test (requires 2 accounts)**

1. Setup user A (Armenia, CO, discoverable=true) with some stickers.
2. Setup user B (Armenia, CO, discoverable=true) with complementary stickers.
3. Logueado como A: tab Cambios → Cerca de mí → debe aparecer @userB.
4. Tap → modal → escribir mensaje → Solicitar trade.
5. Switch a user B: Profile → Solicitudes → debe aparecer la request con el mensaje.
6. Aceptar → friendship pasa a accepted.
7. Volver a A: tab Cambios → Matches → @userB con sus matches.

- [ ] **Step 4: Commit**

```bash
git add app/nearby/[username].tsx
git commit -m "feat: add nearby match detail modal with optional message + request"
```

---

## Task 17: Final TS + tests run + final commit

**Files:**
- (Verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: 65+ tests pass (62 originales + 3 nuevos: citySlug 5 tests, nearbyScore 5 tests, nearbyMatches 3 tests).

- [ ] **Step 2: Run typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: EXIT=0

- [ ] **Step 3: Run linter (if configured)**

Run: `pnpm exec eslint .`
Expected: clean.

- [ ] **Step 4: Final smoke test checklist**

Verify each Definition of Done item from the spec:
- [ ] Migraciones aplicadas (verificar en Supabase Studio).
- [ ] Onboarding nuevo paso integrado.
- [ ] Profile edit muestra y persiste country/city/discoverable.
- [ ] Tab "Cerca de mí" lista usuarios y abre modal.
- [ ] Request llega vía realtime al inbox del receptor (testear con 2 cuentas).
- [ ] Aceptar request mueve la friendship a accepted (verificar en Supabase + en tab Matches).
- [ ] Apagar discoverable saca al usuario del pool (testear con 2 cuentas, una apaga, la otra refetch).
- [ ] Rate limit dispara error tipado y UI lo muestra (intentar 6 requests rápidos).

---

## Self-review notes

**Coverage de spec:**
- ✅ Profiles location columns → Task 3
- ✅ Friendships message + nearby_match source → Task 4
- ✅ v_nearby_matches view → Task 5
- ✅ v_pending_incoming_requests → Task 6
- ✅ request_nearby_trade RPC → Task 7
- ✅ accept/decline RPCs → Task 8
- ✅ citySlug normalization → Task 1
- ✅ nearbyScore (min, sort, filter ≥1) → Task 2
- ✅ Onboarding step → Task 12
- ✅ Profile edit location section → Task 13
- ✅ Pending inbox → Task 14
- ✅ Tab "Cerca de mí" → Task 15
- ✅ Modal request con mensaje → Task 16
- ✅ Tests TDD → Tasks 1, 2, 10
- ✅ Realtime: usa el bridge existente; sin trabajo nuevo. (NB: Task 16 step 3 sugiere testear flujo realtime end-to-end.)

**Lo que dejo deferred a v2 (consistente con el spec):**
- Bloqueo desde el modal — agregable con un botón secundario que llame `delete from friendships where user_id=auth.uid() and friend_id=target_id` + insert con status='blocked'. No incluido en este plan; se levanta como follow-up cuando aparezca.
- Push notifications — pendiente Apple Developer license.
- Cancel sent request — receptor decide.

**Nota sobre Realtime**: el bridge `app/_layout.tsx` ya escucha cambios en `friendships`. Cuando entre un row pending nuevo donde `friend_id = auth.uid()`, TanStack Query refetchea `pendingRequests` automáticamente si la subscription invalida la queryKey. **Verificar al ejecutar Task 16 step 3** que la subscription incluye `friend_id=auth.uid()` y dispara invalidación de `["pendingRequests"]`. Si no, agregar la invalidación al listener — fix chico, no hace falta una task aparte.
