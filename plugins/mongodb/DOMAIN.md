# MongoDB query translation

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Translates a core expression tree into an MQL filter document. The MongoDB counterpart of toSql.

## Rules

- Translation only. There is no IDbPlugin here yet — no connection, no driver, no write path.
- A field must be a key in MQL, so a comparison with the property on the right is MIRRORED rather than emitted in source order. Getting that wrong returns the opposite rows from a query that still looks valid.
- A filter with no MQL form throws and names the memory execution target. It never widens the filter and never falls back to a scan.

## May import

`@routier/core`

## Covers

- `plugins/mongodb`
