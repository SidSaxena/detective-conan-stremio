// Stub fetch for Kitsu. Recognises count query and filter[number]=N query.
const TITLES = { 1: 'Roller Coaster Murder Case', 491: 'The Red and Black Clash: Suspicion', 504: 'The Red and Black Clash: Conclusion' };

export function kitsuFetchStub(url) {
  const u = String(url);
  if (u.includes('filter%5Bnumber%5D=')) {
    const n = Number(u.match(/filter%5Bnumber%5D=(\d+)/)[1]);
    const title = TITLES[n];
    const data = title ? [{ attributes: { number: n, canonicalTitle: title, seasonNumber: 1 } }] : [];
    return Promise.resolve({ json: () => Promise.resolve({ data, meta: { count: data.length } }) });
  }
  // count query
  return Promise.resolve({ json: () => Promise.resolve({ data: [], meta: { count: 1145 } }) });
}
