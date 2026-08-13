# React bindings

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Exposes a datastore to React components as hooks.

## Rules

- Binds to the datastore's public surface only. A hook that needs plugin internals is a sign the datastore is missing something.
- Subscription and re-render behaviour lives here; change detection lives in the datastore.

## May import

`@routier/core`, `@routier/datastore`

## Covers

- `react/src`
