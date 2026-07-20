# Detective Conan — Canon & Movies (Stremio addon)

Static Stremio addon surfacing only the curated canon/important Detective Conan
episodes and movies from the XerBlade list, in watch order, reusing `kitsu:210:N`
stream ids so existing stream addons (Torrentio, etc.) resolve untouched.

## Regenerate

    npm install
    npm run scrape   # refresh data/raw/xerblade.html
    npm run build    # -> dist/

## Host

Publish `dist/` to any static host that sends `Access-Control-Allow-Origin: *`
(Stremio fetches cross-origin):

- **GitHub Pages:** push `dist/` to a `gh-pages` branch (or a `/docs` folder on main).
  Install URL: `https://<user>.github.io/<repo>/manifest.json`.
- **Cloudflare Pages / Netlify:** add a `_headers` file with
  `/*\n  Access-Control-Allow-Origin: *` and deploy `dist/`.

Local test: `npx http-server dist -p 8100 --cors`, install `http://127.0.0.1:8100/manifest.json`.
