# Architecture — this manifest and its enforcement

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Holds what each domain is responsible for, renders it into each domain's DOMAIN.md, and fails the suite when the repository stops matching.

## Rules

- domains.ts is the single source of truth. A DOMAIN.md is generated; edit the manifest and run npm run domains:write.
- A new package with no entry here fails the orphan check. That failure is the prompt to write down what the code is for.

## May import

No workspace package. This domain is a leaf of the dependency graph.

## Covers

- `architecture`
