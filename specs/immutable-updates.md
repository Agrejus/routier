# Immutable updates — spike

Status: **Spike landed, additive.** Runs alongside proxy change tracking; nothing removed.
Date: 2026-08-02

## Why

Every change-tracking defect the stress program found was a proxy *lifecycle* bug:

| Defect | Cause | Under patches |
| --- | --- | --- |
| #11 a persisted entity never went clean | tracking flag not reset after a save | no flag exists — pending means "in the map" |
| #12 arrays untracked after the first merge | the array's proxy is lost when the entity is rebuilt | an array is a value a patch replaces; no proxy to lose |
| #13 a depth-2 save throws | delta is a flat dotted-path map, serializer walks the entity shape | the delta **is** a partial entity |

None of the three is expressible on the patch path. That is the argument for this — not
performance.

## The API

```ts
// Patch — the common case.
const updated = store.products.update(product, { price: 99 });

// Updater — arrays, or anything computed from the previous value.
const updated = store.products.update(product, prev => ({
    ...prev,
    tags: [...prev.tags, "sale"],
}));

// Resolve a reference you have held across updates.
const fresh = store.products.current(product);
const ok    = store.products.isCurrent(product);

// Save is unchanged.
await store.saveChangesAsync();
```

`update` returns the new value and does **not** modify what you passed in.

### Arrays and Dates are values

A patch replaces them rather than merging into them. Element-wise array merging would make
"drop the last tag" inexpressible, and that ambiguity is what made in-place array mutation
unreliable under proxies.

## How stale references are handled

`update` reads **only the id** from the entity you pass. The patch is applied to whatever
the collection currently holds.

That is the whole design. It matters because stale *reads* are merely annoying while stale
*writes* lose data — so the write path is the one that gets the guarantee. It also makes
read-modify-write correct, which a stale copy gets wrong:

```ts
store.products.update(p, prev => ({ ...prev, n: prev.n + 1 }));
store.products.update(p, prev => ({ ...prev, n: prev.n + 1 }));
// +2. The updater receives the CURRENT value, not the caller's `p`.
```

Unattached rows throw rather than silently no-op, and a pending patch is dropped when its
row is removed — otherwise replaying it after the delete would reinsert the row, which is
the resurrection half of defect #11.

## Delta shape, and why it is flat at the top

The delta is a partial entity, **flat at the top level**. A nested change looks like
`{ nested: { inner: { value } } }` — one top-level key holding a nested object.

Both consumers require that:

- SQL plugins (`plugins/{sqlite,postgresql,mysql}/src/utils.ts`) read `Object.keys(delta)`
  as **column names** for the SET clause.
- Ephemeral plugins (`core/src/plugins/EphemeralDataPlugin.ts`) ignore the delta and apply
  the whole `entity`.

Nested objects were never storable in a SQL column anyway, so nothing regresses there.

## What the spike proves

`datastore/src/change-tracking/ImmutableUpdates.test.ts` — 11 tests, runs in the default
suite. The first two blocks are the same scenarios that are pinned `it.failing` against the
proxy path as defects #12 and #13. **They pass here with no other change.**

`stress/src/s10-immutable-stale-references.test.ts` — 10,000 generations over 1,000 rows,
every write issued through a first-generation reference that is never refreshed. All
500,000 increments land: none lost to a stale base, none double-counted by a replayed
patch. ~6s.

## What it does not prove

- **No performance claim.** S10 finishes in ~6s against S3's ~84s, but S3 re-queries 1,000
  entities every cycle and S10 never re-reads, so the two are not comparable. The read-path
  win from dropping proxy installation is still an estimate.
- **`removeAsync` and adds still take the proxy path.** Only updates are patched.
- **Identity-keyed rows cannot be updated before their first save.** `getId` has nothing to
  resolve. The eventual fix is the `WeakMap` for unsaved rows that
  `additions`/`canonicalAttachments` already implies, and the spike throws clearly instead.
- **Nothing is frozen yet.** Reads still hand back proxies, so an accidental
  `entity.price = 5` still "works" and takes the old path. Freezing belongs with removing
  the proxies, not before.

## If this graduates

In rough dependency order:

1. Freeze query results and drop `enableChangeTracking` / proxy installation from codegen.
2. Add the unsaved-row `WeakMap` so `update` works before the first save.
3. Return fresh instances from `saveChangesAsync` (needed anyway for assigned identities).
4. Route subscriptions and views to push new instances — this is what removes the need for
   callers to hold references at all, and what lets React use referential equality.
5. `strictReferences` dev mode: throw on a stale read at the point it is handed back.
6. Re-measure the read path. Proxy install (`postprocess`, ~0.61µs/entity) and `merge`
   (~0.70µs) are ~45% of a re-read and should largely disappear.
