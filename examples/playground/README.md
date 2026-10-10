# Playground

Small, self-contained Routier examples that run in the browser, published with the docs at
[routier.dev/playground/](https://routier.dev/playground/). It replaces the old CodeSandbox
devbox: everything is built from this repository and served as static files.

Every example opens in a Monaco editor with TypeScript checking and autocomplete for Routier's
API. Press **Run** (or Ctrl/⌘ + Enter) and the code is compiled in the browser and run against the
real plugins, including SQLite and PostgreSQL compiled to WebAssembly. Edits are kept per example
in `localStorage`; **Reset** restores the original and **Share** puts the code in the link.

| Example | File |
| --- | --- |
| Sandbox | `src/examples/sandbox.ts` |
| Schemas & CRUD | `src/examples/crud.ts` |
| Live queries | `src/examples/liveQueries.ts` |
| Live data grid (search, sort, paging, simulated traffic) | `src/examples/LiveGrid.tsx` |
| React + `useQuery` | `src/examples/ReactTodos.tsx` |
| IndexedDB persistence (Dexie) | `src/examples/PersistentNotes.tsx` |
| localStorage | `src/examples/localStorage.ts` |
| SQLite (WASM) | `src/examples/sqliteQueries.ts` |
| PostgreSQL (PGlite) | `src/examples/pgliteQueries.ts` |

Link to one directly with a hash: `/playground/#sqlite`. A shared link adds the code:
`/playground/#sqlite&code=…`.

## How code runs

```
editor ─► TypeScript worker emits CommonJS ─► require("…") names ─► load those modules ─► evaluate
                                                                      │
                                        exports.run(log) ─► Output    │    exported component ─► Preview
```

- `src/sandbox/modules.ts` lists what user code may import. Heavy plugins load only when imported.
- `src/sandbox/typeLibrary.ts` feeds the built `.d.ts` files of each package to the editor, so run
  `npm run build` first.

## Run it

1. Build the workspace packages at the repo root: `npm run build`.
2. From `docs/`: `npm run playground:dev` and open `http://localhost:5220`.

`npm run playground:build` (also from `docs/`) writes the production bundle to
`docs/public/playground/`, which `npm run docs:build:with-lab` includes in the site.

## Adding an example

Add a file under `src/examples/`. Scripts export `run(log)`; components export a React component.
Register it in `EXAMPLES` in `src/catalog.ts`, and show it on `docs/getting-started/playground.md`
with a `<<<` snippet import. To make a new package importable, add it to `src/sandbox/modules.ts`
and its declarations to `src/sandbox/typeLibrary.ts`.

## Tests

- Unit: `npx jest --selectProjects playground` covers compiling output, share links, drafts and
  the editor's type stubs.
- Browser: `npm run test:browser:playground` builds the playground and drives it in Chromium:
  every example runs, edits run, share and reset work, and autocomplete offers Routier's API.
  Set `CHROME_PATH` to use an installed Chrome.
