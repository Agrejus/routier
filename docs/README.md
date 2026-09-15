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
npm run docs:dev            # docs server with hot reload
npm run docs:build          # documentation only; validates internal links
npm run lab:build           # build the React Lab into public/lab
npm run playground:dev      # run the Playground with hot reload (http://localhost:5220)
npm run playground:build    # build the Playground into public/playground
npm run docs:build:with-lab # production deployment build (Lab + Playground + docs)
npm run docs:preview        # serve the production build locally
```

## Layout

- `index.md` — the landing page (VitePress `home` layout).
- `.vitepress/config.mts` — site config: nav, theme, search.
- `.vitepress/sidebar.json` — the sidebar tree. Add new pages here.
- `.vitepress/theme/custom.css` — brand colors and visual tweaks.
- `_snippets/` — code samples imported into pages with `<<< @/_snippets/...`.
- `api/index.md` — hand-written public API map.
- `reference/api/` — generated signatures for every package entry point; regenerate with `npm run typedoc` at the repository root.
- `public/` — static assets served at the site root (logo, `CNAME`). The Lab and Playground builds are generated into `public/lab/` and `public/playground/` and are intentionally gitignored.
- `../examples/db-migration/` — the React Lab application published at `/lab/`.
- `../examples/playground/` — the in-browser Playground published at `/playground/`. Its example files are also shown on `getting-started/playground.md`.

## Deployment

Pushing documentation, Lab, Playground, or relevant package changes to `main` triggers
`.github/workflows/docs.yml`. The workflow builds the workspace packages, bundles the Lab at
`/lab/` and the Playground at `/playground/`, builds VitePress, and deploys the combined output to GitHub Pages.

## Conventions

- Internal links are site-absolute without extensions: `/guides/live-queries`.
- The build fails on dead internal links — run `npm run docs:build` inside this directory before pushing.
- Add every public package or subpath entry point to `../typedoc.json`; do not hand-edit `reference/api/`.
- Prefer `<<<` snippet imports over inline fenced code for anything longer
  than a few lines, so samples stay type-checkable.
