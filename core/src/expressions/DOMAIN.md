# Expressions — the agnostic query language

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

The agnostic query language the datastore speaks. A plugin translates it into whatever query language its backend expects.

## Rules

- An expression is a filter as the data model sees it: property, value, comparator, logical operator, transformer. It knows nothing about how any backend will run it.
- Every backend receives the SAME expression tree. Turning it into SQL, MQL, or a JavaScript predicate is the plugin's job — see toSql in @routier/sql-plugin-core and toMql in @routier/mongodb-plugin for two worked examples.
- A filter core cannot parse becomes a not-parsable node, and QueryOptionsCollection routes it to the memory execution target. A plugin never has to invent a fallback.
- Adding a comparator here obliges every plugin's translator to answer it, or to refuse it loudly. Refusing beats returning the wrong rows.

## May import

No workspace package. This domain is a leaf of the dependency graph.

## Covers

- `core/src/expressions`
