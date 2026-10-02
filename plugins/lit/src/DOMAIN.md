# Lit bindings

<!-- Generated from tooling/architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Exposes a datastore to Lit and other web components as a reactive controller.

## Rules

- Binds to the datastore's public surface only. A controller that needs plugin internals is a sign the datastore is missing something.
- Subscription lifecycle follows the host's connect and disconnect; change detection lives in the datastore.

## May import

`@routier/core`, `@routier/datastore`

## Covers

- `plugins/lit/src`
