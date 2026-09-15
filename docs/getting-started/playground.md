---
title: Playground
---

# Playground

The Routier playground runs real examples in your browser: schemas, queries, live
subscriptions, a paged live data grid, React, and IndexedDB persistence. There's nothing to install and no account to
create, and the code on screen is the exact file that runs.

<p>
  <a class="playground-button" href="/playground/" target="_self">Open the Playground →</a>
</p>

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
