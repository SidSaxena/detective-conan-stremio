# Detective Conan Canon Addon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a static Stremio addon that surfaces only the curated canon/important Detective Conan episodes (plus movies) from the XerBlade list, in watch order, with rich labels — while reusing the user's existing `kitsu:210:N` stream ids so Torrentio streams resolve untouched.

**Architecture:** A Node generator parses the XerBlade HTML into structured records, validates episode numbering against the Kitsu API, resolves movie IMDb ids via Cinemeta, and emits a folder of static JSON files (`manifest.json`, two catalogs, one series meta) conforming to the Stremio Addon Protocol. The output is hosted as static files (GitHub Pages). Nothing runs at request time.

**Tech Stack:** Node.js 20+ (ESM), `cheerio` (HTML parsing), built-in `fetch`, `node:test` + `node:assert` for tests.

## Global Constraints

- **Runtime:** Node.js 20+ (built-in `fetch`, `node:test`). `package.json` has `"type": "module"` — all files are ESM.
- **Dependencies:** exactly one runtime dep — `cheerio`. No test framework beyond `node:test`.
- **Stream ids:** every curated episode video id MUST be `kitsu:210:<N>` where `N` is the Japanese absolute episode number. This is what makes streams resolve. Never invent new episode ids.
- **Numbering:** XerBlade uses Japanese absolute episode numbers; Kitsu (`anime/210`) uses the same. Verified: `kitsu:210:102` = Kitsu ep 102 "Historical Actor Murder Case (Part 1)".
- **Series meta id:** `dcc-conan` — hyphen, **no colon** (it becomes a static filename `meta/series/dcc-conan.json`; colons break static hosting/URLs). Episode ids keep colons (they live inside JSON, never in a filename).
- **Seasons:** decade blocks. `season = Math.floor(N / 100) + 1` (ep 1–99 → S1, 100–199 → S2, …), mirroring XerBlade's own tabs.
- **Movies:** separate `movie`-type catalog items referenced by IMDb `tt` id (Cinemeta supplies meta/art, Torrentio resolves `stream/movie/tt…`). Placement is derived from list position (the episode number preceding the movie line).
- **Hosting:** static host must send `Access-Control-Allow-Origin: *` (Stremio fetches cross-origin). GitHub Pages does; Cloudflare Pages/Netlify with a `_headers` file is the fallback.

---

## File Structure

```
detective-conan-stremio/
  package.json
  .gitignore
  src/
    parse.js       # parseList(html) -> { episodes, movies, skipped }
    episodes.js    # buildVideos(episodes) -> Stremio series videos[]
    kitsu.js       # Kitsu API client (episode count + per-number title)
    validate.js    # validateNumbering(episodes, fetchImpl) -> report
    movies.js      # resolveMovies() via Cinemeta + buildMovieItems()
    generate.js    # manifest / catalogs / series meta builders + writeAddon()
  scripts/
    scrape.js      # fetch XerBlade page -> data/raw/xerblade.html
    build.js       # orchestrate parse -> validate -> resolve -> generate -> dist/
  data/raw/        # xerblade.html (committed for reproducible builds)
  dist/            # generated static addon (gitignored)
  test/
    fixtures/xerblade-sample.html
    fixtures/kitsu.js         # canned Kitsu responses for validator tests
    fixtures/cinemeta.js      # canned Cinemeta search response for movie tests
    parse.test.js
    episodes.test.js
    validate.test.js
    movies.test.js
    generate.test.js
  docs/
```

---

### Task 1: Project scaffold + XerBlade parser

**Files:**
- Create: `package.json`, `.gitignore`
- Create: `src/parse.js`
- Create: `test/fixtures/xerblade-sample.html`, `test/parse.test.js`

**Interfaces:**
- Produces: `parseList(html: string) => { episodes: EpisodeRecord[], movies: MovieRecord[], skipped: string[] }`
  - `EpisodeRecord = { start:number, end:number, intl:string|null, manga:string|null, arc:string|null, description:string, tier:'main'|'listed', chars:string[], special:string|null }`
  - `MovieRecord = { movieNumber:number, title:string, placeAfterEpisode:number|null }`

- [ ] **Step 1: Scaffold the project**

Create `package.json`:

```json
{
  "name": "detective-conan-stremio",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test",
    "scrape": "node scripts/scrape.js",
    "build": "node scripts/build.js"
  },
  "dependencies": {
    "cheerio": "^1.0.0"
  }
}
```

Create `.gitignore`:

```
node_modules/
dist/
```

Then run:

```bash
cd /Users/sid/developer/detective-conan-stremio && npm install
```

Expected: `cheerio` installed, `node_modules/` present.

- [ ] **Step 2: Create the test fixture**

Create `test/fixtures/xerblade-sample.html` with the real XerBlade markup shape (verified from the live page):

```html
<article>
<ul id="tab000">
<li><p><span class="dc-list-pos"><span class="dc-list-no">1-2</span> (manga 1-5|V1F1-5):</span> Initial setup. Introductions. <span class="dc-list-pos"><span class="dc-list-no">*Main Plot*</span></span></p></li>
<li><p><span class="dc-list-pos"><span class="dc-list-no">3</span> (manga 6-9|V1F6-9):</span> Kaitou Kid style case.</p></li>
</ul>
<ul id="tab400">
<li><p><span class="dc-list-pos"><span class="dc-list-no">490</span> [INTL 536-537] (manga 518-522|V50F8-V51F1):</span> <span lang="ja-Latn" class="dc-list-char">Heiji</span> case. <span class="dc-list-pos"><span class="dc-list-no">(1 Hour Special)</span></span></p></li>
</ul>
<ul id="tab500">
<li><span class="anchor" id="eps500"></span><p><span class="dc-list-pos"><span class="dc-list-no">491-504</span> [INTL 538-551] (manga 585-590,595-609|V56F10-V57F4,V57F9-V59F1):</span> &ldquo;Clash of Red and Black&rdquo;&mdash;By far the longest <span class="dc-list-char">Black Organization</span> arc to date. <span class="dc-list-pos"><span class="dc-list-no">*Main Plot*</span></span></p></li>
<li><p><span class="dc-list-pos"><span class="dc-list-no">Movie 11</span>: Jolly Roger in the Deep Azure</span></p></li>
<li><p><span class="dc-list-pos"><span class="dc-list-no">507-508</span> [INTL 554-555] (manga 619-621|V59F11-V60F2):</span> Eisuke development. <span class="dc-list-pos"><span class="dc-list-no">*Main Plot*</span></span></p></li>
</ul>
</article>
```

- [ ] **Step 3: Write the failing test**

Create `test/parse.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseList } from '../src/parse.js';

const html = readFileSync(new URL('./fixtures/xerblade-sample.html', import.meta.url), 'utf8');

test('parses episode entries in numeric decade order', () => {
  const { episodes } = parseList(html);
  assert.equal(episodes.length, 5);
  assert.deepEqual(
    episodes.map(e => [e.start, e.end]),
    [[1, 2], [3, 3], [490, 490], [491, 504], [507, 508]],
  );
});

test('extracts range, intl, manga, arc, tier, chars, special', () => {
  const { episodes } = parseList(html);
  const clash = episodes.find(e => e.start === 491);
  assert.equal(clash.end, 504);
  assert.equal(clash.intl, '538-551');
  assert.equal(clash.manga, '585-590,595-609|V56F10-V57F4,V57F9-V59F1');
  assert.equal(clash.arc, 'Clash of Red and Black');
  assert.equal(clash.tier, 'main');
  assert.deepEqual(clash.chars, ['Black Organization']);

  const heiji = episodes.find(e => e.start === 490);
  assert.equal(heiji.tier, 'listed');
  assert.equal(heiji.special, '1 Hour Special');
  assert.deepEqual(heiji.chars, ['Heiji']);
  assert.equal(heiji.description, 'Heiji case.');
});

test('parses movies with positional placeAfterEpisode', () => {
  const { movies } = parseList(html);
  assert.equal(movies.length, 1);
  assert.deepEqual(movies[0], { movieNumber: 11, title: 'Jolly Roger in the Deep Azure', placeAfterEpisode: 504 });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/parse.js'`.

- [ ] **Step 5: Implement the parser**

Create `src/parse.js`:

```js
import * as cheerio from 'cheerio';

const NUM_RE = /^(\d+)(?:-(\d+))?$/;
const MOVIE_RE = /^Movie\s*(\d+)$/i;

export function parseList(html) {
  const $ = cheerio.load(html);
  const episodes = [];
  const movies = [];
  const skipped = [];
  let lastEnd = null;

  const uls = $('ul[id^="tab"]').toArray().sort((a, b) => {
    const na = parseInt(($(a).attr('id') || '').replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(($(b).attr('id') || '').replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });

  for (const ul of uls) {
    for (const li of $(ul).children('li').toArray()) {
      const $li = $(li);
      const pos = $li.find('.dc-list-pos').first();
      const noText = pos.find('.dc-list-no').first().text().trim();

      const movieM = noText.match(MOVIE_RE);
      if (movieM) {
        const title = pos.text().replace(/^Movie\s*\d+\s*:?\s*/i, '').trim();
        movies.push({ movieNumber: Number(movieM[1]), title, placeAfterEpisode: lastEnd });
        continue;
      }

      const numM = noText.match(NUM_RE);
      if (!numM) {
        if (noText) skipped.push(noText);
        continue;
      }
      const start = Number(numM[1]);
      const end = numM[2] ? Number(numM[2]) : start;

      const leadText = pos.text();
      const intl = (leadText.match(/\[INTL\s*([^\]]+)\]/) || [])[1]?.trim() || null;
      const manga = (leadText.match(/\(manga\s*([^)]*)\)/i) || [])[1]?.trim() || null;

      let tier = 'listed';
      let special = null;
      $li.find('.dc-list-no').each((_, el) => {
        const t = $(el).text().trim();
        if (t === '*Main Plot*') tier = 'main';
        const sp = t.match(/\(([\d.]+\s*Hour Special)\)/i);
        if (sp) special = sp[1];
      });

      const chars = $li.find('.dc-list-char').map((_, el) => $(el).text().trim()).get();

      const $p = $li.find('p').first().clone();
      $p.find('.dc-list-pos').remove();
      const description = $p.text().replace(/\s+/g, ' ').trim();
      const arc = (description.match(/[“"]([^”"]+)[”"]/) || [])[1] || null;

      episodes.push({ start, end, intl, manga, arc, description, tier, chars, special });
      lastEnd = end;
    }
  }

  return { episodes, movies, skipped };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS (3 tests). The fixture yields 5 episode entries (1-2, 3, 490, 491-504, 507-508) and 1 movie.

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore src/parse.js test/
git commit -m "feat: parse XerBlade episode + movie list from HTML"
```

---

### Task 2: Build Stremio episode videos

**Files:**
- Create: `src/episodes.js`, `test/episodes.test.js`

**Interfaces:**
- Consumes: `EpisodeRecord[]` from Task 1.
- Produces:
  - `seasonFor(n:number) => number`
  - `buildVideos(episodes: EpisodeRecord[]) => Video[]`
  - `Video = { id:string, title:string, season:number, episode:number, overview:string }`

- [ ] **Step 1: Write the failing test**

Create `test/episodes.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonFor, buildVideos } from '../src/episodes.js';

test('seasonFor maps into decade-100 blocks', () => {
  assert.equal(seasonFor(1), 1);
  assert.equal(seasonFor(99), 1);
  assert.equal(seasonFor(100), 2);
  assert.equal(seasonFor(491), 5);
});

test('buildVideos expands a range into one video per absolute episode', () => {
  const episodes = [{ start: 491, end: 504, intl: '538-551', manga: '585-590', arc: 'Clash of Red and Black', description: '"Clash of Red and Black"—longest arc.', tier: 'main', chars: ['Black Organization'], special: null }];
  const videos = buildVideos(episodes);
  assert.equal(videos.length, 14);
  const first = videos[0];
  assert.equal(first.id, 'kitsu:210:491');
  assert.equal(first.season, 5);
  assert.equal(first.episode, 491);
  assert.equal(first.title, '491 · Clash of Red and Black (1/14) ★Main Plot');
  assert.match(first.overview, /Clash of Red and Black/);
  assert.match(first.overview, /Manga: 585-590/);
  assert.match(first.overview, /Focus: Black Organization/);
});

test('buildVideos titles a single non-main episode from its first sentence', () => {
  const videos = buildVideos([{ start: 3, end: 3, intl: null, manga: '6-9', arc: null, description: 'Kaitou Kid style case.', tier: 'listed', chars: [], special: null }]);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].title, '3 · Kaitou Kid style case.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/episodes.js'`.

- [ ] **Step 3: Implement**

Create `src/episodes.js`:

```js
export function seasonFor(n) {
  return Math.floor(n / 100) + 1;
}

function firstSentence(s) {
  const m = s.match(/^[^.!?]*[.!?]/);
  return (m ? m[0] : s).trim();
}

export function videoTitle(rec, n) {
  const base = rec.arc || firstSentence(rec.description) || `Episode ${n}`;
  const len = rec.end - rec.start + 1;
  const counter = len > 1 ? ` (${n - rec.start + 1}/${len})` : '';
  const star = rec.tier === 'main' ? ' ★Main Plot' : '';
  return `${n} · ${base}${counter}${star}`;
}

export function videoOverview(rec) {
  let o = rec.description || '';
  if (rec.special) o += `\n(${rec.special})`;
  if (rec.manga) o += `\nManga: ${rec.manga}`;
  if (rec.chars && rec.chars.length) o += `\nFocus: ${rec.chars.join(', ')}`;
  return o.trim();
}

export function buildVideos(episodes) {
  const videos = [];
  for (const rec of episodes) {
    for (let n = rec.start; n <= rec.end; n++) {
      videos.push({
        id: `kitsu:210:${n}`,
        title: videoTitle(rec, n),
        season: seasonFor(n),
        episode: n,
        overview: videoOverview(rec),
      });
    }
  }
  return videos;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/episodes.js test/episodes.test.js
git commit -m "feat: expand episode records into Stremio series videos"
```

---

### Task 3: Kitsu numbering validator

**Files:**
- Create: `src/kitsu.js`, `src/validate.js`
- Create: `test/fixtures/kitsu.js`, `test/validate.test.js`

**Interfaces:**
- Consumes: `EpisodeRecord[]` from Task 1.
- Produces:
  - `fetchKitsuCount(fetchImpl?) => Promise<number|null>`
  - `fetchKitsuEpisode(number, fetchImpl?) => Promise<{number,title,season}|null>`
  - `validateNumbering(episodes, fetchImpl?) => Promise<{ total, kitsuCount, duplicates:number[], outOfRange:number[], sampleTitles:{number,kitsuTitle}[] }>`
- `fetchImpl` defaults to global `fetch`; tests inject a stub with the same signature (`(url) => Promise<{ json(): Promise<any> }>`).

- [ ] **Step 1: Write the failing test**

Create `test/fixtures/kitsu.js`:

```js
// Stub fetch for Kitsu. Recognises count query and filter[number]=N query.
const TITLES = { 1: 'Roller Coaster Murder Case', 491: 'The Red and Black Clash: Suspicion', 504: 'The Red and Black Clash: Conclusion' };

export function kitsuFetchStub(url) {
  const u = String(url);
  if (u.includes('filter%5Bnumber%5D=')) {
    const n = Number(u.match(/filter%5Bnumber%5D=(\d+)/)[1]);
    const title = TITLES[n];
    const data = title ? [{ attributes: { number: n, canonicalTitle: title, seasonNumber: 1 } }] : [];
    return Promise.resolve({ json: () => Promise.resolve({ data, meta: { count: data.length } }) });
  }
  // count query
  return Promise.resolve({ json: () => Promise.resolve({ data: [], meta: { count: 1145 } }) });
}
```

Create `test/validate.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNumbering } from '../src/validate.js';
import { kitsuFetchStub } from './fixtures/kitsu.js';

test('reports total, kitsu count, and boundary sample titles', async () => {
  const episodes = [{ start: 1, end: 1 }, { start: 491, end: 504 }];
  const r = await validateNumbering(episodes, kitsuFetchStub);
  assert.equal(r.total, 15);
  assert.equal(r.kitsuCount, 1145);
  assert.deepEqual(r.duplicates, []);
  assert.deepEqual(r.outOfRange, []);
  const titles = Object.fromEntries(r.sampleTitles.map(s => [s.number, s.kitsuTitle]));
  assert.equal(titles[491], 'The Red and Black Clash: Suspicion');
  assert.equal(titles[504], 'The Red and Black Clash: Conclusion');
});

test('flags duplicates and out-of-range numbers', async () => {
  const episodes = [{ start: 1, end: 1 }, { start: 1, end: 1 }, { start: 2000, end: 2000 }];
  const r = await validateNumbering(episodes, kitsuFetchStub);
  assert.deepEqual(r.duplicates, [1]);
  assert.deepEqual(r.outOfRange, [2000]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/validate.js'`.

- [ ] **Step 3: Implement the Kitsu client**

Create `src/kitsu.js`:

```js
const BASE = 'https://kitsu.io/api/edge/anime/210/episodes';

export async function fetchKitsuCount(fetchImpl = fetch) {
  const r = await fetchImpl(`${BASE}?page%5Blimit%5D=1`);
  const j = await r.json();
  return j.meta?.count ?? null;
}

export async function fetchKitsuEpisode(number, fetchImpl = fetch) {
  const r = await fetchImpl(`${BASE}?filter%5Bnumber%5D=${number}&page%5Blimit%5D=1`);
  const j = await r.json();
  const a = j.data?.[0]?.attributes;
  return a ? { number: a.number, title: a.canonicalTitle, season: a.seasonNumber } : null;
}
```

- [ ] **Step 4: Implement the validator**

Create `src/validate.js`:

```js
import { fetchKitsuCount, fetchKitsuEpisode } from './kitsu.js';

export async function validateNumbering(episodes, fetchImpl = fetch) {
  const nums = [];
  for (const r of episodes) for (let n = r.start; n <= r.end; n++) nums.push(n);

  const seen = new Set();
  const dupSet = new Set();
  for (const n of nums) {
    if (seen.has(n)) dupSet.add(n);
    seen.add(n);
  }

  const kitsuCount = await fetchKitsuCount(fetchImpl);
  const outOfRange = kitsuCount ? nums.filter(n => n < 1 || n > kitsuCount) : [];

  const boundaries = new Set();
  for (const r of episodes) { boundaries.add(r.start); boundaries.add(r.end); }
  const sampleTitles = [];
  for (const n of [...boundaries].sort((a, b) => a - b)) {
    const ep = await fetchKitsuEpisode(n, fetchImpl);
    sampleTitles.push({ number: n, kitsuTitle: ep ? ep.title : '(not found)' });
  }

  return {
    total: nums.length,
    kitsuCount,
    duplicates: [...dupSet],
    outOfRange,
    sampleTitles,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/kitsu.js src/validate.js test/fixtures/kitsu.js test/validate.test.js
git commit -m "feat: validate episode numbering against Kitsu API"
```

---

### Task 4: Resolve movies to IMDb ids via Cinemeta

**Files:**
- Create: `src/movies.js`
- Create: `test/fixtures/cinemeta.js`, `test/movies.test.js`

**Interfaces:**
- Consumes: `MovieRecord[]` from Task 1.
- Produces:
  - `resolveMovies(recs, fetchImpl?) => Promise<ResolvedMovie[]>`
  - `buildMovieItems(resolved) => CatalogMeta[]`
  - `ResolvedMovie = MovieRecord & { imdbId:string|null, year:string|null, poster:string|null, resolvedName:string|null }`
  - `CatalogMeta = { id:string, type:'movie', name:string, poster?:string, releaseInfo?:string }`

- [ ] **Step 1: Write the failing test**

Create `test/fixtures/cinemeta.js`:

```js
export function cinemetaFetchStub(url) {
  const metas = [
    { id: 'tt2380307', name: 'Some Unrelated Film', releaseInfo: '2013', poster: 'x' },
    { id: 'tt1226256', name: 'Detective Conan: Jolly Roger in the Deep Azure', releaseInfo: '2007', poster: 'https://img/jolly.jpg' },
  ];
  return Promise.resolve({ json: () => Promise.resolve({ metas }) });
}

export function emptyCinemetaStub() {
  return Promise.resolve({ json: () => Promise.resolve({ metas: [] }) });
}
```

Create `test/movies.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMovies, buildMovieItems } from '../src/movies.js';
import { cinemetaFetchStub, emptyCinemetaStub } from './fixtures/cinemeta.js';

test('resolves a movie to the Detective Conan match, not the first result', async () => {
  const recs = [{ movieNumber: 11, title: 'Jolly Roger in the Deep Azure', placeAfterEpisode: 504 }];
  const [m] = await resolveMovies(recs, cinemetaFetchStub);
  assert.equal(m.imdbId, 'tt1226256');
  assert.equal(m.year, '2007');
  assert.equal(m.poster, 'https://img/jolly.jpg');
});

test('leaves imdbId null when nothing is found', async () => {
  const [m] = await resolveMovies([{ movieNumber: 99, title: 'Nonexistent', placeAfterEpisode: null }], emptyCinemetaStub);
  assert.equal(m.imdbId, null);
});

test('buildMovieItems drops unresolved and formats placement in the name', () => {
  const items = buildMovieItems([
    { movieNumber: 11, title: 'Jolly Roger in the Deep Azure', placeAfterEpisode: 504, imdbId: 'tt1226256', year: '2007', poster: 'p' },
    { movieNumber: 99, title: 'Nonexistent', placeAfterEpisode: null, imdbId: null, year: null, poster: null },
  ]);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], { id: 'tt1226256', type: 'movie', name: 'Movie 11: Jolly Roger in the Deep Azure — watch after Ep 504', poster: 'p', releaseInfo: '2007' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/movies.js'`.

- [ ] **Step 3: Implement**

Create `src/movies.js`:

```js
const SEARCH = 'https://v3-cinemeta.strem.io/catalog/movie/top/search=';

export async function resolveMovie(rec, fetchImpl = fetch) {
  const q = encodeURIComponent(`Detective Conan ${rec.title}`);
  const r = await fetchImpl(`${SEARCH}${q}.json`);
  const j = await r.json();
  const metas = j.metas || [];
  const hit = metas.find(m => /detective conan|case closed/i.test(m.name)) || null;
  if (!hit) return { ...rec, imdbId: null, year: null, poster: null, resolvedName: null };
  return { ...rec, imdbId: hit.id, year: hit.releaseInfo || null, poster: hit.poster || null, resolvedName: hit.name };
}

export async function resolveMovies(recs, fetchImpl = fetch) {
  const out = [];
  for (const rec of recs) out.push(await resolveMovie(rec, fetchImpl));
  return out;
}

export function buildMovieItems(resolved) {
  return resolved
    .filter(m => m.imdbId)
    .map(m => ({
      id: m.imdbId,
      type: 'movie',
      name: `Movie ${m.movieNumber}: ${m.title}${m.placeAfterEpisode ? ` — watch after Ep ${m.placeAfterEpisode}` : ''}`,
      poster: m.poster || undefined,
      releaseInfo: m.year || undefined,
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/movies.js test/fixtures/cinemeta.js test/movies.test.js
git commit -m "feat: resolve movies to IMDb ids via Cinemeta search"
```

---

### Task 5: Generate the static addon files

**Files:**
- Create: `src/generate.js`, `test/generate.test.js`

**Interfaces:**
- Consumes: `Video[]` (Task 2), `ResolvedMovie[]` and `CatalogMeta[]` (Task 4).
- Produces:
  - `SERIES_ID` (const `'dcc-conan'`)
  - `buildManifest() => object`
  - `buildSeriesCatalog() => { metas:[...] }`
  - `buildMovieCatalog(movieItems) => { metas:[...] }`
  - `annotateMovieMarkers(videos, resolvedMovies) => Video[]` (mutates + returns videos)
  - `buildSeriesMeta(videos) => { meta:{...} }`
  - `writeAddon(outDir, { manifest, seriesCatalog, movieCatalog, seriesMeta }) => Promise<string[]>`

- [ ] **Step 1: Write the failing test**

Create `test/generate.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SERIES_ID, buildManifest, buildSeriesCatalog, buildMovieCatalog, annotateMovieMarkers, buildSeriesMeta, writeAddon } from '../src/generate.js';

test('manifest declares series meta by dcc-conan prefix and two catalogs', () => {
  const m = buildManifest();
  assert.equal(SERIES_ID, 'dcc-conan');
  assert.deepEqual(m.types, ['series', 'movie']);
  assert.deepEqual(m.idPrefixes, ['dcc-conan']);
  const metaRes = m.resources.find(r => r && r.name === 'meta');
  assert.deepEqual(metaRes.idPrefixes, ['dcc-conan']);
  assert.equal(m.catalogs.length, 2);
});

test('annotateMovieMarkers appends a Next-movie marker to the placement episode', () => {
  const videos = [{ id: 'kitsu:210:504', episode: 504, overview: 'Arc conclusion.' }];
  annotateMovieMarkers(videos, [{ movieNumber: 11, title: 'Jolly Roger in the Deep Azure', placeAfterEpisode: 504 }]);
  assert.match(videos[0].overview, /▶ Next: Movie 11 — Jolly Roger in the Deep Azure/);
});

test('series meta carries the video list under a dcc-conan id', () => {
  const meta = buildSeriesMeta([{ id: 'kitsu:210:1', episode: 1, season: 1, title: '1 · x', overview: 'y' }]);
  assert.equal(meta.meta.id, 'dcc-conan');
  assert.equal(meta.meta.type, 'series');
  assert.equal(meta.meta.videos.length, 1);
});

test('writeAddon writes manifest, both catalogs and the series meta', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dcc-'));
  const written = await writeAddon(dir, {
    manifest: buildManifest(),
    seriesCatalog: buildSeriesCatalog(),
    movieCatalog: buildMovieCatalog([{ id: 'tt1226256', type: 'movie', name: 'Movie 11: x' }]),
    seriesMeta: buildSeriesMeta([{ id: 'kitsu:210:1', episode: 1, season: 1, title: '1 · x', overview: 'y' }]),
  });
  assert.ok(written.includes('meta/series/dcc-conan.json'));
  const meta = JSON.parse(readFileSync(join(dir, 'meta/series/dcc-conan.json'), 'utf8'));
  assert.equal(meta.meta.id, 'dcc-conan');
  const cat = JSON.parse(readFileSync(join(dir, 'catalog/movie/dcc-movies.json'), 'utf8'));
  assert.equal(cat.metas[0].id, 'tt1226256');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/generate.js'`.

- [ ] **Step 3: Implement**

Create `src/generate.js`:

```js
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const SERIES_ID = 'dcc-conan';

const POSTER = 'https://artworks.thetvdb.com/banners/fanart/original/72454-3.jpg';
const LOGO = 'https://artworks.thetvdb.com/banners/v4/series/72454/clearlogo/688c2fbda100f.png';

export function buildManifest() {
  return {
    id: 'com.xerblade.dcc.canon',
    version: '1.0.0',
    name: 'Detective Conan — Canon & Movies',
    description: 'Curated canon/important Detective Conan episodes and movies from the XerBlade list, in watch order. Reuses kitsu:210 stream ids so your existing stream addons resolve untouched.',
    logo: LOGO,
    resources: ['catalog', { name: 'meta', types: ['series'], idPrefixes: [SERIES_ID] }],
    types: ['series', 'movie'],
    idPrefixes: [SERIES_ID],
    catalogs: [
      { type: 'series', id: 'dcc-series', name: 'Detective Conan — Canon' },
      { type: 'movie', id: 'dcc-movies', name: 'Detective Conan — Movies (watch order)' },
    ],
  };
}

export function buildSeriesCatalog() {
  return {
    metas: [{
      id: SERIES_ID,
      type: 'series',
      name: 'Detective Conan — Canon',
      poster: POSTER,
      description: 'Only the canon/important episodes, labeled with arc, tier and real episode number.',
    }],
  };
}

export function buildMovieCatalog(movieItems) {
  return { metas: movieItems };
}

export function annotateMovieMarkers(videos, resolvedMovies) {
  const byEp = new Map(videos.map(v => [v.episode, v]));
  for (const m of resolvedMovies) {
    const v = byEp.get(m.placeAfterEpisode);
    if (v) v.overview = `${v.overview}\n▶ Next: Movie ${m.movieNumber} — ${m.title}`;
  }
  return videos;
}

export function buildSeriesMeta(videos) {
  return {
    meta: {
      id: SERIES_ID,
      type: 'series',
      name: 'Detective Conan — Canon',
      poster: POSTER,
      logo: LOGO,
      background: POSTER,
      description: 'Curated canon/important episodes from the XerBlade list, reusing kitsu:210 stream ids.',
      videos,
    },
  };
}

export async function writeAddon(outDir, { manifest, seriesCatalog, movieCatalog, seriesMeta }) {
  const files = [
    ['manifest.json', manifest],
    ['catalog/series/dcc-series.json', seriesCatalog],
    ['catalog/movie/dcc-movies.json', movieCatalog],
    [`meta/series/${SERIES_ID}.json`, seriesMeta],
  ];
  for (const [rel, data] of files) {
    const p = join(outDir, rel);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, JSON.stringify(data, null, 2));
  }
  return files.map(f => f[0]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (all suites green).

- [ ] **Step 5: Commit**

```bash
git add src/generate.js test/generate.test.js
git commit -m "feat: generate Stremio manifest, catalogs and series meta"
```

---

### Task 6: Scrape, build orchestration, and Stremio smoke test

**Files:**
- Create: `scripts/scrape.js`, `scripts/build.js`
- Create: `README.md`
- Create: `data/raw/xerblade.html` (produced by scrape / browser capture)

**Interfaces:**
- Consumes: every `src/` module above.
- Produces: the populated `dist/` static addon and a validated build report.

- [ ] **Step 1: Write the scrape script**

Create `scripts/scrape.js`:

```js
import { writeFile, mkdir } from 'node:fs/promises';

const URL = 'https://www.xerblade.com/p/detective-conan-important-episode-list.html?m=1';
const res = await fetch(URL, { headers: { 'user-agent': 'Mozilla/5.0' } });
const html = await res.text();
await mkdir('data/raw', { recursive: true });
await writeFile('data/raw/xerblade.html', html);
console.log(`Saved ${html.length} bytes to data/raw/xerblade.html`);
```

- [ ] **Step 2: Run scrape and verify the list is present**

Run:

```bash
cd /Users/sid/developer/detective-conan-stremio && npm run scrape
node -e "import('./src/parse.js').then(async m => { const {readFileSync} = await import('node:fs'); const r = m.parseList(readFileSync('data/raw/xerblade.html','utf8')); console.log('episodes', r.episodes.length, 'movies', r.movies.length, 'skipped', r.skipped.length); })"
```

Expected: `episodes` in the ~300–441 range, `movies` ~25.

**If `episodes` is 0 or near-0**, the list is rendered client-side and `fetch` didn't capture it. Fallback: capture the DOM from the already-open browser tab instead — in the Chrome tab on the XerBlade page run `document.querySelector('article').outerHTML`, save the result to `data/raw/xerblade.html`, and re-run the `node -e` check. Do not proceed until the count is in range.

- [ ] **Step 3: Write the build orchestration script**

Create `scripts/build.js`:

```js
import { readFile } from 'node:fs/promises';
import { parseList } from '../src/parse.js';
import { buildVideos } from '../src/episodes.js';
import { validateNumbering } from '../src/validate.js';
import { resolveMovies, buildMovieItems } from '../src/movies.js';
import * as gen from '../src/generate.js';

const html = await readFile('data/raw/xerblade.html', 'utf8');
const { episodes, movies, skipped } = parseList(html);
console.log(`Parsed ${episodes.length} episode entries, ${movies.length} movies, ${skipped.length} skipped`);
if (skipped.length) console.log('Skipped tokens (review):', skipped);

const report = await validateNumbering(episodes);
console.log(`Validation: ${report.total} episodes | kitsu count ${report.kitsuCount} | duplicates ${report.duplicates.length} | out-of-range ${report.outOfRange.length}`);
if (report.duplicates.length) console.log('DUPLICATES:', report.duplicates);
if (report.outOfRange.length) console.log('OUT OF RANGE:', report.outOfRange);
console.log('Boundary sample (eyeball a few against XerBlade):');
for (const s of report.sampleTitles.slice(0, 12)) console.log(`  ${s.number}: ${s.kitsuTitle}`);

const videos = buildVideos(episodes);
const resolved = await resolveMovies(movies);
const unresolved = resolved.filter(m => !m.imdbId);
if (unresolved.length) console.log('UNRESOLVED MOVIES (fix manually):', unresolved.map(m => `${m.movieNumber}:${m.title}`));
gen.annotateMovieMarkers(videos, resolved);

const written = await gen.writeAddon('dist', {
  manifest: gen.buildManifest(),
  seriesCatalog: gen.buildSeriesCatalog(),
  movieCatalog: gen.buildMovieCatalog(buildMovieItems(resolved)),
  seriesMeta: gen.buildSeriesMeta(videos),
});
console.log(`Wrote ${videos.length} episodes + ${buildMovieItems(resolved).length} movies:`, written);
```

- [ ] **Step 4: Run the build and review the report**

Run: `cd /Users/sid/developer/detective-conan-stremio && npm run build`

Expected: `dist/manifest.json`, `dist/catalog/...`, `dist/meta/series/dcc-conan.json` created. `duplicates 0`, `out-of-range 0`. Review any `Skipped tokens` (expect Magic-Kaito/upcoming markers — safe to ignore) and `UNRESOLVED MOVIES` (resolve those titles by hand: find the IMDb id on Cinemeta and hard-code it, or adjust the search title). Eyeball 3–4 boundary sample titles against the XerBlade page to confirm numbering alignment.

- [ ] **Step 5: Serve dist/ and smoke-test in Stremio**

Run a local static server with CORS:

```bash
cd /Users/sid/developer/detective-conan-stremio/dist && npx --yes http-server -p 8100 --cors
```

In Stremio (desktop or web): open the addon search / paste-link box and install `http://127.0.0.1:8100/manifest.json`. Then verify, one at a time:
1. Two catalog rows appear ("Detective Conan — Canon", "Detective Conan — Movies").
2. Open the series → episodes show with arc/tier/number labels and decade seasons.
3. Play one episode (e.g. an early Main Plot one) → **streams resolve** (Torrentio results appear). This is the critical check — it confirms the `kitsu:210:N` reuse works end-to-end.
4. Open one movie → its Cinemeta page loads and **movie streams resolve**.

If streams do NOT appear for an episode, confirm the same `kitsu:210:N` id plays from the user's existing `tt0131179` entry; if that works but ours doesn't, diff the video `id` string exactly.

- [ ] **Step 6: Write the README and publish steps**

Create `README.md`:

```markdown
# Detective Conan — Canon & Movies (Stremio addon)

Static Stremio addon surfacing only the curated canon/important Detective Conan
episodes and movies from the XerBlade list, in watch order, reusing `kitsu:210:N`
stream ids so existing stream addons (Torrentio, etc.) resolve untouched.

## Regenerate

    npm install
    npm run scrape   # refresh data/raw/xerblade.html
    npm run build    # -> dist/

## Host

Publish `dist/` to any static host that sends `Access-Control-Allow-Origin: *`
(Stremio fetches cross-origin):

- **GitHub Pages:** push `dist/` to a `gh-pages` branch (or a `/docs` folder on main).
  Install URL: `https://<user>.github.io/<repo>/manifest.json`.
- **Cloudflare Pages / Netlify:** add a `_headers` file with
  `/*\n  Access-Control-Allow-Origin: *` and deploy `dist/`.

Local test: `npx http-server dist -p 8100 --cors`, install `http://127.0.0.1:8100/manifest.json`.
```

- [ ] **Step 7: Publish to GitHub Pages**

Run:

```bash
cd /Users/sid/developer/detective-conan-stremio
gh auth status
gh repo create detective-conan-stremio --public --source=. --remote=origin --push
```

Then deploy `dist/` to Pages (subtree push):

```bash
git add -A && git commit -m "chore: build dist"
git subtree push --prefix dist origin gh-pages
```

In the repo's GitHub settings, enable Pages from the `gh-pages` branch. Verify the manifest is reachable and CORS-enabled:

```bash
curl -sI https://<user>.github.io/detective-conan-stremio/manifest.json | grep -i 'access-control-allow-origin'
```

Expected: `access-control-allow-origin: *`. If absent, switch to Cloudflare Pages/Netlify with the `_headers` file. Then re-install the public manifest URL in Stremio and repeat the Step 5 checks against the hosted addon.

- [ ] **Step 8: Commit**

```bash
git add scripts/ README.md data/raw/xerblade.html
git commit -m "feat: scrape + build pipeline, README, hosting steps"
```

---

## Self-Review Notes

- **Spec coverage:** parser (T1), episode videos + kitsu ids + decade seasons (T2), Kitsu validation pass (T3), movie IMDb resolution + placement (T4), manifest/catalog/meta generation (T5), scrape + build + smoke test + publish (T6). All spec sections mapped.
- **Design refinement vs spec:** the spec described "one catalog listing series then movies"; Stremio catalogs are single-typed, so this plan uses **two catalogs** (series + movie) from the one addon — same user-facing outcome, correct protocol shape.
- **Series id:** `dcc-conan` (no colon) everywhere — catalog item id, manifest `idPrefixes`, meta id, and the `meta/series/dcc-conan.json` filename all agree.
- **Stream reuse:** every episode `id` is `kitsu:210:<N>`; nothing else provides streams.
- **Type consistency:** `parseList → {episodes,movies,skipped}` feeds `buildVideos`, `validateNumbering`, `resolveMovies`; `resolveMovies → buildMovieItems`/`annotateMovieMarkers`; `buildVideos → buildSeriesMeta`. Names match across tasks.
