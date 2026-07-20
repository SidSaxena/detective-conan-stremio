export function seasonFor(n) {
  return Math.floor(n / 100) + 1;
}

export function videoTitle(rec, n, kitsuTitle) {
  const base = (kitsuTitle && kitsuTitle.trim()) || rec.arc || `Episode ${n}`;
  return rec.tier === 'main' ? `${base} ★Main Plot` : base;
}

export function videoOverview(rec) {
  let o = rec.description || '';
  if (rec.special) o += `\n(${rec.special})`;
  if (rec.manga) o += `\nManga: ${rec.manga}`;
  if (rec.chars && rec.chars.length) o += `\nFocus: ${rec.chars.join(', ')}`;
  return o.trim();
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
