import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonFor, buildVideos } from '../src/episodes.js';

test('seasonFor maps into decade-100 blocks', () => {
  assert.equal(seasonFor(1), 1);
  assert.equal(seasonFor(99), 1);
  assert.equal(seasonFor(100), 2);
  assert.equal(seasonFor(491), 5);
});

test('buildVideos expands a range into one video per absolute episode, using the Kitsu title when available', () => {
  const episodes = [{ start: 491, end: 504, intl: '538-551', manga: '585-590', arc: 'Clash of Red and Black', description: '"Clash of Red and Black"—longest arc.', tier: 'main', chars: ['Black Organization'], special: null }];
  const titles = new Map([[491, 'The Red and Black Clash: Suspicion']]);
  const videos = buildVideos(episodes, titles);
  assert.equal(videos.length, 14);
  const first = videos[0];
  assert.equal(first.id, 'kitsu:210:491');
  assert.equal(first.season, 5);
  assert.equal(first.episode, 491);
  assert.equal(first.title, 'The Red and Black Clash: Suspicion ★Main Plot');
  assert.match(first.overview, /Clash of Red and Black/);
  assert.match(first.overview, /\n\n• /);
  assert.match(first.overview, /• Manga 585-590/);
  assert.match(first.overview, /• Focus: Black Organization/);
});

test('buildVideos falls back to rec.arc when the map has no title for that episode number', () => {
  const episodes = [{ start: 491, end: 504, intl: '538-551', manga: '585-590', arc: 'Clash of Red and Black', description: '"Clash of Red and Black"—longest arc.', tier: 'main', chars: ['Black Organization'], special: null }];
  const titles = new Map([[491, 'The Red and Black Clash: Suspicion']]);
  const videos = buildVideos(episodes, titles);
  const second = videos[1];
  assert.equal(second.episode, 492);
  assert.equal(second.title, 'Clash of Red and Black ★Main Plot');
});

test('buildVideos titles a non-main episode with the Kitsu title, no star suffix, no leading number', () => {
  const titles = new Map([[3, 'The Kaitou Kid\'s Challenge']]);
  const videos = buildVideos([{ start: 3, end: 3, intl: null, manga: '6-9', arc: null, description: 'Kaitou Kid style case.', tier: 'listed', chars: [], special: null }], titles);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].title, "The Kaitou Kid's Challenge");
});

test('buildVideos falls back to "Episode <n>" when no title and no arc are available', () => {
  const videos = buildVideos([{ start: 3, end: 3, intl: null, manga: '6-9', arc: null, description: 'Kaitou Kid style case.', tier: 'listed', chars: [], special: null }]);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].title, 'Episode 3');
});
