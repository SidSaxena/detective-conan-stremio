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

test('resolves Movie 13 via title-token overlap, not the first Detective Conan-named result', async () => {
  const recs = [{ movieNumber: 13, title: 'The Raven Chaser', placeAfterEpisode: null }];
  const stub = () => Promise.resolve({
    json: () => Promise.resolve({
      metas: [
        { id: 'tt_wrong', name: 'Detective Conan: The Darkest Nightmare', releaseInfo: '2016' },
        { id: 'tt1343046', name: 'Meitantei Conan: Shikkoku no chaser', releaseInfo: '2009' },
      ],
    }),
  });
  const [m] = await resolveMovies(recs, stub);
  assert.equal(m.imdbId, 'tt1343046');
  assert.equal(m.year, '2009');
});

test('resolves to null when only a false-positive "Conan" title (zero token overlap) matches', async () => {
  const recs = [{ movieNumber: 24, title: 'Quarter of Silence', placeAfterEpisode: null }];
  const stub = () => Promise.resolve({
    json: () => Promise.resolve({
      metas: [
        { id: 'tt0070034', name: 'Conan the Barbarian', releaseInfo: '1982' },
      ],
    }),
  });
  const [m] = await resolveMovies(recs, stub);
  assert.equal(m.imdbId, null);
});

test('buildMovieItems drops unresolved and formats placement in the name', () => {
  const items = buildMovieItems([
    { movieNumber: 11, title: 'Jolly Roger in the Deep Azure', placeAfterEpisode: 504, imdbId: 'tt1226256', year: '2007', poster: 'p' },
    { movieNumber: 1, title: 'The Time-Bombed Skyscraper', placeAfterEpisode: null, imdbId: 'tt0131479', year: '1997', poster: 'p1' },
    { movieNumber: 99, title: 'Nonexistent', placeAfterEpisode: null, imdbId: null, year: null, poster: null },
  ]);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { id: 'tt1226256', type: 'movie', name: 'Movie 11: Jolly Roger in the Deep Azure — watch after Ep 504', poster: 'p', releaseInfo: '2007' });
  assert.equal(items[1].name, 'Movie 1: The Time-Bombed Skyscraper');
});
