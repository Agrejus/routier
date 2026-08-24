# Release TODO — one manual item left

Temporary working note. Delete this file once the item below is done.

Written 2026-08-24. The publish it was written for is complete; this is what outlived it.

## Item: trusted publishers

`NPM_TOKEN` exists only until every package has an npm trusted publisher. Both packages
first published on 2026-08-24 can be configured now that they exist on npm.

1. Open npmjs.com and sign in.
2. Configure a trusted publisher for `@routier/postgres-plugin-core`, then for
   `@routier/pglite-plugin`. Owner `Agrejus`, repository `routier`, workflow `release.yml`,
   environment `npm`.
3. Confirm the other packages already have one.
4. When all of them do, delete the secret: `gh secret delete NPM_TOKEN`.

## Everything else has a home now

- The publish itself: done. All six packages are on npm with GitHub Releases.
- The two release traps found on the way — the approve endpoint and npm's 404-means-unauthorised
  — are written into `specs/RELEASING.md`.
- The flaky `overhead.test.ts` budget is `specs/known-defects.md` #72, open.
- The PouchDB identity-key corruption is `specs/known-defects.md` #71, fixed.
- The date DDL change not migrating an existing table was already documented, in the last
  section of #70.

## Not in this file: the next release

`CHANGELOG.md` has the pending entry, and the versions are bumped but unpublished:
`@routier/postgres-plugin-core` 0.2.0, `@routier/pglite-plugin` 0.2.0,
`@routier/postgresql-plugin` 0.5.1, `@routier/sqlite-plugin` 0.4.1. Publish order matters —
`postgres-plugin-core` first, because the other three peer on it at `>=0.2.0`.
