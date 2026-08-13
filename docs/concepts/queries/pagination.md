---
title: Pagination
---

# Pagination

Use `take` and `skip` to implement pagination for large datasets.

## Quick Navigation

- [Basic Pagination](#basic-pagination)
- [Simple Take and Skip](#simple-take-and-skip)
- [Pagination with Filtering](#pagination-with-filtering)
- [Pagination with Sorting](#pagination-with-sorting)
- [Reactive Pagination](#reactive-pagination)
- [React 19 Suspense Pagination](#react-19-suspense-pagination)
- [What Changes Trigger](#what-changes-trigger)
- [Related](#related)

## Basic Pagination

Page numbers are usually one-based in the UI. Convert them to an offset with `(page - 1) * pageSize`:

```ts
const page = 2;
const pageSize = 20;

const rows = await dataStore.products
  .sort(product => product._id)
  .skip((page - 1) * pageSize)
  .take(pageSize)
  .toArrayAsync();
```

Always sort before `skip()` and `take()`. Without a stable order, the same row can move between pages even when the underlying data has not changed.

## Simple Take and Skip


<<< @/_snippets/code/from-docs/concepts/queries/pagination/block-1.ts


## Pagination with Filtering

Paginate filtered results:


<<< @/_snippets/code/from-docs/concepts/queries/pagination/block-2.ts


## Pagination with Sorting

Paginate sorted results:


<<< @/_snippets/code/from-docs/concepts/queries/pagination/block-3.ts


## Reactive Pagination

Pagination needs only two pieces of state: `page` and `pageSize`. Include both in `useQuery`'s dependencies so changing either value cleans up the old subscription and executes the newly calculated window.

<<< @/_snippets/code/from-docs/concepts/queries/pagination/reactive-pagination.tsx

The pagination calculation remains one line:

```ts
.skip((page - 1) * pageSize).take(pageSize)
```

There is no separate pagination controller or synchronization layer. React state selects the window, `useQuery` rebuilds it when that state changes, and Routier supplies the current rows.

## React 19 Suspense Pagination

React 19's `use()` can read the Promise returned by Routier's async terminal methods. Put the reader under `<Suspense>` and create a new Promise when `page` or `pageSize` changes:

<<< @/_snippets/code/from-docs/concepts/queries/pagination/suspense-pagination.tsx

The Promise is deliberately created in the parent component's state initializer and event handler. Do not call `toArrayAsync()` directly inside `ProductRows`: every retry would create a different Promise and suspend again. A framework-provided cache or an external request cache is another valid way to provide a stable Promise.

This version is a **one-time read per page request**. It does not use `.subscribe()`, so later database mutations do not refresh the visible page automatically. Use the preceding `useQuery` example when the active page must remain live, and use Suspense when Promise-based loading and a boundary fallback match the desired UI. Rejected query Promises go to the nearest React error boundary, not the Suspense fallback.

## What Changes Trigger

Two kinds of change are involved:

1. **`page` or `pageSize` changes:** these are application-state changes. Because they are in the dependency array, `useQuery` unsubscribes from the previous query and subscribes to the new page.
2. **Stored data changes:** `.subscribe()` keeps the currently selected page live. Adds, updates, or removals that affect its ordered window cause the query to run again and deliver the new page contents.

Changing a captured variable by itself does not modify an already-built query. Outside React, explicitly unsubscribe and create a new subscription when `page` or `pageSize` changes. In React, the dependency array performs that lifecycle for you.

When page size changes, resetting to page 1 usually avoids landing beyond the end of the result set. To display a known final page or disable **Next**, run a separate subscribed `count` query and calculate `Math.ceil(count / pageSize)`.

## Related

- [Filtering Data](/concepts/queries/filtering)
- [Sorting Results](/concepts/queries/sorting)
- [Terminal Methods](/concepts/queries/terminal-methods)
