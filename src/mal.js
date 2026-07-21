const BASE = 'https://api.jikan.moe/v4/anime/235/episodes';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Fetches one Jikan page, retrying with backoff on transient failures (429/504 and
// friends). Jikan error bodies (e.g. {"status":504,...}) never carry a `data` array,
// so that's the success/failure signal — works for both the real API and test stubs.
async function fetchPage(fetchImpl, page, maxAttempts) {
  let backoff = 500;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      // Node's built-in fetch sends Accept-Encoding: "br, gzip, deflate, zstd", a variant
      // Jikan's edge cache doesn't have warm — that forces a live MAL backend hit which
      // frequently 504s/429s. A standard browser-order Accept-Encoding hits the cache.
      const r = await fetchImpl(`${BASE}?page=${page}`, { headers: { 'Accept-Encoding': 'gzip, deflate, br' } });
      const j = await r.json();
      if (Array.isArray(j.data)) return j;
      if (attempt === maxAttempts) return j;
    } catch {
      if (attempt === maxAttempts) return {};
    }
    await sleep(backoff);
    backoff = Math.min(backoff * 2, 5000);
  }
  return {};
}

// Returns Map<absoluteEpisodeNumber, title> from Jikan (MyAnimeList id 235).
// delayMs spaces page requests to respect Jikan's rate limit; tests pass 0.
export async function fetchAllMalTitles(fetchImpl = fetch, delayMs = 350) {
  const titles = new Map();
  let page = 1;
  let last = 1;
  do {
    const j = await fetchPage(fetchImpl, page, delayMs ? 5 : 1);
    const data = j.data || [];
    for (const e of data) {
      if (e && e.mal_id != null && typeof e.title === 'string' && e.title.trim()) {
        titles.set(e.mal_id, e.title.trim());
      }
    }
    if (j.pagination && j.pagination.last_visible_page) {
      last = j.pagination.last_visible_page;
    }
    page += 1;
    if (page <= last && delayMs) await sleep(delayMs);
  } while (page <= last);
  return titles;
}
