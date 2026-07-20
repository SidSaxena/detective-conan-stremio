import * as cheerio from 'cheerio';

const NUM_RE = /^(\d+)(?:-(\d+))?$/;
const MOVIE_RE = /^Movie\s*(\d+)$/i;

export function parseList(html) {
  const $ = cheerio.load(html);
  const episodes = [];
  const movies = [];
  const skipped = [];
  let lastEnd = null;

  const uls = $('ul[id^="tab"]').toArray().sort((a, b) => {
    const na = parseInt(($(a).attr('id') || '').replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(($(b).attr('id') || '').replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });

  for (const ul of uls) {
    for (const li of $(ul).children('li').toArray()) {
      const $li = $(li);
      const pos = $li.find('.dc-list-pos').first();
      const noText = pos.find('.dc-list-no').first().text().trim();

      const movieM = noText.match(MOVIE_RE);
      if (movieM) {
        const title = pos.text().replace(/^Movie\s*\d+\s*:?\s*/i, '').trim();
        movies.push({ movieNumber: Number(movieM[1]), title, placeAfterEpisode: lastEnd });
        continue;
      }

      const parts = noText ? noText.split(',').map(p => p.trim()) : [];
      const segMatches = parts.length ? parts.map(p => p.match(NUM_RE)) : [];
      if (!parts.length || segMatches.some(m => !m)) {
        if (noText) skipped.push(noText);
        continue;
      }
      const segments = segMatches.map(m => ({
        start: Number(m[1]),
        end: m[2] ? Number(m[2]) : Number(m[1]),
      }));

      const leadText = pos.text();
      const intl = (leadText.match(/\[INTL\s*([^\]]+)\]/) || [])[1]?.trim() || null;
      const manga = (leadText.match(/\(manga\s*([^)]*)\)/i) || [])[1]?.trim() || null;

      let tier = 'listed';
      let special = null;
      $li.find('.dc-list-no').each((_, el) => {
        const t = $(el).text().trim();
        if (t === '*Main Plot*') tier = 'main';
        const sp = t.match(/\(([\d.]+\s*Hour Special)\)/i);
        if (sp) special = sp[1];
      });

      const chars = $li.find('.dc-list-char').map((_, el) => $(el).text().trim()).get();

      const $p = $li.find('p').first().clone();
      $p.find('.dc-list-pos').remove();
      const description = $p.text().replace(/\s+/g, ' ').trim();
      const arc = (description.match(/[“"]([^”"]+)[”"]/) || [])[1] || null;

      for (const { start, end } of segments) {
        episodes.push({ start, end, intl, manga, arc, description, tier, chars, special });
      }
      lastEnd = segments[segments.length - 1].end;
    }
  }

  return { episodes, movies, skipped };
}
