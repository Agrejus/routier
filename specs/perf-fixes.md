# Performance fixes: implementation spec

This spec lists seven performance work items, ranked by expected return. Each item states the
problem, the evidence, the fix, the risks, and the measurement that proves it. Implement one
item at a time. Do not start the next item until the current one is measured and its tests pass.

The rule that has paid off twice in this repo: **microbenchmark the candidate shapes side by
side BEFORE you edit, then re-measure the real path after.** One plausible candidate
(`values()` instead of destructured Map entries) measured at ~5% and was dropped before any
code changed. See `benchmark/README.md` for a second lesson: a suspected cause
(`Object.defineProperty` in the proxy set trap) was measured and cleared. Do not re-investigate it.

All line numbers below were verified on branch `0.3.0` on 2026-08-12. Re-verify before editing.

---

## Campaign total: where this started and where it ended

Both rounds — v1 (Fixes 1–3, new items A–C) and v2 (items D, F, H) — landed in one commit on
branch `0.3.0`. Everything below is `b2d1f7b` ("Fix the distinct flag") versus that commit.

Method: the CURRENT benchmark harness run against BOTH source trees, so the measurement is
identical on each side and only the library changes. Interleaved A/B, 4 cycles
(before/after/before/after), medians of 4 per arm. Machine: darwin arm64, Node v22.22.0.

| scenario | before (`b2d1f7b`) | after | change | speedup |
|---|---|---|---|---|
| `renamed-filtered-query-10000` | 21.599ms | 7.790ms | **−63.9%** | **2.77x** |
| `renamed-full-scan-10000` | 26.206ms | 11.873ms | **−54.7%** | **2.21x** |
| `count-10000` | 0.732ms | 0.510ms | **−30.3%** | 1.43x |
| `filtered-query-10000` | 6.593ms | 5.185ms | **−21.4%** | 1.27x |
| `full-scan-10000` | 12.989ms | 11.524ms | **−11.3%** | 1.13x |
| `update-1000` | 3.130ms | 2.997ms | −4.3% | 1.04x |
| `insert-1000` | 4.605ms | 4.558ms | −1.0% | 1.01x |
| `diff-update-1000` | 1.767ms | 1.751ms | −0.9% | 1.01x |
| `point-lookup-10000` | 0.022ms | 0.022ms | +0.0% | 1.00x |

Sum of the nine scenarios above: **77.6ms → 46.2ms, −40.5% (1.68x)**. That sum is a rough
shape-of-the-work number, not a user-facing figure — it weights scenarios by how long they
happen to take, not by how often anyone runs them.

`diff-clean-sweep-10000`, `parse-simple-filter`, `parse-complex-filter` and `compile-schema` are
omitted: they sit under the measured noise floor (see the null-A/B table under item H).

**The read path is where this campaign paid.** Renamed schemas roughly halved, and they were the
worst case by far — they used to cost about double an unrenamed read and now land within ~13% of
one. The unrenamed reads improved 11–30%.

**The write path barely moved, and that is a DEFAULT, not a ceiling.** Fix 1's guard only fires
when `crossTabSync: false`, which is off by default for backward compatibility, and the benchmark
constructs its stores with the default. Measured on the shipped code, 7 interleaved cycles, the
same stores with `crossTabSync: false`:

| scenario | default (`true`) | `crossTabSync: false` | change |
|---|---|---|---|
| `diff-update-1000` | 1.752ms | 1.418ms | **−19.1%** |
| `insert-1000` | 4.354ms | 3.902ms | **−10.4%** |
| `update-1000` | 2.955ms | 2.771ms | **−6.2%** |

So an app that does not use cross-tab live queries gets a further 6–19% on writes for one flag.
Caveat on that table: `renamed-filtered-query-10000` read +16.3% in the same sample, and a
write-path flag cannot affect it — that side of the sample is not trustworthy, and the write
numbers above are the part that held steady across all 7 cycles.

---

## Part 1: Environment setup

Work through this section first. Every trap below has burned a session in this repo.

### 1.1 Native bindings

`npm install` in this repo can silently delete the platform binaries for rspack and rollup
(npm/cli#4828). The build then fails with "Cannot find native binding". Restore both in one
command — separate installs undo each other — and pin the rspack binding to the exact
`@rspack/core` version:

```bash
V=$(node -p "require('./node_modules/@rspack/core/package.json').version")
npm install --no-save --ignore-scripts @rspack/binding-darwin-arm64@$V @rollup/rollup-darwin-arm64
```

Verify before you trust any build failure:

```bash
node -e 'require("@rspack/core");require("rollup")'
```

Keep `--ignore-scripts` on full installs — leveldown's native build fails without it. If test
suites then fail with "Could not locate the bindings file", run `npm rebuild sqlite3`.

### 1.2 Build order

Package dists BUNDLE core source. After you edit `core/`, rebuild `core`, then `datastore`,
then `plugins/memory` — or your change is invisible to the benchmark. A stale `dist/` hides
the problem. When in doubt, delete the `dist/` folders you depend on and rebuild.

Related trap: bundling duplicates classes across packages, so `instanceof` fails cross-package.
Use the type-guard helpers in `core/src/assertions` instead.

### 1.3 Test baseline

Some jest suites fail on a clean checkout (27 suites / 8 tests at last count). Record the
failing set BEFORE you change anything:

```bash
npx jest 2>&1 | tail -30 > /tmp/jest-before.txt
```

Acceptance for every fix: the failing set after your change is identical to the set before it.

---

## Part 2: Measurement protocol

### 2.1 The regression harness

```bash
npm run benchmark          # from repo root; compares against recorded baselines, fails on >15% regression
npm run benchmark:update   # re-records baselines from this run
```

Scenarios (see `benchmark/src/run.ts`): `insert-1000`, `update-1000`, `full-scan-10000`,
`filtered-query-10000`, `point-lookup-10000`, `count-10000`, `diff-update-1000`,
`diff-clean-sweep-10000`, `parse-simple-filter`, `parse-complex-filter`, `compile-schema`.
All run against `MemoryPlugin` with warmup and a median over repeated iterations.

Rules, from `benchmark/README.md`:

1. A single run is not evidence. Run 3–5 times and compare medians.
2. Baselines are machine-specific. Record your own baseline on your machine before the first edit.
3. Run the same commit twice before you compare two commits. Run-to-run spread reaches 15% on
   a busy machine.
4. Close Docker and parallel test runs while measuring.

### 2.2 Per-fix procedure

For each fix:

1. Record the baseline: `npm run benchmark:update` on the unmodified tree; commit nothing yet.
2. Microbenchmark the candidate shapes in isolation (standalone `node` script; warmup loop, then
   `process.hrtime.bigint()` around 1M+ iterations). If the isolated win is under ~2x on the
   micro-op, expect little on the real path — reconsider.
3. Apply the fix. Rebuild core → datastore → plugins/memory (section 1.2).
4. Run `npm run benchmark` 5 times. Compare medians per scenario against the baseline.
5. Run the full jest suite. Compare failures against `/tmp/jest-before.txt`.
6. Record the numbers (before median, after median, scenario names, machine, Node version) in
   the PR description or in this file under the fix's "Result" heading.

If the real-path numbers do not improve, REVERT the fix. Keeping unmeasurable "optimizations"
is how this codebase accumulated a diffuse 20% regression across twenty commits
(`benchmark/README.md`, baseline history).

### 2.3 Profiling tools for the investigation items

- CPU profile: `node --cpu-prof <script>`, open the `.cpuprofile` in Chrome DevTools.
- Deopt and inline-cache state: `node --trace-deopt --trace-ic <script>`, or `v8-deopt-viewer`.
- Hidden-class checks: `node --allow-natives-syntax` and `%HasFastProperties(obj)`.
- Memory retention (stress suite): run with `NODE_OPTIONS=--expose-gc`. Without the flag the
  memory assertions SKIP and a pass is not evidence.
- The stress suite (`npm run test:stress`) exercises larger entity counts than the benchmark;
  use it for fixes whose cost scales with attached-entity count.

### 2.4 A known open target

`update-1000` regressed from 1.92ms to ~2.26ms cumulatively across ~20 commits, cause never
isolated (see `benchmark/README.md`). Fixes 1 and 2 below both remove per-save and per-entity
work on the write path, so they are the most likely to claw this back. Track `update-1000`
and `diff-update-1000` on every fix.

---

## Part 3: The fixes

### Fix 1 — Skip broadcast preprocessing when nobody listens

**Priority: 1 (highest measured win per line of code changed).**

**Problem.** `SchemaSubscription.send` in `core/src/schema/communication/broadcast.ts`
(~line 187) runs `schema.preprocess` over every add, update, removal, and unknown on EVERY
`saveChanges`, then posts to the channel — even when zero subscribers exist. Measured cost
when it was stubbed out: ~20% of write time, ~29% of update time.

**Evidence.** The `send` body allocates four arrays and preprocesses every entity
unconditionally. The call site (`datastore/src/collections/CollectionBase.ts:233`) guards only
on "changes exist", not on "listeners exist". The channel registry already counts local
subscribers (`broadcast.ts` ~lines 52–66: `retain()` increments, `release()` decrements).

**Fix.**

1. Expose the local subscriber count from the channel registry to `SchemaSubscription`.
2. In `send`, return before preprocessing when the count is zero and cross-tab delivery is not
   required (see the design decision below).
3. Do not change the call site — the guard belongs in `send`, so `View.ts:285` and any future
   caller get it for free.

**Design decision the implementer must make (or escalate).** A local counter cannot see
listeners in OTHER tabs or processes. BroadcastChannel delivery to another tab is a real
feature (live queries across tabs). Options:

- **A (recommended):** add a datastore-level option `crossTabSync: boolean`, default `true`
  for backward compatibility. When `false`, guard purely on the local count. Apps that do not
  use cross-tab live queries opt in to the ~20% write win with one flag.
- **B:** environment heuristic — in Node (no second tab in the common case) guard on the local
  count by default; in the browser always send. Weaker: Node multi-process BroadcastChannel
  users exist.

Document whichever option ships in `docs/` (live-queries guide and state-management guide).

**Risks.** Live views and cross-tab sync silently stop updating if the guard is wrong. The
regression is invisible to the benchmark — it shows up as a broken feature, not a slow one.

**Measure.** `update-1000`, `diff-update-1000`, `insert-1000` (benchmark), plus the stress
write scenarios. Expect double-digit percent on updates when the guard engages.

**Correctness gate.** All subscription/view/live-query jest suites, plus a manual two-tab
check of a live query in the browser with the flag in both positions.

**Result — 2026-08-12, shipped. Option A.**

Machine: darwin arm64, Node v22.22.0. Medians of 14 benchmark runs per configuration (5 for the
baseline and the ceiling probe), MemoryPlugin.

Two corrections to the analysis above, both found during implementation:

1. **The subscriber count named in "Evidence" is the wrong counter.** `retain()` runs in the
   `SchemaSubscription` constructor, and `DataStore` builds one subscription per collection up
   front purely to send from (`DataStore.ts:126` and `:179`). `subscribers` is therefore never
   zero and a guard on it would never fire. The guard counts registered `onMessage` callbacks
   instead — `SchemaChannelReceiver.subscriptions.length`, exposed as `listenerCount`. Only a
   live query registers one, via `DataBridge.subscribe`. A regression test pins this.
2. **The ~20%/~29% figures were optimistic.** Stubbing `send` to a bare `return` — the true
   ceiling — gives −18.2% on `diff-update-1000` and −10.2% on `insert-1000`, not ~20%/~29%.

| scenario | baseline | default (`true`) | `crossTabSync: false` | ceiling | win |
|---|---|---|---|---|---|
| `diff-update-1000` | 1.641ms | 1.651ms | 1.363ms | 1.343ms | **−17.0%** |
| `insert-1000` | 4.190ms | 4.124ms | 3.756ms | 3.745ms | **−10.3%** |
| `full-scan-10000` | 12.817ms | 12.812ms | 12.090ms | 11.794ms | −5.7% |
| `diff-clean-sweep-10000` | 1.350ms | 1.271ms | 1.288ms | 1.283ms | −4.6% |
| `update-1000` | 2.902ms | 2.894ms | 2.812ms | 2.686ms | −3.1% |
| `filtered-query-10000` | 6.453ms | 6.207ms | 6.237ms | 6.202ms | −3.3% |

The guard captures the whole ceiling on `insert-1000` (−10.3% of −10.2%) and nearly all of it on
`diff-update-1000` (−17.0% of −18.2%), which is what confirms the mechanism. `update-1000` shows
only −3.1% against a −7.4% ceiling; the ceiling figure there rests on 5 runs and is the less
reliable number of the two. Read scenarios move a little because the dropped allocations reduce GC
pressure across the whole run.

**No regression at the default** — the `default` column tracks the baseline within run-to-run
spread, which is the property that matters for backward compatibility.

Guard engagement was verified directly rather than inferred: instrumenting `send` through a real
`DataStore` shows 2 of 2 sends skipped with the flag off and 0 of 2 with it on. An earlier attempt
to verify by monkey-patching `schema.preprocess` was invalid — `createSubscription` closes over the
internal `result` object, not the spread copy that `compile()` returns.

Tests: 210 suites passed, 0 failed — identical to the pre-change baseline, +6 new. Note that the
"27 suites / 8 tests" failing baseline in section 1.3 did not reproduce; this checkout is clean, so
the acceptance bar used here was zero failures.

`benchmark/baselines/baselines.json` was deliberately left unchanged — the recorded numbers are
machine-specific and this machine is slower than the one that set them.

### Fix 2 — Remove `delete` from entity and change-bag hot paths

**Priority: 2 (measured today; small diff; touches the hottest paths).**

**Problem.** `delete obj.prop` transitions the object to V8 dictionary mode. The object never
returns to fast properties. Every later property read on it — filters, selectors, merge,
hash — pays a dictionary lookup.

**Evidence.** Verified 2026-08-12 with `%HasFastProperties`: after `delete entity.__tracking__`
the entity reports dictionary mode, and 5M property reads measure 24.4ms vs 17.7ms (~38%
slower). Sites, all in `core/src/schema/SchemaDefinition.ts`:

| Line | Site | Path it poisons |
|------|------|-----------------|
| 106–107 | `delete changes[ORIGINAL_ENTITY_KEY][...]` / `delete changes[CHANGES_ENTITY_KEY][...]` on revert-to-original | the change bag read by every later `set` and by hasChanges |
| 412 | generated code: `delete entity.__tracking__` | the entity itself, on the untracked-clone path |
| 446 | generated enricher: `delete enriched.__tracking__` | EVERY entity that passes through `enrich` when change tracking is not `immutable` — this is the read/hydrate path |
| 486 | generated merge: `delete destination.__tracking__` | merged entities |

Line 446 is the suspected large one: it runs per entity on reads, and ~55% of the 50k-entity
re-read path is still unattributed (see Fix 6).

**Fix.** Two stages; ship stage 1, measure, then decide on stage 2.

Stage 1 — same shape, no delete:

1. Replace each `delete x.__tracking__` with `x.__tracking__ = undefined`.
2. Replace the two change-bag deletes with `= undefined`.
3. Audit every consumer of these objects for existence checks that distinguish "absent" from
   "undefined": `in` operator, `hasOwnProperty`, `Object.keys(...)`/`for...in` iteration, and
   spread-into-persist. `Object.keys` still returns a key assigned `undefined`, so any
   key-iteration consumer (hasChanges counting, change enumeration, serialization strip) must
   either filter `undefined` values or maintain an explicit count. Find consumers with:
   `grep -rn "ORIGINAL_ENTITY_KEY\|CHANGES_ENTITY_KEY\|__tracking__" core/src datastore/src --include="*.ts" | grep -v test`
4. Check that `__tracking__` cannot reach persistence or the wire: confirm the strip/serialize
   codegen excludes it by name, not by absence.

Stage 2 — side table (bigger, cleaner): move tracking state to a module-level
`WeakMap<entity, TrackingState>`. Entity shapes are then never mutated, `__tracking__` cannot
leak anywhere, and the attach-time cache from the 2026-08-02 fix becomes the only access
pattern. Only do this if stage 1 measures well and the audit in step 3 found fragile consumers.

**Risks.** Stage 1: an `in`/`hasOwnProperty` check somewhere treats `undefined` as present —
the audit in step 3 exists to catch exactly this. Stage 2: WeakMap `get` costs more than a
property read; keep the attachment-record cache so per-entity loops do not call `get`.

**Measure.**

1. Before/after micro-check: `node --allow-natives-syntax`, assert `%HasFastProperties(entity)`
   is true after a full attach → modify → save → re-read cycle.
2. Benchmark: `full-scan-10000`, `filtered-query-10000`, `update-1000`, `diff-update-1000`.
3. The 50k re-read stress scenario — this is where a read-path win shows.

**Result — 2026-08-12, stage 1 shipped, but only ONE of the four sites.**

Machine: darwin arm64, Node v22.22.0. Medians of 14 benchmark runs per variant.

| scenario | before | after | change |
|---|---|---|---|
| `filtered-query-10000` | 6.207ms | 5.168ms | **−16.7%** |
| `full-scan-10000` | 12.812ms | 10.887ms | **−15.0%** |
| `update-1000` | 2.894ms | 2.892ms | −0.1% |
| `diff-update-1000` | 1.651ms | 1.665ms | +0.8% |
| `insert-1000` | 4.124ms | 4.199ms | +1.8% |

Only line 446, the enricher, was changed. The other three sites were measured and left as `delete`.
Four findings, each of which contradicts part of the analysis above:

1. **`delete` of an ABSENT property does not deopt.** Verified with `%HasFastProperties`: only
   `defineProperty` followed by `delete` drops to dictionary mode. `enriched` is a fresh object
   literal built from schema properties, so `__tracking__` is only ever installed in the PROXY
   branch — diff and readonly mode were deleting a property that was never there, which is a
   no-op. Line 446 therefore cost nothing outside proxy mode, not "EVERY entity that passes
   through enrich when change tracking is not immutable".
2. **The removal condition had to narrow from `!== "immutable"` to `=== "proxy"`.** Under `delete`
   the wider condition was harmless for the reason above. Under assignment it would CREATE an
   enumerable `__tracking__` on every diff- and readonly-tracked entity and leak it into
   persistence. The narrowed condition covers exactly the entities that have the property.
3. **On a proxied entity, `x.__tracking__ = undefined` is silently swallowed.** The change
   tracker's set trap answers writes to `__tracking__` with a bare `return true`. Assignment at
   the merge site (line 486) therefore left the `{}` bootstrap in place, and the next write read
   `changes.changes` off it and threw. `delete` is unaffected because the handler declares no
   deleteProperty trap. Any future work here must use `Object.defineProperty(obj, "__tracking__",
   { value: undefined, ... })`, which does reach through the proxy — verified.
4. **Converting the two write-path sites made writes SLOWER.** With lines 412 and 486 also
   converted (to defineProperty, per finding 3), `update-1000` regressed +4.2% and the read wins
   were smaller: `filtered-query-10000` −3.8% instead of −16.7%, `full-scan-10000` −9.3% instead
   of −15.0%. `defineProperty` per merged entity costs more than the dictionary-mode penalty it
   avoids. Both were reverted to `delete`.

The two change-bag deletes (lines 106–107) were deliberately NOT converted. `isDirty` is computed
as `Object.keys(original).length > 0`, and a key assigned `undefined` is still a key. Filtering on
defined values does not fix it either: an original value of `undefined` is legitimate — a property
that was unset and then given a value — so a defined-value count reports a genuinely dirty entity
as clean. Removing the key is the only representation under which "present" and "changed" stay the
same question. The cost is bounded anyway: these bags hold one key per changed path, they are
internal to the tracking record, and the branch only runs when a value is set BACK to its original.
An explicit counter on the tracking record would work but needs a field added at four creation
sites and has its own double-count edge case where a property is set to literal `null`.

Stage 2 (WeakMap side table) is NOT justified by this result. The audit in step 3 found no fragile
consumers — every reader uses `== null` or `?.`, and `Object.keys`, `JSON.stringify` and spread all
still exclude the property because assignment preserves the non-enumerable descriptor. What it did
find is that `hasOwnProperty("__tracking__")` and `"__tracking__" in entity` now answer `true` where
the property used to be absent. Nothing in the repository asks either question, but it is a real
semantic change and belongs in the release notes.

Tests: 210 suites passed, 0 failed — identical to the pre-change baseline.

### Fix 3 — Replace the `structuredClone` fallback for renamed properties

**Priority: 3.**

**Problem.** `EphemeralDataPlugin.recordCloner` (`core/src/plugins/EphemeralDataPlugin.ts:358`)
returns `structuredClone` whenever the schema has renamed properties, because the generated
`schema.clone` reads in-memory names while stored records use storage (`from`) names.
`structuredClone` is roughly an order of magnitude slower than the generated cloner, and this
penalty applies to EVERY read of EVERY schema that uses property mapping.

**Evidence.** Read the comment block at `EphemeralDataPlugin.ts:351–358`. The generated-clone
infrastructure exists (`core/src/codegen/handlers/clone/`); it is only shape-blind.

**Fix.**

1. Add a storage-shape cloner to the clone codegen: same handler tree, but emit property reads
   and writes with the `from` name when `PropertyInfo` carries one.
2. Cache it on the schema next to `schema.clone` (e.g. `schema.cloneStorage`), generated
   lazily on first use so schemas without renames pay nothing.
3. Point `recordCloner` at it and delete the `structuredClone` branch.
4. Check the two `structuredClone` call sites in `core/src/plugins/CacheDbPlugin.ts` (lines
   121, 164). If the cached value is in storage shape, the same generated cloner applies. If
   it is in memory shape, `schema.clone` already applies. Either way the `structuredClone`
   should go.
5. Leave the per-element `structuredClone` in `CloneArrayHandler`/`SerializeArrayHandler`
   alone — the comments there document why the array path is different.

**Risks.** The generated cloner must match `structuredClone` semantics for the types schemas
allow: Date, nested objects, arrays. Write a property-based test that round-trips a schema
with renames through both cloners and asserts deep equality.

**Measure.** Add a benchmark scenario with a renamed-property schema (none of the current
scenarios exercise the fallback — `productSchema` in `benchmark/src/run.ts` has no renames).
Then `full-scan-10000` and `filtered-query-10000` on that schema, before and after.

**Result — 2026-08-12, shipped.**

Machine: darwin arm64, Node v22.22.0. Medians of 7 runs (before) and 9 runs (after). Two scenarios
were added — `renamed-full-scan-10000` and `renamed-filtered-query-10000`, on a schema where every
non-key property has a `from` name.

| scenario | `structuredClone` | generated | change |
|---|---|---|---|
| `renamed-filtered-query-10000` | 18.343ms | 7.594ms | **−58.6%** |
| `renamed-full-scan-10000` | 22.912ms | 12.546ms | **−45.2%** |
| `full-scan-10000` (unrenamed control) | 11.143ms | 11.092ms | −0.5% |
| `filtered-query-10000` (control) | 5.127ms | 5.137ms | +0.2% |

Renamed reads now land within ~13% of the equivalent unrenamed read, where they used to cost about
double. Isolated, the generated cloner is **78x** faster than `structuredClone` (11ns vs 885ns per
record on a five-property schema).

`schema.cloneStorage` is generated on first use from the same handler chain as `clone`, with
`useFromPropertyName` threaded through `CloneValueHandler`, `CloneDateHandler` and
`CloneArrayHandler`. Schemas never read in storage shape never build it.

**Two things this fix nearly broke, both worth knowing before touching it again.**

1. **`ConcurrencyDbPlugin` depends on the `structuredClone` fallback and says so.** It appends a
   synthetic `__version` property carrying `from: '__version'` for the express purpose of making
   `hasRenamedProperties` true, so reads take the structural-copy path and its hidden column
   survives to be observed. A generated cloner copies only DECLARED properties, so the first
   version of this fix dropped the token, every read looked unversioned, and optimistic concurrency
   stopped detecting conflicts — 8 tests across `OptimisticConcurrency.test.ts` and
   `wrapperStacking.test.ts`. `cloneStorage` therefore carries undeclared columns across, which is
   what `structuredClone` did. A regression test in `cloneStorage.test.ts` pins it.
2. **Seeding the copy with `{ ...entity }` shares nested objects with the source.** The child
   handlers then write their copies INTO the source's nested object — a "clone" that mutates what
   it was copying. Only undeclared top-level columns are carried across; every declared property is
   left to the generated deep-copy code. Undeclared columns are still copied shallowly, which is a
   real (narrow) difference from `structuredClone`: they are hidden plugin bookkeeping such as
   version numbers, not caller data.

**Step 4 of the plan does not apply — the `CacheDbPlugin` calls must stay `structuredClone`.**
Neither generated cloner can copy what that cache holds. `CacheEntry.value` is a query RESULT, which
may be an arbitrary projection or a scalar aggregate rather than a schema-shaped row — the code's own
comment at the `store` call notes a projection "can carry anything a caller's `.map()` returned,
including a function". A schema-keyed cloner has no shape to work from there.

Tests: 211 suites passed, 0 failed (210 baseline plus the new `cloneStorage` suite).

`benchmark/baselines/baselines.json` has no entries for the two new scenarios. Run
`npm run benchmark:update` on the machine that owns the baselines to record them.

### Fix 4 — Index-aware filtering in the ephemeral store

**Priority: 4 (largest architectural item; biggest win at scale).**

**Problem.** `schema.getIndexes()` exists (`core/src/schema/SchemaDefinition.ts:776`) and no
query path consumes it. A `where` on an indexed, non-key field scans the full collection. Only
key equality has a fast path (`EphemeralDataPlugin.ts:388`, added 2026-07-31: a leading
key-equality filter pins the lookup to O(1)).

**Fix sketch.** Model on the existing key fast path:

1. Maintain `Map<indexedValue, Set<key>>` per single-field index inside the ephemeral store.
   Update the maps on add/update/remove — this adds write cost; measuring it is part of the job.
2. In the query path, extend the parsed-expression inspection that today recognizes key
   equality to also recognize equality on an indexed field, and intersect from the index map
   instead of scanning.
3. Composite indexes and range predicates are OUT of scope for the first pass. Equality on a
   single indexed field covers the common case and bounds the risk.

**Risks.** Index maintenance bugs surface as stale query results, not errors. The contract
tests must run against a plugin with indexes defined. Write-path overhead can eat the read
win for write-heavy workloads — this is why the measurement below runs both directions.

**Measure.** `filtered-query-10000` with the filter on an indexed field (add the index to the
benchmark schema), AND `insert-1000`/`update-1000` to price the maintenance. Accept only if
reads improve at least 5x on the indexed filter and writes regress under 5%.

### Fix 5 — Allocation and GC reduction (profile-first investigation)

**Priority: 5. Do not start before Fixes 1–3 are in, because they change the profile.**

**Problem.** GC was ~40% of CPU in both read and write profiles (measured 2026-07/08). Known
allocation sources: clone-everything on reads, four fresh arrays per `send` (Fix 1 removes the
empty-subscriber case), per-save `SubscriptionChanges` objects, intermediate arrays in the
queryable pipeline.

**Procedure.**

1. `node --cpu-prof` the 50k re-read and the 1,000-update save from the stress suite.
2. Confirm the GC share after Fixes 1–3. If it dropped below ~20%, stop here — the remaining
   items will not pay.
3. Otherwise attack the top allocator only. Candidates, in order of likely payoff:
   copy-on-write instead of eager clone on reads (clone only entities the caller attaches or
   mutates); reuse of the queryable pipeline's intermediate arrays; projection reads that
   clone only selected fields.
4. One candidate per PR, measured per the protocol.

**Note.** `Array.from({ length: n })` (used in broadcast preprocess) creates a packed array —
keep it. Do not "optimize" to `new Array(n)`, which creates a holey array and is slower to
read from.

**Result — 2026-08-12. STOP. The step-2 exit condition is met; do not do this work.**

Profiled after Fixes 1–3, sampling at 100µs with the profiler started around the measured section
only (so seeding is excluded), median machine state, darwin arm64 / Node v22.22.0.

| profile | GC share |
|---|---|
| 50k re-read | **11.6%** |
| 1,000-update save | **2.5%** |
| 1,000-insert save | **3.9%** |

GC was ~40% of CPU when this item was written. It is now 11.6% on the read path and under 4% on
both write paths — comfortably under the "~20%, stop here" bar in step 2. None of the candidates in
step 3 (copy-on-write reads, pipeline array reuse, projection-only clones) will pay for themselves
against a 2.5% GC share on writes, and on reads the allocation is dominated by work that Fix 7
removes outright rather than work that could be pooled.

Reopen this only if a future profile puts GC back over 20%.

### Fix 6 — Decompose the unattributed 55% of the read path

**Priority: run alongside Fix 2, since line 446 is a suspect.**

**Problem.** Of a 146ms re-read of 50k entities (measured 2026-08-02): postprocess ~30ms,
merge ~35ms, and the remaining ~80ms (plugin query + queryable pipeline) was never broken
down.

**Procedure.**

1. `node --cpu-prof` the re-read scenario; attribute the 80ms to functions.
2. Warning from the prior session: an untracked projection read (`.map(...)`) is NOT a valid
   control — the projection runs its own per-entity selector and allocates, so it measures no
   faster. Compare profiles, not alternative queries.
3. File whatever you find as new items in this spec with measurements attached.

**Result — 2026-08-12. The read path is decomposed; the answer is the change tracker, not the query.**

Profiled as described under Fix 5. The re-read now costs 69.4ms per 50k entities on this machine
(the 146ms in the problem statement was a different machine and predates Fixes 1–3, so treat the
SHARES below as the finding, not the absolute).

Self time, 50k re-read:

| share | frame | what it is |
|---|---|---|
| 23.2% | `(anonymous)` generated | generated schema functions, called from `ChangeTracker.resolve` |
| 18.2% | `get` generated | **the Proxy get trap** |
| 14.5% | `pause` generated | the merge pause/unpause bootstrap, per entity |
| 13.1% | `TranslatedArrayValue.forEach` | the result-walking loop |
| 11.6% | GC | |
| 4.9% | `TagCollection.set` | |
| 4.5% | `ChangeTracker.resolve` | |

The dominant chain is one stack, and it is not the plugin query at all:

```
attachResults -> TranslatedArrayValue.forEach -> QueryableExecutor
             -> ChangeTracker.resolve -> generated pause / get / merge
```

So the "unattributed 80ms" is **attach**: resolving each read row into the change tracker, which
per entity runs the generated merge, pauses and unpauses tracking, and reads through the Proxy.
The plugin query and the queryable pipeline are NOT where the time goes — `EphemeralDataPlugin`
and `MemoryDataCollection.load` together account for about 4%.

Two consequences worth acting on:

1. **The Proxy get trap is now measurable on every path**: 18.2% of the re-read, 14.7% of the
   1,000-update save, 8.5% of the 1,000-insert save. This is the strongest evidence yet for Fix 7,
   and it is direct rather than extrapolated from a microbenchmark.
2. **`pause`/`unpause` costs 15.9% of the read path** (14.5% pause + 1.5% unpause) to install and
   remove a bootstrap that exists only to stop the merge's own writes from being recorded. Fix 7's
   accessor design, or any move of tracking state off the entity, removes the reason for it.

### New item A — `stripPreviousValues` is 5.0% of a 1,000-update save

`datastore/src/DataStore.ts:33` calls `delete update.previous` per update. Self time is 5.0% of the
save. The doc comment justifies `delete` over `= undefined` so that "a plugin that serializes the
update — the HTTP family does — emits nothing at all for it". `JSON.stringify` already omits
undefined-valued properties, and both in-repo readers (`fullTextSearch.ts:370` and `audit.ts:189`)
use `!= null`/`== null`, so they are undefined-safe.

Before changing it, confirm no serializing plugin reaches the property through `Object.keys`,
spread, or a form/multipart encoder, which DO see a key assigned undefined. Note the Fix 2 warning:
converting a `delete` on a WRITE path made things worse once already, so measure `update-1000` and
`diff-update-1000` rather than assuming.

**Resolved 2026-08-13 — DROPPED. Do not retry without new evidence.**

Three reasons, in order of how decisive they are.

1. **The 5.0% was mis-attributed, by me.** That figure is `stripPreviousValues`' whole self time —
   the loop over every schema and update, and the `!= null` guard, as well as the `delete`. The
   `delete` is some unknown fraction of it, and the measurement below suggests a small one.
2. **No reliable win.** Converting to `= undefined` and measuring 9 runs against a `delete` control
   taken immediately afterwards gave contradictory results: `update-1000` +8.0% (worse),
   `diff-update-1000` −9.6% (better), everything else flat. The control itself moved 2.885ms →
   3.101ms between sessions with NO code change, so run-to-run spread had grown to ~7% — larger
   than the effect. Nothing here clears the bar.
3. **It would weaken a plugin-contract guarantee.** `previousValues.test.ts:187` asserts
   `'previous' in update === false` for what the plugin receives. `= undefined` leaves the key
   present. The wire path is safe either way — `wire/persist.ts:44` names its fields explicitly and
   `HttpDbPlugin` uses `JSON.stringify`, which omits undefined — but `IDbPlugin` is public, and a
   third-party plugin building a payload from `Object.keys(update)` or a form encoder would start
   emitting a `previous` key. Not worth it for an unmeasurable gain.

If the delete ever does need to go, the shape that keeps the guarantee is to build the plugin-facing
update objects WITHOUT `previous` rather than deleting it afterwards — at the cost of an allocation
per update, and of checking that nothing depends on the update object's identity across the strip.

### New item B — `UnknownKeyAdditions` is 13.5% of a 1,000-insert save

`take` (6.8%) plus `set` (6.7%) in
`datastore/src/change-tracking/additions/UnknownKeyAdditions.ts`, on the insert path only. Nothing
in this spec has looked at it. Worth a read before Fix 4, since `insert-1000` is the scenario Fix 4
must not regress.

**Investigated 2026-08-13 — largely inherent. One redundancy fixed; the obvious optimization is
UNSAFE and must not be attempted.**

What the cost is. `set` (at add time) and `take` (when the plugin's returned rows are paired back)
each compute `schema.hash(entity, HashType.Object)` and use it as a Map key — two per inserted
entity. Measured in isolation on a five-property schema:

| operation | cost |
|---|---|
| `schema.hash(entity, Object)` | 32ns |
| `map.get(precomputed hash)` | 4ns |
| `hash` + `map.get` — what `take` does | 39ns |

So **82% of `take` is building the key**, not the lookup. The two hashes are unavoidable by design:
`set` hashes the pending row and `take` hashes the row the plugin RETURNED, which are different
objects — pairing them by content is the entire purpose.

**Do not make the hash lossy.** `schema.hash(entity, HashType.Object)` is not a digest; it is a
concatenation of the hashed property values (`"product-123tools42true"`), so it cannot collide for
distinct content. Replacing it with a numeric digest would make it cheaper to build AND cheaper as a
Map key — and would reintroduce defect #23, where two pending rows collapsed into one bucket and a
row was never inserted at all. Here a collision pairs a returned row with the wrong pending row, or
silently drops an insert. The same function backs diff-mode change detection, where a collision
means a modified entity looks unchanged.

Also checked and correct as-is: the class is only selected when `schema.hasIdentityKeys === true`
(`ChangeTracker.ts:158`), so content pairing is used only when there IS no key to pair on.
`KnownKeyAdditions` already handles the rest — no mis-routing to reclaim.

Fixed: `replace()` computed `hash(existing)` twice, once for the lookup and once for the delete.
Hoisted to a single call — strictly less work, identical semantics, nothing between the two uses
mutates `existing`. Not measured on its own; `replace` is the patch-a-pending-add path and did not
appear in the profile's top frames, so the change is justified by being unambiguously less work
rather than by a benchmark delta.

What remains would need a plugin-contract change — pairing returned rows positionally instead of by
content — which is exactly the kind of assumption defect #23 came from. Not recommended.

### New item C — `postMessage` is 8.1% of an update save at the DEFAULT setting

`node:internal/worker/io postMessage`, called from `broadcast.ts send`. This is the BroadcastChannel
hand-off itself, downstream of the preprocessing Fix 1 already guards. `crossTabSync: false` skips
it along with everything else, which is part of why that flag measures at −18% on
`diff-update-1000`. It is listed here so nobody profiles the default configuration and reports it
as a new problem: it is the known cost of cross-tab delivery, and it already has an off switch.

**Resolved 2026-08-13 — NO WORK REQUIRED. This item is documentation, not a defect.**

Reviewed alongside items A and B and deliberately closed with no code change. The 8.1% is
`BroadcastChannel.postMessage` doing what it is asked to do, on stores that have asked for cross-tab
delivery by leaving `crossTabSync` at its default. Fix 1 already guards the expensive preprocessing
in front of it and skips the post entirely when the flag is off and nothing is listening. The only
way to remove the remaining cost while still delivering cross-tab is to make the payload smaller,
which trades a real feature for a few percent. Left alone.

### New item D — Fuse the ephemeral query scan into one pass

**Found 2026-08-13 by audit. The largest unmeasured candidate. Measured 2.7x in isolation.**
**Implementation spec for items D–H: `specs/perf-fixes-v2.md`.**

`EphemeralDataPlugin._query` walks the collection up to four times per query, allocating a
full-size array at each step:

1. `collection.records` spreads the WHOLE Map into a fresh array (`MemoryDataCollection.ts:17-19`)
   — 10k elements allocated per query before any filter runs.
2. Each leading filter runs `source = source.filter(...)` (`EphemeralDataPlugin.ts:416-429`) —
   one more array per filter option.
3. The clone loop walks the survivors again (`:431-436`).

Isolated on 10k rows with two filters: the current shape costs 169µs per query, a fused single
pass (iterate `data.values()` directly, test all leading filters inline, clone survivors into one
output array) costs 63µs — **2.7x**. This is the plugin section of `filtered-query-10000` and
`full-scan-10000`.

Notes for the implementer:

- Keep the `records` getter — the durable subclasses serialize `this.records` in `save()`
  (`FileSystemDbCollection.ts:148`, `BrowserStorageCollection.ts:122`). Add an internal
  iteration path for the query instead; only `EphemeralDataPlugin.ts:410` and `:329` (join
  inner side, same fusion applies) read it on the query path.
- The key fast path and the Fix 4 index path both bypass the scan; the fusion must not disturb
  either. Do this AFTER Fix 4 lands or coordinate — both edit the same function.
- Measure `full-scan-10000`, `filtered-query-10000`, `renamed-full-scan-10000`.

**Result — 2026-08-13, shipped.**

Machine: darwin arm64, Node v22.22.0. Fix 4 had NOT landed, so the fused loop reads
`source ?? collection.values()` with only the key fast path able to set `source`.

Straight before/after medians were unusable: run-to-run drift on this machine moved unrelated
scenarios (`compile-schema` +70%, `parse-simple-filter` +47%) in the same sample that the read
scenarios moved, which is larger than the effect. The numbers below are an **interleaved A/B** —
4 cycles of before/after/before/after, source swapped and rebuilt between each, medians of 4 per
arm. Interleaving is what made the signal readable; a plain before-then-after sample on a busy
machine is not evidence here.

| scenario | staged | fused | change |
|---|---|---|---|
| `count-10000` | 0.748ms | 0.504ms | **−32.6%** |
| `renamed-full-scan-10000` | 12.864ms | 11.634ms | **−9.6%** |
| `filtered-query-10000` | 5.426ms | 5.064ms | **−6.7%** |
| `full-scan-10000` | 11.724ms | 10.980ms | **−6.3%** |
| `renamed-filtered-query-10000` | 7.993ms | 7.748ms | −3.1% |
| `update-1000` (write control) | 2.984ms | 2.984ms | +0.0% |
| `insert-1000` (write control) | 4.391ms | 4.439ms | +1.1% |
| `diff-update-1000` (write control) | 1.693ms | 1.703ms | +0.6% |

`count-10000` is the scenario that most directly exposes the plugin scan — it pays the walk and
the allocations but almost no attach or per-row translation — and it moves by a third. The other
read scenarios spend most of their time in attach and translate, so the isolated 2.7x on the
plugin section shows up end-to-end as 3–10%. The three write scenarios are flat, as a read-path
change must be.

`diff-clean-sweep-10000` read +9.7% in the same sample. It is NOT affected by this change: its
measured region is `hasChangesAsync()` alone, with the query in `setup`, and it runs with
`reuseSetup: true` so it inherits the previous scenario's heap. Treated as noise.

Jest before and after: 211 passed / 21 skipped / **0 failed** — identical. (The "27 suites / 8
tests fail on a clean checkout" note in section 1.3 is stale; this tree is green.)

The join inner side (`resolveJoinInnerSide`) got the same treatment — `innerCollection.records`
replaced by the iterator — but no benchmark scenario joins, so that half is shipped under the
"unambiguously less work" rule.

### New item E — `IdSet` allocation on every keyed operation: MARGINAL, do not do alone

`MemoryDataCollection` builds `new IdSet(...ids).toString()` for every `getByIds`, `add`,
`update`, and `remove`. The constructor allocates via rest args and `Object.freeze`s the array
(`core/src/collections/IdSet.ts:8`); an update in `bulkPersist` pays it at least twice (concurrency
probe + prior fetch).

Measured in isolation: 79.6ns per lookup as-is, 45.1ns with a single-key fast path that skips the
IdSet entirely — **1.77x, under the ~2x bar**, so expect little on the real path. Recorded so
nobody re-derives it: only worth folding in if a write profile ever shows `IdSet` frames, or as an
incidental part of Fix 4's touching of the same methods. The freeze itself is only ~11% of the
cost; the allocation and string build are the rest.

### New item F — `JsonTranslator._minMax` sorts to find an extremum

`_minMax` (`JsonTranslator.ts:322-333`) runs `data.sort(...)` and takes element 0: O(n log n) for
an O(n) question, measured 200x slower than a single pass at 10k elements (1.12ms vs 5.5µs). It
also MUTATES the result array it was handed, which callers do not expect. No benchmark scenario
covers `min()`/`max()`, so ship it under the "unambiguously less work" rule (the item-B
precedent), with a regression test that the input array order is preserved.

**Defect found and FIXED during this audit (2026-08-13):** the `min`/`max` comparators
subtracted, which is NaN for strings, so `min()` of `["zebra","apple","banana"]` returned
`"zebra"` — and the test suite PINNED the wrong answer. The comparators now use relational
comparison with explicit null ordering (nulls first for `min`, last for `max`), matching the
relational-sort precedent in Part 4. Tests updated and extended; 211 suites pass, failing set
unchanged. The O(n) rewrite of `_minMax` itself remains open — see `specs/perf-fixes-v2.md`,
which also documents the `undefined`-ordering trap the rewrite must honor.

**Result — 2026-08-13, shipped under the "unambiguously less work" rule.**

`_minMax` is one pass that reuses the caller's comparator (`sort(candidate, best) < 0`), so `min`
and `max` keep their null ordering from a single body. The empty-array throw moved ABOVE the scan
— it used to sort first and then check the length.

No benchmark scenario reaches `min()`/`max()`, and the standard set did not move (medians in line
with the post-item-D arm: `count-10000` 0.50ms, `full-scan-10000` 11.2ms). Jest: 211 passed /
21 skipped / 0 failed, +6 new tests.

The `undefined` skip is the whole trap and it is load-bearing. `Array.prototype.sort` moves
undefined elements to the END without ever passing them to the comparator, so sort-take-first
never returned one; a single pass without the skip answers `undefined` for `min([5, undefined, 1])`.
`JsonTranslator.test.ts` now pins that case, plus: the input array is not reordered (numbers and
Dates), the empty-array throw and its message, a single-element array, duplicates, and all-null.

### New item G — the translator re-runs filters the plugin already applied

By design, `_query` applies leading filters before cloning and `JsonTranslator.filter` runs the
SAME predicates again over the survivors (the comment at `EphemeralDataPlugin.ts:413-415` calls
it a no-op pass). It is correct but not free: one predicate call per surviving row per filter, on
every filtered query. Removing it means the plugin telling the translator which options it
consumed — an API design question, same family as the Fix 1 guard. UNMEASURED on the real path;
profile `filtered-query-10000` for `filter` frames before deciding. Expected to be small next to
item D; check it only after D lands.

### New item H — `serializeDelta` rebuilds the root-property list per call

`ChangeTracker.serializeDelta` (`ChangeTracker.ts:566`) runs `schema.properties.filter(...)` and
then `roots.find(...)` per patch key — per CHANGED ENTITY per save, allocating the same array
every time. Cache the roots (and a name→property map) once per tracker; the schema is fixed at
construction. Small — only dirty entities pay it — but it is one line of waste in the save path
and the fix cannot regress anything. Measure `diff-update-1000` / `update-1000` to confirm it is
at least neutral.

**Result — 2026-08-13, shipped. Better than neutral.**

Machine: darwin arm64, Node v22.22.0. Interleaved A/B, 4 cycles, medians of 4 per arm.

| scenario | rebuilt per call | cached | change |
|---|---|---|---|
| `update-1000` | 3.013ms | 2.790ms | **−7.4%** |
| `insert-1000` | 4.401ms | 4.287ms | −2.6% |
| `diff-update-1000` | 1.655ms | 1.704ms | +3.0% |
| `full-scan-10000` (read control) | 11.161ms | 10.962ms | −1.8% |
| `count-10000` (read control) | 0.489ms | 0.485ms | −0.9% |

`update-1000` is the scenario section 2.4 tracks, and it moved the right way by more than the
noise floor below. `diff-update-1000` +3.0% is inside that floor.

**A measured noise floor for this machine — use it instead of arguing with single runs.**
A NULL A/B (4 cycles, identical code in both arms, run 2026-08-13 between item H's arms) gives
the spread each scenario shows when nothing changed at all:

| scenario | null-A/B delta |
|---|---|
| `parse-simple-filter` | −25.0% |
| `compile-schema` | −21.3% |
| `diff-clean-sweep-10000` | −13.7% |
| `parse-complex-filter` | −5.3% |
| `renamed-filtered-query-10000` | +3.3% |
| `update-1000` | +2.0% |
| `full-scan-10000` | −1.9% |
| `filtered-query-10000` | +1.8% |
| `count-10000` | +0.9% |
| `diff-update-1000` | +0.6% |

`diff-clean-sweep-10000`, `parse-simple-filter`, `parse-complex-filter` and `compile-schema` have
a spread far larger than any fix in this document produces — they are sub-millisecond and/or
inherit the previous scenario's heap (`reuseSetup`). Do not read them as evidence in either
direction. The rest are stable to ~2%, which is what makes items D and H readable.

### Fix 7 — Replace Proxy change tracking with generated accessors (endgame)

**Priority: last. Architectural. Only start with explicit sign-off.**

**Problem.** The Proxy `get` trap costs ~186ns vs ~17ns for a plain read (measured 2026-08-02);
the `set` trap floor after the early-out fix is ~31ns vs ~14ns for a plain object. Every
tracked entity pays this on every property access that misses a cache.

**Fix sketch.** The codegen infrastructure already emits per-schema functions. Extend it to
emit a per-schema entity class: `Object.defineProperty` getter/setter pairs per schema
property, with the setter writing a dirty bit into the tracking state (WeakMap from Fix 2
stage 2, or a slot). Accessor calls inline in V8; Proxy traps do not.

**Prerequisites.** Fix 2 stage 2 (tracking state out of the entity), and a benchmark suite
that covers attach, modify, save, re-read, and merge — because this change moves cost between
all of them.

**Risks.** Behavior differences around dynamic/extra properties (Proxy sees every key;
accessors only see schema keys), enumeration order, and `JSON.stringify`. Spec the intended
semantics for non-schema properties before writing code.

**Result — 2026-08-13. DROPPED at the microbenchmark stage. Do not retry without a new shape.**

The step-2 protocol (microbenchmark the candidate shapes BEFORE editing) killed this one before
any code changed. Machine: darwin arm64, Node v22.22.0. Medians of 5 rounds, 5-property schema,
200k constructions / 5M reads / 2M writes. Script: accessor-bench.js (scratchpad; rewrite from
this table if needed).

| shape | construct/entity | read vs plain | write vs plain | serialization |
|---|---|---|---|---|
| plain object | 34ns | x1.0 | x1.0 | all surfaces ok |
| Proxy (current) | 74ns | x22.9 | x15.8 | JSON ok; `structuredClone` throws `DataCloneError` |
| object literal with accessor pairs | 744ns | **x29.1** | x60.5 | all surfaces ok |
| shared descriptor map + `Object.defineProperties` | 1,078ns | x12.3 | x9.3 | all surfaces ok |
| prototype accessors + generated `toJSON` | 48ns | x15.5 | x10.2 | JSON ok; `Object.keys`/spread/`structuredClone` return nothing |

Three findings:

1. **Object literals with accessor pairs are a trap.** Each literal evaluation creates fresh
   closure identities, so every entity gets its own hidden class; property reads go megamorphic
   and end up SLOWER than the Proxy. The "codegen emits a literal per schema" idea fails for
   this reason, not for serialization.
2. **Own accessors (the only serialization-clean shape) lose on the real path.** Shared
   descriptors read 1.9x faster than the Proxy, but construction is ~1µs/entity vs 74ns. Fix 6
   showed attach/construction dominates the read path: on the 50k re-read this shape ADDS ~50ms
   of construction to save ~6ms of trap cost. Net loss, decisively.
3. **Prototype accessors are the only shape that wins everywhere** — construction cheaper than
   the Proxy, reads and writes ~1.5x faster, and the pause/unpause bootstrap (15.9% of the read
   path) loses its reason to exist. But `{ ...entity }`, `Object.keys(entity)`, and
   `structuredClone(entity)` all return nothing. Spread on a tracked entity is a common pattern
   in React apps, so this is a public breaking change bought for roughly 25–30% of the read path.

Decision: not worth the semantic break. The Proxy stays. If this is ever reopened, the only
viable variants are (a) prototype accessors shipped as an OPT-IN tracking mode next to
proxy/diff/readonly, or (b) some future shape that stamps own accessors without per-entity
`defineProperty` cost — none exists in V8 today. Note for either: writes to `__tracking__`
through the proxy are silently swallowed (see the traps list in Part 4), and a `toJSON` does not
rescue spread or `structuredClone`.

---

## Part 4: What is already done — do not redo

Verified present in `0.3.0` on 2026-08-12:

- Filter-before-clone in the ephemeral query path (`EphemeralDataPlugin.ts:412`) — 3.4x on selective reads.
- Key-equality O(1) fast path (`EphemeralDataPlugin.ts:388`).
- `crypto.randomUUID()` with fallback (`core/src/utilities/uuid.ts:19`) — ~17% on inserts.
- Identical-value early-out BEFORE `String(property)` in the change-tracker set trap
  (`SchemaDefinition.ts:63`) — 156ns → 31ns per write.
- `__tracking__` cache on attachment records (26x on idle `saveChanges` at 100k attached).
- Relational sort comparator in `JsonTranslator.sort` (strings sort correctly).
- Date hash via `getTime()` instead of `toISOString()` — ~10% on inserts.

Added 2026-08-12 by Fixes 1–3:

- `crossTabSync` datastore option; `send` skips preprocessing when it is `false` and no local
  listener exists (Fix 1).
- `__tracking__` cleared by assignment instead of `delete` in the generated enricher, proxy mode
  only (Fix 2).
- `schema.cloneStorage` — a storage-shape cloner generated on first use, replacing the
  `structuredClone` fallback in `EphemeralDataPlugin.recordCloner` (Fix 3).
- Benchmark scenarios `renamed-full-scan-10000` and `renamed-filtered-query-10000`.

Added 2026-08-13 by items D, F and H (`specs/perf-fixes-v2.md`):

- `MemoryDataCollection.values()` — iterates stored records without spreading the Map. The
  `records` getter STAYS; the durable subclasses serialize it in `save()`.
- Filter and clone FUSED into one pass in `EphemeralDataPlugin._query`, iterating rather than
  materializing when no fast path set `source` (item D) — `count-10000` −32.6%. The join inner
  side (`resolveJoinInnerSide`) uses the iterator too.
- `JsonTranslator._minMax` is a single pass that no longer mutates the caller's array (item F).
  It skips `undefined` to match what `sort()` did — see the item F result before touching it.
- `ChangeTracker` caches root properties plus TWO name→property maps at construction (item H) —
  `update-1000` −7.4%. The two maps preserve `serializeDelta`'s name-before-resolved-name
  precedence; merging them into one is a correctness bug, not a simplification.

Cleared suspects — measured, not guilty, do not re-investigate:

- `Object.defineProperty` in the proxy set trap (the defect #26 fix) is NOT the cause of the
  `update-1000` regression.
- `values()` instead of destructured Map entries: ~5%, not worth the churn.
- Converting the remaining `delete` sites (`SchemaDefinition.ts` 412 and 486) to
  `Object.defineProperty(..., { value: undefined })` — measured 2026-08-12: `update-1000` +4.2%,
  and it HALVED the read win from the enricher site. defineProperty per merged entity costs more
  than the dictionary-mode penalty it avoids.
- The change-bag deletes (`SchemaDefinition.ts` 106–107) cannot become `= undefined` without a
  different dirty-tracking representation. See the Fix 2 result for why a defined-value count is
  also wrong.
- Replacing Proxy tracking with generated accessors (Fix 7) — dropped at the microbenchmark
  stage 2026-08-13. Own accessors construct ~15–30x slower than the Proxy and lose on the
  attach-dominated read path; the one fast shape (prototype accessors) breaks
  spread/`Object.keys`/`structuredClone` on entities. Full table under Fix 7's Result.

Traps that cost time this session — worth reading before touching these paths:

- **Writes to `__tracking__` through a change-tracking proxy are silently dropped.** The set trap
  answers them with a bare `return true`. Use `Object.defineProperty(entity, "__tracking__",
  { value: ..., configurable: true, writable: true, enumerable: false })`, which is not
  intercepted, or `delete`. This matters for Fix 7, which moves tracking state off the entity.
- **`ConcurrencyDbPlugin` depends on `EphemeralDataPlugin` copying undeclared columns.** It fakes
  a renamed property to force the structural-copy path so its hidden `__version` survives a read.
  Any change to how stored records are copied must keep undeclared columns, or optimistic
  concurrency stops detecting conflicts with no error anywhere.
- **`benchmark/` runs against SOURCE**, via tsconfig `paths` (so does jest, via
  `moduleNameMapper`). The section 1.2 rebuild is needed for `tsc` typechecks of dependent
  packages, which read `core/dist`, not for measuring or testing.
- **Do not run two jest invocations at once.** They share the file-system plugin's temp dirs and
  fail in unrelated plugins (`ENOTEMPTY`, pouchdb) — failures that look like real regressions.
- **A plain before-then-after benchmark sample is not enough on a busy machine.** Both item D and
  item H were unreadable that way: unrelated scenarios drifted further than the effect inside a
  single sample. Swap the source between arms and INTERLEAVE (before/after/before/after, 4
  cycles, median per arm), and calibrate against the null-A/B table under item H's result.
