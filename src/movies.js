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
