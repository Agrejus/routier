# End-to-end and conformance

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Runs the same matrix against every real engine, so a divergence between backends is a failure rather than a surprise.

## Rules

- Every case here is a question every engine must answer the same way. A divergence is the finding.
- Assertions EXECUTE generated queries rather than compare them to snapshots. A string assertion cannot tell a valid statement from a correct one.
- SQLite always runs; container engines are gated behind E2E_CONTAINERS=1. SQLite passing is necessary and nowhere near sufficient — it forgives loose JSON typing, multi-statement calls, and file-level write serialization.

## Covers

- `e2e`
