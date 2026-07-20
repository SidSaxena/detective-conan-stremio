import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseList } from '../src/parse.js';

const html = readFileSync(new URL('./fixtures/xerblade-sample.html', import.meta.url), 'utf8');

test('parses episode entries in numeric decade order', () => {
  const { episodes } = parseList(html);
  assert.equal(episodes.length, 5);
  assert.deepEqual(
    episodes.map(e => [e.start, e.end]),
    [[1, 2], [3, 3], [490, 490], [491, 504], [507, 508]],
  );
});

test('extracts range, intl, manga, arc, tier, chars, special', () => {
  const { episodes } = parseList(html);
  const clash = episodes.find(e => e.start === 491);
  assert.equal(clash.end, 504);
  assert.equal(clash.intl, '538-551');
  assert.equal(clash.manga, '585-590,595-609|V56F10-V57F4,V57F9-V59F1');
  assert.equal(clash.arc, 'Clash of Red and Black');
  assert.equal(clash.tier, 'main');
  assert.deepEqual(clash.chars, ['Black Organization']);

  const heiji = episodes.find(e => e.start === 490);
  assert.equal(heiji.tier, 'listed');
  assert.equal(heiji.special, '1 Hour Special');
  assert.deepEqual(heiji.chars, ['Heiji']);
  assert.equal(heiji.description, 'Heiji case.');
});

test('parses movies with positional placeAfterEpisode', () => {
  const { movies } = parseList(html);
  assert.equal(movies.length, 2);
  assert.deepEqual(movies[0], { movieNumber: 1, title: 'The Time-Bombed Skyscraper', placeAfterEpisode: null });
  assert.deepEqual(movies[1], { movieNumber: 11, title: 'Jolly Roger in the Deep Azure', placeAfterEpisode: 504 });
});

test('parses non-episode non-movie rows into skipped', () => {
  const { skipped } = parseList(html);
  assert.deepEqual(skipped, ['MK 4']);
});
