# The plugin contract

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

The interface every backend implements, and the query options a datastore hands it.

## Rules

- IDbPlugin is FROZEN at query, destroy and bulkPersist, plus an optional identity. It will never gain functionality — it does not need any. A feature that seems to need a fourth method is either a wrapper plugin or a translator.
- A wrapper plugin implements IDbPlugin and holds another IDbPlugin. That is what makes a feature work across every backend at once instead of once per backend.
- QueryOptionsCollection decides per option whether it runs in the database or in memory. A plugin overrides only what it can genuinely push down; everything else is already handled.

## May import

No workspace package. This domain is a leaf of the dependency graph.

## Covers

- `core/src/plugins`
