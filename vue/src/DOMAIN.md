# Vue bindings

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Exposes a datastore to Vue components as composables.

## Rules

- Binds to the datastore's public surface only. A composable that needs plugin internals is a sign the datastore is missing something.
- Subscription lifecycle and reactive dependency tracking live here; change detection lives in the datastore.

## May import

`@routier/core`, `@routier/datastore`

## Covers

- `vue/src`
