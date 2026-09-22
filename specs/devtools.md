# Devtools, release 1: the collection browser

## Problem Statement

A developer building on Routier cannot see what their store holds. To check what a collection
contains after a save, a sync, or a cross-tab change, they write throwaway `console.log` calls or
open the backend's own tooling (IndexedDB in the browser, a SQL client), which shows stored bytes
rather than the entities the app sees. Someone evaluating Routier has no window into its behaviour
at all. TanStack Query's and Redux's devtools drove much of their adoption; Routier has none.

## Solution

`@routier/devtools` adds a floating button to the page. It opens a resizable drawer that lists
every collection and view in the store with its row count. Selecting one shows its rows in a paged
table, and selecting a row shows its full value. The drawer updates live as the data changes.

The developer adds one line at startup:

```ts
import { mountRoutierDevtools } from "@routier/devtools";

mountRoutierDevtools(store);
```

It works the same in React, Vue, any other framework, or plain JavaScript. In a production build
the call does nothing and the UI code is dropped from the bundle.

The drawer reads the store through a new public, read-only API, `dataStore.inspect()`, which any
developer can also use to build their own tooling.

This is the first of several devtools releases. Each later release ships on its own (see Later
Releases).

## User Stories

1. As a developer, I want to add devtools with a single function call, so that setup takes seconds.
2. As a developer, I want the same call to work in React, Vue, and plain JavaScript apps, so that I do not need a framework-specific package.
3. As a developer, I want a floating button that opens and closes the drawer, so that devtools stay out of my way until I need them.
4. As a developer, I want to resize the drawer, so that I can balance it against my app.
5. As a developer, I want the drawer's styles isolated from my app, so that neither breaks the other.
6. As a developer, I want to see every collection in my store with its row count, so that I can check what data exists at a glance.
7. As a developer, I want to see views listed separately from collections and labelled as views, so that I know which data is derived.
8. As a developer, I want to open a collection and see its rows in a table, so that I can check what the app actually holds.
9. As a developer, I want large collections paged 50 rows at a time, so that opening one never freezes my app.
10. As a developer, I want to move between pages, so that I can reach any row.
11. As a developer, I want to open a row and see its full value, so that I can inspect nested fields.
12. As a developer, I want the table, the counts, and an open row to update when data changes, so that I can watch saves, syncs, and cross-tab changes land.
13. As a developer, I want a burst of changes to update the drawer smoothly, so that heavy writes do not make the page stutter.
14. As a developer, I want to see values exactly as my app sees them, including decrypted fields, so that devtools show the real state.
15. As a developer, I want dates, big integers, maps, sets, and binary values shown readably, so that they are not rendered as `{}`.
16. As a developer, I want a value that refers to itself shown as `[Circular]`, so that the drawer never crashes on it.
17. As a developer, I want a failed query shown as an error in the drawer, so that I can see the failure without my app breaking.
18. As a developer, I want devtools never to throw into my app, so that adding them carries no risk.
19. As a developer, I want a clear state for a store with no collections and for an empty collection, so that "nothing there" is not confused with "still loading".
20. As a developer, I want the drawer to show that the store was disposed and stop listening, so that it does not leak or show stale data.
21. As a developer with several stores, I want one drawer with a store picker, so that I can inspect each of them.
22. As a developer, I want calling mount twice with the same store to do nothing the second time, so that hot reload and double setup are harmless.
23. As a developer, I want mount to return an unmount function, so that I can remove devtools cleanly.
24. As a developer, I want mount to do nothing on the server or in a Worker, so that shared startup code does not crash.
25. As a developer, I want devtools stripped from my production bundle with no extra code on my side, so that they cost my users nothing.
26. As a developer debugging a live site, I want an explicit production import that always mounts, so that I can opt in knowingly, with a documented warning that every row becomes visible to anyone with access to the page.
27. As a developer, I want devtools to query only while the drawer is open and only the selected collection, so that a remote backend sees as little extra traffic as possible.
28. As a developer, I want devtools' own queries labelled as devtools queries, so that a later timing panel can hide them.
29. As a developer building my own tooling, I want a documented, read-only `inspect()` API on the store, so that I can list collections and read their rows without private access.
30. As a developer, I want `inspect()` to be unable to change the store, so that inspection is always safe.
31. As a developer, I want the devtools docs page and a runnable example, so that I can set it up from the docs alone.

## Edge Decisions

- **Inputs:** dates, `BigInt`, `Map`, `Set`, typed arrays, and binary values render as readable text; self-references render as `[Circular]`.
- **Failure:** a failed count or page query shows an error in the drawer. Every devtools error is caught, logged through the Routier logger, and never rethrown into the app.
- **State:** empty store, empty collection, loading, error, and disposed each have a distinct UI state. On disposal the drawer unsubscribes and shows "store disposed".
- **Concurrency:** change notifications are coalesced into one re-render per animation frame. Only the selected collection's current page and the visible counts are subscribed.
- **Identity and access:** not applicable in development. The production import exposes every row to anyone with access to the page; its docs say so plainly.
- **Compatibility:** `inspect()` is additive. `IDbPlugin`, `DataStore`'s existing members, and every existing export are unchanged. Devtools bundle their own renderer, so they place no requirement on the app's React or Vue version.
- **Scale:** rows load 50 at a time through the existing `skip`/`take`, and counts through `countAsync`. Nothing loads a whole collection.
- **Environments:** mount is a no-op without a `document`. Several stores share one drawer with a store picker.
- **Observability:** devtools failures are logged through the Routier logger. Devtools queries carry a label a later timing panel can filter on. Settled: every query `inspect()` issues carries `source: "Inspection"` (exported as `INSPECTION_SOURCE`) on the existing event `source`, so `IDbPlugin` is unchanged and nothing is deferred.
- **Backend traffic:** accepted within the limits above, and revisited after dogfooding.
- **Sensitive data:** values are shown as the app sees them. Masking arrives with the sensitive-fields feature (FEATURE-IDEAS #11), which devtools will consume; the docs note this.
- **Surfaces:** a new devtools domain in the architecture manifest (its `DOMAIN.md` regenerated from it), a docs page with a sidebar entry, a runnable docs example, and a CHANGELOG entry.
- **Tests:** see Testing Decisions.
- **Scope:** see Out of Scope.

## Implementation Decisions

- **New package `@routier/devtools`**, framework-agnostic, added as a workspace and as its own domain in the architecture manifest. It may import `@routier/core` and `@routier/datastore`, and it reads the store only through its public surface.
- **`DataStore.inspect()`** is a new, purely additive public method. It lives in the datastore package because the collection instances are only reachable from inside `DataStore`. It returns a read-only inspection object; nothing on it can change the store. Proposed shape:

  ```ts
  interface StoreInspection {
      readonly collections: ReadonlyArray<InspectedCollection>;
      readonly disposed: AbortSignal;
  }

  interface InspectedCollection {
      readonly name: string;
      readonly schemaId: SchemaId;
      readonly kind: "collection" | "view";
      count(): Promise<number>;
      keyOf(row: InspectedRow): string;
      watchCount(onCount: (result: InspectedCount) => void): () => void;
      watchPage(page: { skip: number; take: number }, onRows: (result: InspectedPage) => void): () => void;
  }
  ```

  `watchPage` and `watchCount` are built on the existing subscription, `skip`, `take`, and `count` query machinery, and return an unsubscribe function. Rows are frozen copies, so a tool cannot change a tracked entity through them. `keyOf` identifies a row across deliveries, which is how an open row follows its updates. `inspect()` ships in production builds; it is a small API, not UI.
- **`mountRoutierDevtools(store, options?)`** returns an unmount function. It creates one host element with a shadow root and renders the drawer into it. Mounting is idempotent per store; a second store joins the same drawer behind a store picker.
- **Production stripping** follows TanStack's pattern: the main entry exports a no-op when `process.env.NODE_ENV === "production"`, so bundlers drop the UI. `@routier/devtools/production` always exports the real implementation.
- **UI** is written in Preact, bundled inside the package (not a peer dependency), rendered into the shadow root, with its CSS injected into that root.
- **Look:** TanStack-style floating toggle button in a corner, opening a resizable drawer.

## Testing Decisions

A good test drives a public interface and asserts what a user or caller observes, never internal state.

- **Seam 1, `dataStore.inspect()`:** integration tests in the datastore package against the memory plugin. They prove: collections and views are listed with the correct kind; counts are correct; pages honour `skip`/`take`; `watchPage` fires again after a save and stops after unsubscribe; the disposed signal fires on disposal; nothing on the inspection object can mutate the store.
- **Seam 2, `mountRoutierDevtools(store)`:** DOM tests in jsdom that query the shadow root. They prove: the toggle opens and closes the drawer; collections, views, and counts render; paging works; a row's detail renders every special value type and `[Circular]`; a save updates the table; a failing query shows an error and does not throw; empty, disposed, and multi-store states render; a second mount is a no-op; unmount removes everything; mount without a `document` is a no-op; the main entry is a no-op in production mode and the production entry is not.
- **Browser smoke test:** one Playwright test using the existing browser e2e setup: mount, open the drawer, see rows, add a row, see it appear.
- **Mutation testing:** a Stryker config for the new package and the inspection code, following the existing per-package configs.
- **Prior art:** the datastore integration tests, the react package's DOM tests, and the browser e2e runner.

## Out of Scope

- The browser extension.
- Editing data. Permanently out of scope.
- Destructive actions (discarding dead letters, clearing the outbox).
- Every panel other than the collection browser (see Later Releases).
- Masking sensitive values (see FEATURE-IDEAS #11).

## Later Releases

Each ships independently, after release 1, each with its own spec:

1. **Pending changes:** the change tracker's unsaved adds, updates, and removes.
2. **Sync outbox and dead letters:** outbox rows and dead letters, with a retry-dead-letters action.
3. **Live subscriptions and live explain:** active live queries, and how each one runs, reported for its latest run so the report stays bounded. Partly delivered with release 1: `inspect().watchQueries()` and the Queries tab report every query the app runs, live re-runs included, with its explanation. A list of the subscriptions currently open is still to come.
4. **Timeline:** recent operations with per-query timing, hiding devtools' own queries.

## Further Notes

- `FEATURE-IDEAS.md` said devtools are "mostly UI" because `TelemetryDbPlugin` emits the events. The survey found it only reports per-call timing. Each later release needs its own new public read API, which is why each ships separately.
