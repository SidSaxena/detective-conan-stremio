import { writeFile, mkdir } from 'node:fs/promises';

const URL = 'https://www.xerblade.com/p/detective-conan-important-episode-list.html?m=1';
const res = await fetch(URL, { headers: { 'user-agent': 'Mozilla/5.0' } });
const html = await res.text();
await mkdir('data/raw', { recursive: true });
await writeFile('data/raw/xerblade.html', html);
console.log(`Saved ${html.length} bytes to data/raw/xerblade.html`);
