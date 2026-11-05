# Command line tools

<!-- Generated from tooling/architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

The routier command. Loads a project's schema definitions and writes their generated functions to files, so an app can use them without unsafe-eval.

## Rules

- Core owns what the generated source says. The CLI records what the project's own core builds, so the output always matches the core version the project installs.
- Record through the global recorder, not an import of core. The CLI and the project can each load their own copy of core.

## May import

`@routier/core`

## Covers

- `cli/src`
