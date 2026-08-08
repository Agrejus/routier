# Plugins — where data lives, and translation into a query language

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Implements IDbPlugin. Translates the agnostic form the datastore passes down into the query language its backend expects.

## Rules

- A BACKEND plugin adds one more place data can live. A WRAPPER plugin wraps another IDbPlugin and works with every backend at once — prefer a wrapper whenever the feature is not about where bytes live.
- Translating an expression into a query language happens HERE, once per query language. Not in core, and not in the datastore.
- A query it cannot answer correctly must throw. Silently widening a filter returns wrong rows; silently falling back to a scan turns a bounded query into a full one. Both are worse than refusing.
- Never duplicate a shared builder. The MySQL plugin kept its own copy of toSql and drifted into three defects — ignored .from() renames, unescaped LIKE literals, and no JSON path — none of which were MySQL requirements.
- Engine-specific knowledge belongs on a dialect or a driver, stated once, so DDL and query generation cannot disagree.

## May import

`@routier/core`, `@routier/sql-plugin-core`, `@routier/blob-plugin`, `@routier/memory-plugin`

## Covers

- `plugins`
