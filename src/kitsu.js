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
