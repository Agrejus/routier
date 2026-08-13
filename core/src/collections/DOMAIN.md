# Collections

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

A way to define a collection, and to carry the pending changes against one.

## Rules

- A collection names a set of entities of one schema. It is a data-model concept: it does not know whether the backend calls it a table, a store, or a document collection.
- Change sets belong here too — adds, updates and removes are described in entity terms, and a plugin decides what statement or operation each becomes.

## May import

No workspace package. This domain is a leaf of the dependency graph.

## Covers

- `core/src/collections`
