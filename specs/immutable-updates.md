# Immutable updates

Status: **Graduated from spike to supported, still opt-in via `.immutable()`.** Runs
alongside proxy change tracking; nothing removed. **Not the default — see the decision
below.**
Date: 2026-08-03

## The graduation decision (2026-08-03)

**Close the gaps first; flip the default later, deliberately, in a major version.**

Flipping `CollectionBase.changeTrackingType` from `"proxy"` to `"immutable"` was tried as a
measurement, not as a change: **133 of 5,549 tests fail**, every one of them an in-place
mutation (`entity.price = 5`) that a frozen read now rejects. So the flip is mechanical but
genuinely breaking, and 2.4% of a suite is a fair proxy for how much caller code it moves.

What settled the sequencing is not that number, though — it is that the immutable path had a
functional hole. Updating a row that had been added but not yet saved **threw**, because
`update()` resolves rows by id and an identity-keyed row has no id until the database assigns
one. Shipping that as the default would have made "add a row, then adjust it before saving"
an error, so the hole had to close first. It now has (below).

What is still open before the flip is defensible: adds and removes still take the proxy path,
and `saveChangesAsync` does not yet return fresh instances. Neither blocks correctness on an
immutable collection today; both change what "the default" means.

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

### Rows that have not been saved yet

A row from `addAsync` has no id to resolve when the key is an identity, so it is tracked by
**object reference** instead — a `WeakMap` from every generation of the row to one slot
holding its current value (`ChangeTracker.unsavedRows`). Patching one rewrites the pending
addition, so an add followed by three patches is still one INSERT carrying the final values.

The slot has three states, and the last two are the ones that matter:

- `pending` — an unsaved addition. A patch rewrites it.
- `saved` — persisted. Later patches route to the ordinary id-based path, but *through the
  slot*, because the assigned identity landed on exactly one generation and the caller may
  be holding a different one. Without that hop a reference taken before the save could never
  be resolved again.
- `discarded` — the save failed, or changes were cleared. Patching it must not put the row
  back into `additions` and insert something the caller was told was gone, so it falls
  through to the "not attached" error.

The result of patching an unsaved row is deliberately **not frozen**, unlike a read. Freezing
is kept off the add path because `mergeChanges` writes the database's assigned identity back
into the entity it just persisted.

This turned up **defect #23**: two rows equal in content, on a schema with an identity key,
collapse into one on save. `UnknownKeyAdditions` keys pending adds by content hash, and that
hash is how `mergeChanges` matches a returned row back to the add it came from — so the fix
is a change to the plugin correlation contract, not to the map. Recorded and pinned against a
plain add, since `update()` is only a second route to it.

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

## What is left

In rough dependency order. 1 and 2 are done; the rest are what "flip the default" means.

1. ~~Freeze query results~~ — done (defect #17). Dropping `enableChangeTracking` / proxy
   installation from codegen is still outstanding, and is the flip itself.
2. ~~Add the unsaved-row `WeakMap` so `update` works before the first save.~~ Done, above.
3. Return fresh instances from `saveChangesAsync` (needed anyway for assigned identities).
4. Route subscriptions and views to push new instances — this is what removes the need for
   callers to hold references at all, and what lets React use referential equality.
5. `strictReferences` dev mode: throw on a stale read at the point it is handed back.
6. Re-measure the read path. Proxy install (`postprocess`, ~0.61µs/entity) and `merge`
   (~0.70µs) are ~45% of a re-read and should largely disappear.
