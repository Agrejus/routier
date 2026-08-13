---
title: Docs README
search: false
---

# Routier Documentation

This folder is a [VitePress](https://vitepress.dev) site published to
[routier.dev](https://routier.dev) with GitHub Pages.

## Local development

```bash
cd docs
npm install
npm run docs:dev      # dev server with hot reload
npm run docs:build    # production build (also validates internal links)
npm run docs:preview  # serve the production build locally
```

## Layout

- `index.md` — the landing page (VitePress `home` layout).
- `.vitepress/config.mts` — site config: nav, theme, search.
- `.vitepress/sidebar.json` — the sidebar tree. Add new pages here.
- `.vitepress/theme/custom.css` — brand colors and visual tweaks.
- `_snippets/` — code samples imported into pages with `<<< @/_snippets/...`.
- `api/index.md` — hand-written public API map.
- `reference/api/` — generated signatures for every package entry point; regenerate with `npm run typedoc` at the repository root.
- `public/` — static assets served at the site root (logo, `CNAME`).

## Deployment

Pushing changes under `docs/` to `main` triggers
`.github/workflows/docs.yml`, which builds the site and deploys it to
GitHub Pages.

## Conventions

- Internal links are site-absolute without extensions: `/guides/live-queries`.
- The build fails on dead internal links — run `npm run docs:build` inside this directory before pushing.
- Add every public package or subpath entry point to `../typedoc.json`; do not hand-edit `reference/api/`.
- Prefer `<<<` snippet imports over inline fenced code for anything longer
  than a few lines, so samples stay type-checkable.
