# Core — the data model

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Describes the data model and nothing about storage: schemas, properties, expressions, change sets, results.

## Rules

- May describe the data model. May not describe storage — no column, no statement, no driver quirk, no type named after an engine.
- Imports no workspace package. It is the bottom of the dependency graph, and everything else may depend on it.
- The useful question during a fix is not 'is this the smallest change' but 'is this a fact about the data model, or a fact about a database?'
- See specs/core-agnosticism.md for the violations that arrived before this was enforced, and how each was moved out.

## May import

No workspace package. This domain is a leaf of the dependency graph.

## Covers

- `core/src`
