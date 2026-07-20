export function seasonFor(n) {
  return Math.floor(n / 100) + 1;
}

function firstSentence(s) {
  const m = s.match(/^[^.!?]*[.!?]/);
  return (m ? m[0] : s).trim();
}

export function videoTitle(rec, n) {
  const base = rec.arc || firstSentence(rec.description) || `Episode ${n}`;
  const len = rec.end - rec.start + 1;
  const counter = len > 1 ? ` (${n - rec.start + 1}/${len})` : '';
  const star = rec.tier === 'main' ? ' ★Main Plot' : '';
  return `${n} · ${base}${counter}${star}`;
}

export function videoOverview(rec) {
  let o = rec.description || '';
  if (rec.special) o += `\n(${rec.special})`;
  if (rec.manga) o += `\nManga: ${rec.manga}`;
  if (rec.chars && rec.chars.length) o += `\nFocus: ${rec.chars.join(', ')}`;
  return o.trim();
}

export function buildVideos(episodes) {
  const videos = [];
  for (const rec of episodes) {
    for (let n = rec.start; n <= rec.end; n++) {
      videos.push({
        id: `kitsu:210:${n}`,
        title: videoTitle(rec, n),
        season: seasonFor(n),
        episode: n,
        overview: videoOverview(rec),
      });
    }
  }
  return videos;
}
