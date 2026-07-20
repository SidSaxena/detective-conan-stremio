export function seasonFor(n) {
  return Math.floor(n / 100) + 1;
}

export function videoTitle(rec, n, kitsuTitle) {
  const base = (kitsuTitle && kitsuTitle.trim()) || rec.arc || `Episode ${n}`;
  return rec.tier === 'main' ? `${base} ★Main Plot` : base;
}

export function videoOverview(rec) {
  const bits = [];
  if (rec.special) bits.push(rec.special);
  if (rec.manga) bits.push(`Manga ${rec.manga.replace('|', ' · ')}`);
  if (rec.chars && rec.chars.length) bits.push(`Focus: ${rec.chars.join(', ')}`);
  let o = (rec.description || '').trim();
  if (bits.length) o += `\n\n• ${bits.join('\n• ')}`;
  return o;
}

export function buildVideos(episodes, titles = new Map()) {
  const videos = [];
  for (const rec of episodes) {
    for (let n = rec.start; n <= rec.end; n++) {
      videos.push({
        id: `kitsu:210:${n}`,
        title: videoTitle(rec, n, titles.get(n)),
        season: seasonFor(n),
        episode: n,
        overview: videoOverview(rec),
      });
    }
  }
  return videos;
}
