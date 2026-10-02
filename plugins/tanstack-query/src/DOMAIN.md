# TanStack Query bridge

<!-- Generated from tooling/architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Exposes a datastore's live queries as TanStack Query options, so an app keeps its existing cache layer.

## Rules

- Binds to the datastore's public surface only. An option that needs plugin internals is a sign the datastore is missing something.
- A live query's first result resolves the query function; later results are written into the query cache. Change detection lives in the datastore.

## May import

`@routier/core`, `@routier/datastore`

## Covers

- `plugins/tanstack-query/src`
