import { fetchKitsuCount, fetchKitsuEpisode } from './kitsu.js';

export async function validateNumbering(episodes, fetchImpl = fetch) {
  const nums = [];
  for (const r of episodes) for (let n = r.start; n <= r.end; n++) nums.push(n);

  const seen = new Set();
  const dupSet = new Set();
  for (const n of nums) {
    if (seen.has(n)) dupSet.add(n);
    seen.add(n);
  }

  const kitsuCount = await fetchKitsuCount(fetchImpl);
  const outOfRange = kitsuCount ? nums.filter(n => n < 1 || n > kitsuCount) : [];

  const boundaries = new Set();
  for (const r of episodes) { boundaries.add(r.start); boundaries.add(r.end); }
  const sampleTitles = [];
  for (const n of [...boundaries].sort((a, b) => a - b)) {
    const ep = await fetchKitsuEpisode(n, fetchImpl);
    sampleTitles.push({ number: n, kitsuTitle: ep ? ep.title : '(not found)' });
  }

  return {
    total: nums.length,
    kitsuCount,
    duplicates: [...dupSet],
    outOfRange,
    sampleTitles,
  };
}
