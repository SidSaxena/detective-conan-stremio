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
