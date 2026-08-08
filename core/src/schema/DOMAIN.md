# Schema and PropertyInfo

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Defines what an entity is. PropertyInfo carries a property and its metadata; a schema is modified through .modify().

## Rules

- PropertyInfo is the properties and their metadata on a schema — type, key, identity, nullability, renames, indexes, serializers.
- A schema is changed through .modify(), not by mutating a compiled schema. A compiled schema is a read-only fact that plugins and codegen both depend on.
- getResolvedName() returns the LEAF storage name. A nested property's full location also needs getParentPathArray({ useFromPropertyName: true }); using the leaf alone is how a nested filter came to name a column that does not exist.
- A wrapper plugin may hand its inner plugin a schema view with synthetic properties appended. ConcurrencyDbPlugin is the reference for that technique.

## May import

No workspace package. This domain is a leaf of the dependency graph.

## Covers

- `core/src/schema`
