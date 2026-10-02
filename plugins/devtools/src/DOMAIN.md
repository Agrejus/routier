# Devtools

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Shows a running datastore's collections and rows in an in-page drawer.

## Rules

- Reads the store only through DataStore.inspect(). A panel that needs anything else is a sign inspect() is missing something.
- Never changes the store and never throws into the app. Every failure is caught, shown in the drawer, and logged through the Routier logger.
- The drawer renders inside a shadow root with Preact bundled into the package, so it places no requirement on the app's framework or styles.

## May import

`@routier/core`, `@routier/datastore`

## Covers

- `plugins/devtools/src`
