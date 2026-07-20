import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonFor, buildVideos } from '../src/episodes.js';

test('seasonFor maps into decade-100 blocks', () => {
  assert.equal(seasonFor(1), 1);
  assert.equal(seasonFor(99), 1);
  assert.equal(seasonFor(100), 2);
  assert.equal(seasonFor(491), 5);
});

test('buildVideos expands a range into one video per absolute episode', () => {
  const episodes = [{ start: 491, end: 504, intl: '538-551', manga: '585-590', arc: 'Clash of Red and Black', description: '"Clash of Red and Black"—longest arc.', tier: 'main', chars: ['Black Organization'], special: null }];
  const videos = buildVideos(episodes);
  assert.equal(videos.length, 14);
  const first = videos[0];
  assert.equal(first.id, 'kitsu:210:491');
  assert.equal(first.season, 5);
  assert.equal(first.episode, 491);
  assert.equal(first.title, '491 · Clash of Red and Black (1/14) ★Main Plot');
  assert.match(first.overview, /Clash of Red and Black/);
  assert.match(first.overview, /Manga: 585-590/);
  assert.match(first.overview, /Focus: Black Organization/);
});

test('buildVideos titles a single non-main episode from its first sentence', () => {
  const videos = buildVideos([{ start: 3, end: 3, intl: null, manga: '6-9', arc: null, description: 'Kaitou Kid style case.', tier: 'listed', chars: [], special: null }]);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].title, '3 · Kaitou Kid style case.');
});
