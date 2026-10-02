# Svelte bindings

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Exposes a datastore to Svelte components as readable stores.

## Rules

- Binds to the datastore's public surface only. A store that needs plugin internals is a sign the datastore is missing something.
- Subscription lifecycle lives here, tied to the store's first and last subscriber; change detection lives in the datastore.

## May import

`@routier/core`, `@routier/datastore`

## Covers

- `plugins/svelte/src`
