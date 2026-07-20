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

test('annotateMovieMarkers appends a Next-movie marker to the placement episode and leaves others unchanged', () => {
  const otherOverview = 'Unrelated episode.';
  const videos = [
    { id: 'kitsu:210:504', episode: 504, overview: 'Arc conclusion.' },
    { id: 'kitsu:210:505', episode: 505, overview: otherOverview },
  ];
  annotateMovieMarkers(videos, [{ movieNumber: 11, title: 'Jolly Roger in the Deep Azure', placeAfterEpisode: 504 }]);
  assert.match(videos[0].overview, /▶ Next: Movie 11 — Jolly Roger in the Deep Azure/);
  assert.equal(videos[1].overview, otherOverview);
});

test('annotateMovieMarkers does not throw and leaves videos unchanged when a movie placement matches no episode', () => {
  const videos = [{ id: 'kitsu:210:1', episode: 1, overview: 'Intro.' }];
  assert.doesNotThrow(() => {
    annotateMovieMarkers(videos, [{ movieNumber: 99, title: 'Nowhere', placeAfterEpisode: 777 }]);
  });
  assert.equal(videos[0].overview, 'Intro.');
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
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.idPrefixes, ['dcc-conan']);
  assert.equal(manifest.catalogs.length, 2);
  const seriesCat = JSON.parse(readFileSync(join(dir, 'catalog/series/dcc-series.json'), 'utf8'));
  assert.equal(seriesCat.metas[0].id, 'dcc-conan');
});
