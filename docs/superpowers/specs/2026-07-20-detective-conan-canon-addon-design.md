# Detective Conan — Canon & Movies: Static Stremio Addon

**Status:** Approved design (2026-07-20)
**Owner:** sid

## Problem

Watching Detective Conan in Stremio while following the curated canon/important
episode list at
<https://www.xerblade.com/p/detective-conan-important-episode-list.html> requires
constant cross-referencing. The xerblade list uses **absolute Japanese episode
numbers** (e.g. `491–504`) with arc names, tier markers, and rich descriptions,
while the Stremio catalog splits the series into Cinemeta-style seasons with
per-season numbering. Manually translating between the two to decide what to watch
is tedious.

Goal: surface *only* the curated episodes (plus movies) directly inside Stremio,
labeled with arc name, tier, real episode number, and description — without
breaking stream resolution.

## Confirmed technical facts (investigated 2026-07-20)

Verified against the user's live Stremio account (web.stremio.com) and the Kitsu API:

1. The user's Detective Conan series uses IMDb meta id **`tt0131179`**, but its
   **episode video IDs are `kitsu:210:<N>`**, where `N` is the **Japanese absolute
   episode number**.
   - Verified: `kitsu:210:102` → Kitsu ep 102 "Historical Actor Murder Case
     (Part 1)" (seasonNumber 4), shown in Stremio as "S4E20". This is Japanese
     absolute episode 102.
2. **Torrentio resolves streams directly off these Kitsu IDs** — Erai-raws /
   Crunchyroll / Anime-Time results loaded for `kitsu:210:102`. Streams are
   requested as `stream/series/kitsu:210:<N>`.
3. **The xerblade list is numbered in the same Japanese absolute numbers.** Mapping
   a curated episode to a working stream is therefore essentially
   `kitsu:210:<number>`. Only edge cases (specials, split/combined episodes, and the
   handful where Kitsu's numbering diverges) need reconciliation.
4. xerblade content: ~441 curated episodes out of ~1136 total, organized in decade
   blocks (00s, 100s, 200s…), with arc names ("Clash of Red and Black"), tier
   markers (`*Main Plot*`), `[INTL ###]` alternate numbers, manga chapter refs, and
   movies placed chronologically by manga release date.

### Key constraint: movies ≠ series episodes

Stremio uses different stream endpoints for the two content types
(`stream/series/…` vs `stream/movie/…`). A movie therefore **cannot** be a true
inline "episode" of the curated series and still resolve streams. Movies must remain
`movie`-type items, stitched into the watch order via placement notes rather than
true interleaving.

## Scope

- **Approach:** Static, pre-generated addon (no running server). Chosen because the
  curated list is essentially fixed data.
- **Content:** All ~441 listed canon episodes (Main Plot + character/Black-Org
  relevant), each tagged with its tier, **plus** the theatrical movies placed
  chronologically as xerblade positions them.

Out of scope: filler episodes, a settings/config UI, live re-scraping, tier
toggles (these belong to the rejected dynamic-server approach B).

## Architecture

A Node generator script transforms the xerblade list into a folder of static JSON
files conforming to the Stremio Addon Protocol. The output is served as static files
over HTTPS (GitHub Pages), or opened locally. Nothing runs at request time.

### Output file layout (served static)

- `manifest.json` — declares:
  - `resources`: `catalog`, `meta`
  - `types`: `series`, `movie`
  - one `catalog`: id e.g. `dcc-canon`, name "Detective Conan — Canon & Movies"
  - `idPrefixes` covering the addon's own ids (and referenced ids as needed)
- `catalog/dcc-canon.json` — a list of catalog items:
  1. the curated **series** entry (`dcc:conan`) first, then
  2. the **movies** as separate `movie` items.
- `meta/series/dcc:conan.json` — the curated series meta. `videos[]` contains only
  the ~441 essential episodes. Each video:
  - `id`: `"kitsu:210:<N>"` (reuses the user's existing stream id → streams resolve
    untouched)
  - `name`: e.g. `491 · Clash of Red and Black ★Main Plot` (arc, tier, real number
    always visible; multi-episode arcs get `(1/14)` counters)
  - `overview`: xerblade arc description + manga refs + Black-Org/character tags, and
    `▶ Next: Movie N (Title)` markers where a movie is chronologically placed after
    this episode
  - `season`: decade block (1–99 → S1, 100–199 → S2, …), mirroring xerblade's own
    navigation and keeping real numbers recognizable
  - `episode`: the real absolute number
- Movies: referenced by their **IMDb `tt` id** so Cinemeta supplies art/metadata and
  Torrentio resolves `stream/movie/tt…` reliably. Catalog titles like
  `Movie 6: The Phantom of Baker Street — watch after Ep 219`. (If a movie lacks a
  usable `tt` mapping, fall back to its Kitsu movie id; recorded during the
  data pipeline.)

### Why streams keep working

Every curated episode's `id` is the exact `kitsu:210:N` id the user's current setup
already streams from. Stremio requests `stream/series/kitsu:210:N`; the installed
Torrentio/Comet addons answer. The new addon only supplies **metadata + ordering**,
never streams — so it composes with the existing stream stack rather than replacing
it.

## Components (isolation boundaries)

1. **Scraper/parser** — input: xerblade HTML; output: normalized
   `episodes.json` + `movies.json`. One job: turn the page into structured records.
   - Episode record: `{ number | [start,end], intl, mangaRefs, arc, tier,
     description, specialFormat? }`
   - Movie record: `{ movieNumber, title, placeAfterEpisode, tmdb?/imdb?/kitsu? }`
2. **Validator** — input: parsed episodes; cross-checks a sample (and all
   boundaries) against the Kitsu API (`/anime/210/episodes`) to confirm
   `kitsu N == JP absolute N`; emits a report of mismatches to reconcile.
3. **ID resolver (movies)** — maps each movie to its IMDb `tt` id (+ placement).
   Small curated table (25 movies as of 2026), validated once.
4. **Addon generator** — input: validated episodes + movies; output: the static
   JSON files above. One job: render Stremio-protocol JSON.
5. **Smoke test** — loads `manifest.json` in Stremio (or via the addon protocol),
   opens the series, confirms one episode's streams resolve and a movie item shows.

Each component is independently runnable and testable; they communicate through the
intermediate JSON files.

## Data pipeline

1. Scrape + parse xerblade → `episodes.json`, `movies.json`.
2. Expand ranges into individual episodes; attach arc/tier/description to each.
3. Map each episode → `kitsu:210:N`.
4. **Validation pass** — cross-check numbers vs Kitsu titles; flag & reconcile
   specials, split/combined episodes, and numbering divergences.
5. Resolve each movie → IMDb `tt` id + `placeAfterEpisode`.
6. Generate static JSON.
7. Smoke-test manifest + one episode stream + one movie in Stremio; publish to
   GitHub Pages.

## Edge cases & risks

- **Numbering divergence.** Kitsu occasionally splits/merges episodes vs the
  Japanese broadcast count. Mitigation: the validator matches by title near each
  boundary and reports divergences for manual reconciliation. Low expected volume.
- **Specials (1h/2h/2.5h).** May be one Kitsu number or several. Reconcile via the
  validator.
- **Movie stream resolution.** Depends on a correct `tt` (or Kitsu movie) id per
  movie. Mitigation: a small validated lookup table (25 items).
- **Separate progress tracking.** Watching via the curated series (meta id
  `dcc:conan`) tracks progress separately from the user's existing `tt0131179`
  entry. Accepted; the whole point is a distinct curated view.
- **List staleness.** Static output must be regenerated when xerblade updates. The
  generator is re-runnable; no live dependency.

## Testing strategy

- Unit-test the parser against saved xerblade HTML fixtures (ranges, tiers, INTL
  numbers, movie placements).
- Validator run produces a zero-unresolved-mismatch report before publishing.
- Generated JSON validated against the Stremio addon schema (manifest, catalog,
  meta shapes).
- Manual smoke test in the user's Stremio: install manifest URL → open series →
  play one episode (streams resolve) → open one movie (streams resolve) → confirm
  labels/overviews render.

## Project location

`~/developer/detective-conan-stremio/` — Node generator + `docs/`, git-initialized.
