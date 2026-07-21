import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllMalTitles } from '../src/mal.js';

function stub() {
  const pages = {
    1: { data: [{ mal_id: 1, title: 'Roller Coaster Murder Case' }, { mal_id: 2, title: 'Kidnapping Case' }], pagination: { last_visible_page: 2 } },
    2: { data: [{ mal_id: 800, title: 'Chase 100 Million Yen' }, { mal_id: 801, title: '' }, { mal_id: null, title: 'skip' }], pagination: { last_visible_page: 2 } },
  };
  return (url) => {
    const m = String(url).match(/page=(\d+)/);
    const p = m ? Number(m[1]) : 1;
    return Promise.resolve({ json: () => Promise.resolve(pages[p] || { data: [], pagination: { last_visible_page: 2 } }) });
  };
}

test('paginates Jikan and maps mal_id -> title, skipping empty/null entries', async () => {
  const titles = await fetchAllMalTitles(stub(), 0);
  assert.equal(titles.get(1), 'Roller Coaster Murder Case');
  assert.equal(titles.get(800), 'Chase 100 Million Yen');
  assert.equal(titles.has(801), false);
  assert.equal(titles.size, 3);
});
