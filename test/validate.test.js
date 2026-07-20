import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNumbering } from '../src/validate.js';
import { kitsuFetchStub } from './fixtures/kitsu.js';

test('reports total, kitsu count, and boundary sample titles', async () => {
  const episodes = [{ start: 1, end: 1 }, { start: 491, end: 504 }];
  const r = await validateNumbering(episodes, kitsuFetchStub);
  assert.equal(r.total, 15);
  assert.equal(r.kitsuCount, 1145);
  assert.deepEqual(r.duplicates, []);
  assert.deepEqual(r.outOfRange, []);
  const titles = Object.fromEntries(r.sampleTitles.map(s => [s.number, s.kitsuTitle]));
  assert.equal(titles[491], 'The Red and Black Clash: Suspicion');
  assert.equal(titles[504], 'The Red and Black Clash: Conclusion');
});

test('flags duplicates and out-of-range numbers', async () => {
  const episodes = [{ start: 1, end: 1 }, { start: 1, end: 1 }, { start: 2000, end: 2000 }];
  const r = await validateNumbering(episodes, kitsuFetchStub);
  assert.deepEqual(r.duplicates, [1]);
  assert.deepEqual(r.outOfRange, [2000]);
});
