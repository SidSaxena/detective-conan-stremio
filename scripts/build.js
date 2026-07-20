import { readFile } from 'node:fs/promises';
import { parseList } from '../src/parse.js';
import { buildVideos } from '../src/episodes.js';
import { validateNumbering } from '../src/validate.js';
import { resolveMovies, buildMovieItems } from '../src/movies.js';
import { fetchAllEpisodeTitles } from '../src/kitsu.js';
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

const titles = await fetchAllEpisodeTitles();
console.log(`Kitsu titles fetched: ${titles.size}`);

const videos = buildVideos(episodes, titles);
const missing = videos.filter(v => !titles.has(v.episode)).length;
console.log(`Curated episodes without a Kitsu title (fell back to arc/number): ${missing}`);

const resolved = await resolveMovies(movies);
const unresolved = resolved.filter(m => !m.imdbId);
if (unresolved.length) console.log('UNRESOLVED MOVIES (fix manually):', unresolved.map(m => `${m.movieNumber}:${m.title}`));

const resolvedIds = resolved.filter(m => m.imdbId).map(m => m.imdbId);
const idCounts = new Map();
for (const id of resolvedIds) idCounts.set(id, (idCounts.get(id) || 0) + 1);
const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1);

const buildFailures = [];
if (report.duplicates.length > 0) buildFailures.push(`episode numbering duplicates: ${report.duplicates.join(', ')}`);
if (report.outOfRange.length > 0) buildFailures.push(`episode numbers out of range: ${report.outOfRange.join(', ')}`);
if (unresolved.length > 0) buildFailures.push(`unresolved movies (no imdbId): ${unresolved.map(m => `${m.movieNumber}:${m.title}`).join(', ')}`);
if (duplicateIds.length > 0) {
  const collisions = duplicateIds.map(([id]) => {
    const names = resolved.filter(m => m.imdbId === id).map(m => `Movie ${m.movieNumber} (${m.title})`);
    return `${id} -> ${names.join(' & ')}`;
  });
  buildFailures.push(`duplicate resolved IMDb ids: ${collisions.join('; ')}`);
}

if (buildFailures.length > 0) {
  console.error('\nBUILD FAILED — validation gate tripped:');
  for (const f of buildFailures) console.error(`  - ${f}`);
  process.exit(1);
}

gen.annotateMovieMarkers(videos, resolved);

const written = await gen.writeAddon('dist', {
  manifest: gen.buildManifest(),
  seriesCatalog: gen.buildSeriesCatalog(),
  movieCatalog: gen.buildMovieCatalog(buildMovieItems(resolved)),
  seriesMeta: gen.buildSeriesMeta(videos),
});
console.log(`Wrote ${videos.length} episodes + ${buildMovieItems(resolved).length} movies:`, written);
