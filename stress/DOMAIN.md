# Stress and volume

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Finds the defects that only appear under real load, churn, or concurrency.

## Rules

- Gated behind STRESS=1, so a default run lists these as skipped rather than executing them.
- A defect found here is reduced to its smallest form in e2e before it is fixed, so the guard survives after the load test stops being run.

## Covers

- `stress`
