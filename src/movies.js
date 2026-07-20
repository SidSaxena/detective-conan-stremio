const SEARCH = 'https://v3-cinemeta.strem.io/catalog/movie/top/search=';

const STOP = new Set(['the', 'of', 'in', 'a', 'an', 'and', 'to', 'no']);

function titleTokens(title) {
  return title.toLowerCase().split(/[^a-z0-9]+/).filter(t => t && !STOP.has(t));
}

function scoreCandidate(tokens, name) {
  const l = name.toLowerCase();
  return tokens.reduce((s, t) => s + (l.includes(t) ? 1 : 0), 0);
}

export async function resolveMovie(rec, fetchImpl = fetch) {
  const q = encodeURIComponent(`Detective Conan ${rec.title}`);
  const r = await fetchImpl(`${SEARCH}${q}.json`);
  const j = await r.json();
  const metas = j.metas || [];
  const candidates = metas.filter(m => /conan/i.test(m.name));
  const tokens = titleTokens(rec.title);

  let best = null;
  let bestScore = -1;
  for (const m of candidates) {
    const score = scoreCandidate(tokens, m.name);
    if (score > bestScore) {
      best = m;
      bestScore = score;
    } else if (score === bestScore && best) {
      const mIsDc = /detective conan|case closed/i.test(m.name);
      const bestIsDc = /detective conan|case closed/i.test(best.name);
      if (mIsDc && !bestIsDc) best = m;
    }
  }

  const hit = bestScore > 0 ? best : null;
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
      name: `Movie ${m.movieNumber}: ${m.title}${m.placeAfterEpisode != null ? ` — watch after Ep ${m.placeAfterEpisode}` : ''}`,
      poster: m.poster || undefined,
      releaseInfo: m.year || undefined,
    }));
}
