# Playground

Small, self-contained Routier examples that run in the browser, published with the docs at
[routier.dev/playground/](https://routier.dev/playground/). It replaces the old CodeSandbox
devbox: everything is built from this repository and served as static files.

Each example in `src/examples/` is shown on screen via a `?raw` import, so the code a reader
sees is exactly the code that runs.

| Example | File |
| --- | --- |
| Schemas & CRUD | `src/examples/crud.ts` |
| Live queries | `src/examples/liveQueries.ts` |
| Live data grid (search, sort, paging, simulated traffic) | `src/examples/LiveGrid.tsx` |
| React + `useQuery` | `src/examples/ReactTodos.tsx` |
| IndexedDB persistence (Dexie) | `src/examples/PersistentNotes.tsx` |

Link to one directly with a hash: `/playground/#live-queries`.

## Run it

1. Build the workspace packages at the repo root: `npm run build`.
2. From `docs/`: `npm run playground:dev` and open `http://localhost:5220`.

`npm run playground:build` (also from `docs/`) writes the production bundle to
`docs/public/playground/`, which `npm run docs:build:with-lab` includes in the site.

## Adding an example

Add a file under `src/examples/`. Scripts export `run(log)`; components export a React
component. Register it in the `EXAMPLES` array in `src/App.tsx`, and show it on
`docs/getting-started/playground.md` with a `<<<` snippet import.
