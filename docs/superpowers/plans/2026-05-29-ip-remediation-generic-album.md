# IP Remediation — Generic Sticker Album Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove FIFA-resembling content (visible `FWC-*`/`CC*` sticker codes, the exact official album count) and reframe the app as a generic sticker-album tracker, to clear Apple App Review rejection 5.2.1.

**Architecture:** `scripts/gen-stickers.js` is the source of truth for `assets/stickers.json`. Renaming the special-section codes there and bumping the dataset `version` triggers the existing boot-time re-seed (`src/data/seed.ts` does `DELETE FROM stickers` + re-insert on a higher version), so no migration code is needed. User-facing onboarding copy and synthetic test fixtures are updated to match. App Store Connect copy is delivered as a markdown artifact for the user to apply manually.

**Tech Stack:** Node script (CommonJS), TypeScript (RN/Expo), Jest + jest-expo.

**Spec:** `docs/superpowers/specs/2026-05-29-ip-remediation-generic-album-design.md`

**Setup:** Assume `eval "$(mise activate zsh)"` has been run (Node 22 via mise).

---

### Task 1: Lock the dataset neutrality contract with a failing test

**Files:**
- Test: `tests/data/datasetNeutral.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/data/datasetNeutral.test.ts
import dataset from "../../assets/stickers.json";

type RawSticker = { code: string; section: string };

const stickers = dataset.stickers as RawSticker[];

describe("dataset neutrality (Apple 5.2.1)", () => {
  it("contains no FIFA-resembling codes", () => {
    const offending = stickers.filter(
      (s) => /^FWC/i.test(s.code) || /^CC\d/i.test(s.code) || s.code === "0-0"
    );
    expect(offending.map((s) => s.code)).toEqual([]);
  });

  it("uses neutral section prefixes for special sections", () => {
    const intro = stickers.filter((s) => s.section === "Intro");
    const extras = stickers.filter((s) => s.section === "Extras");
    const stars = stickers.filter((s) => s.section === "Estrellas");

    expect(intro.length).toBe(9);
    expect(extras.length).toBe(11);
    expect(stars.length).toBe(14);

    expect(intro.every((s) => /^INT-\d+$/.test(s.code))).toBe(true);
    expect(extras.every((s) => /^EXT-\d+$/.test(s.code))).toBe(true);
    expect(stars.every((s) => /^STR-\d+$/.test(s.code))).toBe(true);
  });

  it("keeps the full sticker count", () => {
    expect(stickers.length).toBe(994);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- datasetNeutral`
Expected: FAIL — current dataset still has `FWC-*`, `0-0`, and `CC*` codes.

---

### Task 2: Rename special-section codes in the generator and regenerate

**Files:**
- Modify: `scripts/gen-stickers.js` (the three code arrays, the `version`, and the header comments)
- Regenerate: `assets/stickers.json`

- [ ] **Step 1: Replace the three code-array constants**

Find (around lines 95-97):

```javascript
const INTRO_CODES = ["0-0", "FWC-1", "FWC-2", "FWC-3", "FWC-4", "FWC-5", "FWC-6", "FWC-7", "FWC-8"];
const EXTRAS_CODES = ["FWC-9", "FWC-10", "FWC-11", "FWC-12", "FWC-13", "FWC-14", "FWC-15", "FWC-16", "FWC-17", "FWC-18", "FWC-19"];
const STARS_CODES = ["CC1", "CC2", "CC3", "CC4", "CC5", "CC6", "CC7", "CC8", "CC9", "CC10", "CC11", "CC12", "CC13", "CC14"];
```

Replace with:

```javascript
const INTRO_CODES = ["INT-1", "INT-2", "INT-3", "INT-4", "INT-5", "INT-6", "INT-7", "INT-8", "INT-9"];
const EXTRAS_CODES = ["EXT-1", "EXT-2", "EXT-3", "EXT-4", "EXT-5", "EXT-6", "EXT-7", "EXT-8", "EXT-9", "EXT-10", "EXT-11"];
const STARS_CODES = ["STR-1", "STR-2", "STR-3", "STR-4", "STR-5", "STR-6", "STR-7", "STR-8", "STR-9", "STR-10", "STR-11", "STR-12", "STR-13", "STR-14"];
```

- [ ] **Step 2: Bump the dataset version**

Find (around line 134):

```javascript
const dataset = {
  version: 9,
```

Replace with:

```javascript
const dataset = {
  version: 10,
```

- [ ] **Step 3: Neutralize the header comments**

Find the top comment block (lines 2-13) and replace the FIFA-resembling wording:

```javascript
// Genera assets/stickers.json con la estructura del album de cromos del Mundial.
// Estructura:
//   - 9 stickers de intro (0-0 + FWC-1..FWC-8)
//   - 48 equipos en 12 grupos × 4 equipos
//   - Por equipo: 20 stickers
//       N1 = escudo (team_badge)
//       N2..N12 = 11 jugadores
//       N13 = team_photo
//       N14..N20 = 7 jugadores más
//   - 11 stickers de Extras (FWC historicos)
//   - 14 stickers de Estrellas (set especial)
```

Replace with:

```javascript
// Genera assets/stickers.json con la estructura del álbum de cromos.
// Estructura:
//   - 9 stickers de intro (INT-1..INT-9)
//   - 48 equipos en 12 grupos × 4 equipos
//   - Por equipo: 20 stickers
//       N1 = escudo (team_badge)
//       N2..N12 = 11 jugadores
//       N13 = team_photo
//       N14..N20 = 7 jugadores más
//   - 11 stickers de Extras (EXT-1..EXT-11)
//   - 14 stickers de Estrellas (STR-1..STR-14)
```

- [ ] **Step 4: Regenerate the dataset**

Run: `node scripts/gen-stickers.js`
Expected: `✓ wrote 994 stickers to .../assets/stickers.json`

- [ ] **Step 5: Run the neutrality test to verify it passes**

Run: `pnpm test -- datasetNeutral`
Expected: PASS (all three tests green).

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-stickers.js assets/stickers.json tests/data/datasetNeutral.test.ts
git commit -m "data(stickers): rename FWC/CC codes to neutral INT/EXT/STR (Apple 5.2.1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Make onboarding copy generic (drop the exact official count)

**Files:**
- Modify: `src/i18n/strings.ts:39` (`onb1_body`)
- Modify: `src/domain/albumOrder.ts:17` (comment)
- Modify: `src/domain/progress.ts:47` (comment)

- [ ] **Step 1: Replace the onboarding body string**

Find in `src/i18n/strings.ts`:

```typescript
  onb1_body:
    "Lleva el control de las 994 láminas de tu álbum: las que ya pegaste, las que te faltan y las repetidas. Todo se sincroniza entre tus dispositivos.",
```

Replace with:

```typescript
  onb1_body:
    "Lleva el control de todas las láminas de tu álbum: las que ya pegaste, las que te faltan y las repetidas. Todo se sincroniza entre tus dispositivos.",
```

- [ ] **Step 2: Neutralize the internal comments**

In `src/domain/albumOrder.ts`, find the comment containing `n=1..994 en orden de páginas del álbum` and replace `n=1..994` with `n=1..N`.

In `src/domain/progress.ts`, find the comment containing `el dataset enumera n=1..994 en orden de páginas` and replace `n=1..994` with `n=1..N`.

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/strings.ts src/domain/albumOrder.ts src/domain/progress.ts
git commit -m "feat(onboarding): generic album copy, drop exact official count

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Update synthetic test fixtures to neutral codes

Fixtures hardcode old codes; they don't depend on the real dataset, but are updated for consistency so no `FWC`/`CC` strings remain in the suite.

**Files:**
- Modify: `tests/data/bulkSetOwnedForTeam.test.ts` (`FWC-1` → `INT-1`)
- Modify: `tests/domain/albumOrder.test.ts` (`FWC-1`,`FWC-2` → `INT-1`,`INT-2`; `CC1` → `STR-1`)
- Modify: `tests/domain/stats.test.ts` (`FWC-1` → `INT-1`; `CC1`,`CC2` → `STR-1`,`STR-2`)

- [ ] **Step 1: bulkSetOwnedForTeam.test.ts**

Replace both occurrences of `"FWC-1"` with `"INT-1"` (the seed row at line ~25 and the assertion at line ~52).

- [ ] **Step 2: albumOrder.test.ts**

Replace `sticker("FWC-1", 1, "Intro", null)` → `sticker("INT-1", 1, "Intro", null)`,
`sticker("FWC-2", 2, "Intro", null)` → `sticker("INT-2", 2, "Intro", null)`,
`sticker("CC1", 981, "Estrellas", null)` → `sticker("STR-1", 981, "Estrellas", null)`.

(The `"EX-1"` fixture at number 970 is already neutral — leave it.)

- [ ] **Step 3: stats.test.ts**

Replace `code: "FWC-1"` → `code: "INT-1"`, `code: "CC1"` → `code: "STR-1"`, `code: "CC2"` → `code: "STR-2"`.

- [ ] **Step 4: Run the full suite**

Run: `pnpm test`
Expected: all suites PASS (161 tests + the 3 new neutrality tests).

- [ ] **Step 5: Verify no offending codes remain in the suite**

Run: `grep -rniE "FWC|\"CC[0-9]|'CC[0-9]|code: \"CC" tests src app`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add tests
git commit -m "test: update fixtures to neutral INT/EXT/STR codes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Author App Store Connect remediation copy (deliverable)

Produces the text the user applies manually in App Store Connect (not editable from the repo).

**Files:**
- Create: `docs/legal/apple-5.2.1-remediation.md`

- [ ] **Step 1: Write the deliverable**

```markdown
# App Store Connect — Remediación 5.2.1 (a aplicar manualmente)

Submission: 1ed87d5b-83bb-4fb2-9de2-7ec0257b75eb · Versión 1.2.0

## 1. Respuesta a App Review (hilo en App Store Connect)

> Hi, thank you for the feedback. We have removed the third-party content
> from the app and its metadata. The app is a generic sticker-album collection
> tracker: users mark stickers they own, count duplicates, track progress and
> trade with friends. It is not affiliated with, endorsed by, or licensed from
> FIFA or any federation or publisher, and it contains no FIFA trademarks,
> logos, official sticker numbering, player names, or images. We are not
> claiming any FIFA authorization. The updated build and metadata reflect these
> changes. Please re-review. Thank you.

## 2. Metadata (Descripción / Subtítulo / Keywords)

Prohibido (remover de todos los campos): FIFA, Mundial, World Cup, Panini,
Qatar, 2026, "selecciones", nombres de torneos/federaciones.

- **Subtítulo:** "Organizá tu álbum de cromos"
- **Descripción (reframe):** enfocar en la funcionalidad genérica —
  "Llevá el control de tu colección de cromos: marcá las que tenés, contá las
  repetidas, seguí tu progreso e intercambiá con amigos por QR o usuario.
  Funciona sin conexión y sincroniza entre tus dispositivos."
- **Keywords:** album, cromos, stickers, coleccion, intercambio, trade,
  faltantes, repetidas (sin marcas de terceros).

## 3. Screenshots

Las 3 actuales (01-username, 02-argentina-team, 03-home) son vistas genéricas
de álbum — se mantienen. No agregar capturas con texto de marca.

## 4. Checklist previo a re-submit

- [ ] Build nueva subida (versión/build incrementada).
- [ ] Descripción, subtítulo y keywords sin términos prohibidos.
- [ ] Respuesta enviada en el hilo de App Review.
```

- [ ] **Step 2: Commit**

```bash
git add -f docs/legal/apple-5.2.1-remediation.md
git commit -m "docs(legal): App Store Connect 5.2.1 remediation copy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Final verification

- [ ] **Step 1: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: all suites PASS.

- [ ] **Step 3: Confirm no FIFA-resembling strings in shipped code/assets**

Run: `grep -rniE "FWC|FIFA World|World Cup|Mundial|Panini|\b994\b" assets/stickers.json src/i18n app`
Expected: no matches. (`src/domain/teamFlags.ts` "FIFA code" comments are internal mapping labels for country codes and may remain; they are not user-facing brand references.)

---

## Notes for the implementer

- **No migration is intentional** (see spec §B). The version bump (9→10) makes `seedStickers` run `DELETE FROM stickers` + re-insert, replacing old codes cleanly. Orphaned `sticker_status` rows for the ~34 renamed special stickers are harmless (they no longer join to any sticker) and acceptable pre-launch.
- **Team codes (`ARG-1`, `MEX-1`, …) are NOT changed** — country codes are not FIFA IP.
- **Residual risk** (accepted): the 48-team / 12-group structure still mirrors the real draw. If Apple rejects again under 5.2.1, escalate to the "customizable album" pivot (out of scope here).
- The native build / app icon were not flagged and are out of scope.
