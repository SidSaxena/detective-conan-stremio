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
