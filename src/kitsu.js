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

export async function fetchAllEpisodeTitles(fetchImpl = fetch) {
  const titles = new Map();
  const LIMIT = 20;
  let offset = 0;
  for (;;) {
    const r = await fetchImpl(`${BASE}?page%5Blimit%5D=${LIMIT}&page%5Boffset%5D=${offset}`);
    const j = await r.json();
    const data = j.data || [];
    for (const d of data) {
      const a = d.attributes || {};
      if (a.number != null && typeof a.canonicalTitle === 'string' && a.canonicalTitle.trim()) {
        titles.set(a.number, a.canonicalTitle.trim());
      }
    }
    const total = j.meta && j.meta.count ? j.meta.count : 0;
    offset += LIMIT;
    if (data.length < LIMIT || (total && offset >= total)) break;
  }
  return titles;
}
