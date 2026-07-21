# Detective Conan — Canon & Movies (Stremio addon)

Static Stremio addon surfacing only the curated canon/important Detective Conan
episodes and movies from the [XerBlade list](https://www.xerblade.com/p/detective-conan-important-episode-list.html),
in watch order, reusing `kitsu:210:N` stream ids so existing stream addons
(Torrentio, etc.) resolve untouched.

Currently ships **455 curated episodes + 25 movies**. Episode titles come from
Kitsu; the curated plot note, tier (`★Main Plot`), and manga refs live in the
description; movies are placed in watch order with `▶ Watch Movie N` markers.

## Install

Paste this manifest URL into Stremio's addon search / "Add addon" box:

    https://sidsaxena.github.io/detective-conan-stremio/manifest.json

Installs once and syncs across your devices via your Stremio account. It only
supplies metadata + ordering — streams still come from your existing stream
addons, because every episode reuses the `kitsu:210:N` id they already resolve.

## Regenerate

    npm install
    npm run scrape   # refresh data/raw/xerblade.html
    npm run build    # -> dist/

## Host

Publish `dist/` to any static host that sends `Access-Control-Allow-Origin: *`
(Stremio fetches cross-origin):

- **GitHub Pages (this repo):** the `gh-pages` branch root is the deployed `dist/`
  (plus a `.nojekyll` marker). Redeploy after a rebuild by copying `dist/` onto that
  branch and pushing. Live at `https://sidsaxena.github.io/detective-conan-stremio/manifest.json`.
- **Cloudflare Pages / Netlify:** add a `_headers` file with
  `/*\n  Access-Control-Allow-Origin: *` and deploy `dist/`.

Local test: `npx http-server dist -p 8100 --cors`, install `http://127.0.0.1:8100/manifest.json`.
