# Datastore — the CRUD abstraction

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

The CRUD abstraction that routes everything to the plugins. Everything it does is agnostic and done in its own way; that way is what gets passed to a plugin.

## Rules

- It is the only thing callers talk to. It tracks changes, resolves queries, and hands work to a plugin through IDbPlugin.
- Everything it does is agnostic. It speaks expressions, schemas, collections and change sets — never a query language.
- Translating its way into a query language is the PLUGIN's responsibility, never this package's. If something here starts to look engine-shaped, it belongs in a plugin.
- It does not choose a backend. Which plugin it routes to is the caller's decision, which is why the same store runs against nine of them.

## May import

`@routier/core`

## Covers

- `datastore/src`
