# Sync server

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Serves a datastore over HTTP so a remote client can read and write it.

## Rules

- The wire format is a transport concern and stays here. It is not part of the data model.

## May import

`@routier/core`, `@routier/datastore`, `@routier/memory-plugin`

## Covers

- `sync-server/src`
