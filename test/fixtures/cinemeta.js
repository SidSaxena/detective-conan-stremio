export function cinemetaFetchStub(url) {
  const metas = [
    { id: 'tt2380307', name: 'Some Unrelated Film', releaseInfo: '2013', poster: 'x' },
    { id: 'tt1226256', name: 'Detective Conan: Jolly Roger in the Deep Azure', releaseInfo: '2007', poster: 'https://img/jolly.jpg' },
  ];
  return Promise.resolve({ json: () => Promise.resolve({ metas }) });
}

export function emptyCinemetaStub() {
  return Promise.resolve({ json: () => Promise.resolve({ metas: [] }) });
}
