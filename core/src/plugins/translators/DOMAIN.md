# Translators — database response to model

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Convert a response from a database into something the datastore recognizes.

## Rules

- A translator runs on the way BACK. Expressions go out to the plugin; a translator brings rows or records home.
- JsonTranslator evaluates every query option in memory by default. A plugin subclasses it and overrides only the options its backend actually applied, checking option.target — DexieTranslator is the smallest worked example.
- SqlTranslator stays in core deliberately: it encodes that aggregate results arrive as rows, which is a shape convention and names no engine. A driver that deviates overrides it in its own plugin — see PostgresSqlTranslator and its bigint COUNT branch.

## May import

No workspace package. This domain is a leaf of the dependency graph.

## Covers

- `core/src/plugins/translators`
