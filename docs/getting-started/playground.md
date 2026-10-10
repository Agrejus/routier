---
title: Playground
description: "Edit and run Routier in your browser — schemas, queries, live subscriptions, React, and real IndexedDB, localStorage, SQLite and PostgreSQL plugins, with no install."
---

# Playground

The Routier playground is an editor and runtime in your browser. Every example is editable TypeScript,
with autocomplete and type checking for Routier's API. Press **Run** (or Ctrl/⌘ + Enter) and it compiles
and runs right on the page against the real plugins: memory, localStorage, IndexedDB, and SQLite and
PostgreSQL compiled to WebAssembly. There's nothing to install and no account to create.

- **Edit anything.** Your changes are kept per example; **Reset** brings back the original.
- **Write your own.** Start from **Sandbox**, or import any plugin: `@routier/sqlite-plugin`,
  `@routier/pglite-plugin`, `@routier/dexie-plugin`, `@routier/browser-storage-plugin`.
- **Scripts or components.** Export `run(log)` to log results, or export a React component to render it.
- **Share it.** **Share** copies a link with your code in it.

<p>
  <a class="playground-button" href="/playground/" target="_self">Open the Playground →</a>
</p>

::: tip Devtools are on
Every example is mounted in [Routier devtools](/integrations/devtools/). Click the **Routier** button in
the bottom-right corner of the Playground to see the example's collections and rows update as it runs,
and open the **Queries** tab to see how each query executed.
:::

## Examples

### Schemas & CRUD

Define a schema, then add, query, update, and remove entities.
<a href="/playground/#crud" target="_self">Run it →</a>

<<< @/../examples/playground/src/examples/crud.ts

### Live queries

`.subscribe()` turns a query live. The callback receives the current result and runs again
every time a saved change affects it.
<a href="/playground/#live-queries" target="_self">Run it →</a>

<<< @/../examples/playground/src/examples/liveQueries.ts

### Live data grid

A searchable, sortable, paged product grid. The visible page is one live query,
`where → sort → skip → take → subscribe`, and a second subscribed `count` drives the pager.
Turn on **Simulate traffic** to add, update, and remove rows in the background: the current
page refreshes itself and changed rows flash. See [Pagination](/concepts/queries/pagination)
for the pattern.
<a href="/playground/#grid" target="_self">Try it →</a>

<<< @/../examples/playground/src/examples/LiveGrid.tsx

### React + `useQuery`

A todo list whose components re-render from live queries. See the
[React adapter](/getting-started/react-adapter) for more.
<a href="/playground/#react" target="_self">Try it →</a>

<<< @/../examples/playground/src/examples/ReactTodos.tsx

### IndexedDB persistence

The same store API on the [Dexie plugin](/integrations/plugins/built-in-plugins/dexie/README).
Add a note, reload the page, and it's still there.
<a href="/playground/#persistence" target="_self">Try it →</a>

<<< @/../examples/playground/src/examples/PersistentNotes.tsx

### localStorage

A store kept in `localStorage` with the [browser storage plugin](/integrations/plugins/built-in-plugins/local-storage/README).
Run it, reload the page, and run it again.
<a href="/playground/#local-storage" target="_self">Try it →</a>

<<< @/../examples/playground/src/examples/localStorage.ts

### SQLite (WASM)

Real SQLite compiled to WebAssembly, through the [SQLite plugin](/integrations/plugins/built-in-plugins/sqlite/README).
Open the devtools **Queries** tab to see the SQL each query ran.
<a href="/playground/#sqlite" target="_self">Try it →</a>

<<< @/../examples/playground/src/examples/sqliteQueries.ts

### PostgreSQL (PGlite)

Real PostgreSQL compiled to WebAssembly, through the [PGlite plugin](/integrations/plugins/built-in-plugins/pglite/README).
The first run downloads it, so give it a few seconds.
<a href="/playground/#pglite" target="_self">Try it →</a>

<<< @/../examples/playground/src/examples/pgliteQueries.ts

## Run it locally

The playground is a small Vite app in
[`examples/playground`](https://github.com/Agrejus/routier/tree/main/examples/playground).
To run it on your machine:

```bash
git clone https://github.com/Agrejus/routier.git
cd routier
npm ci
npm run build            # the playground imports the built packages
cd docs
npm run playground:dev   # http://localhost:5220
```

### Use an example in your own project

Each example is a single file. Install the packages it imports, then copy the file into any
TypeScript project (React examples need a React app, such as one created with
`npm create vite@latest -- --template react-ts`):

```bash
npm install @routier/core @routier/datastore @routier/memory-plugin
npm install @routier/react           # React examples
npm install @routier/dexie-plugin    # IndexedDB example
```

Continue with [Installation](/getting-started/installation) and the
[Quick Start](/getting-started/quick-start).
