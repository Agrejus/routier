# Test Strategy

Status: Proposal
Date: 2026-07-31

## Summary

This spec defines a test program for routier across four layers: unit, integration, end-to-end, and mutation. The goal is production confidence: every generated function, every query path, and every plugin proves its behavior against explicit invariants. The volume target — thousands of executed cases — comes from parameterized schema matrices and property-based generation, not from thousands of hand-written test files.

## Current state (baseline)

| Fact | Value |
| --- | --- |
| Test framework | Jest + ts-jest, per-workspace projects |
| Passing tests | 544 |
| Known-failing tests | 8 (`broadcast.test.ts`, `TagCollection.contract.test.ts`) |
| Suites that cannot run | 27 — native deps (leveldown, rspack bindings) fail to install |
| Generators with direct tests | clone, compare, deserialize, serialize, set, compareIds, merge, prepare, strip, hash (recent) |
| Generators with no tests | freeze, enableChangeTracking, getHashType, preprocess, deserializePartial, getIndexes |
| Mutation testing | none |
| Property-based testing | none |
| E2E against real backends | none in CI |
| Performance regression tests | none (`npm run benchmark` points at a missing directory) |

Two audits this month found production bugs that the existing suite could not catch: inverted parser precedence (enshrined by a wrong test), silent property omission in codegen, clone-by-reference, renamed-property data loss. Each escaped because tests only exercised happy paths with one schema shape and one property order. The program below is designed around that lesson: **vary the inputs, assert the invariants.**

## Principles

1. Test behavior through public APIs (compiled schemas, datastores, plugins) — not generated source strings.
2. Every invariant gets a name and one place where it is asserted.
3. Generated variety over hand-written volume. A matrix of 50 schema shapes × 15 generators × 4 property orders produces 3,000 cases from ~30 lines of driver code.
4. A wrong test is worse than a missing test. Mutation testing exists to find both.
5. The suite must run green before it can grow. Phase 0 fixes the 8 failing tests.

## Layer 1 — Unit

### 1.1 Schema-shape matrix (the core of the program)

Build a shape catalog in `test-utils`: a list of schema definitions that covers the full property space.

| Dimension | Values |
| --- | --- |
| Type | String, Number, Boolean, Date, Array (of each element type), Object (depth 1–3), Definition, Computed (tracked/untracked), Function |
| Modifiers | none, nullable, optional, key, identity, key+identity, default(literal), default(fn), default(fn, injected), serializer, deserializer, `from()` rename |
| Placement | root, nested, nested under nullable parent, nested under renamed parent |
| Property order | key-first, key-last, object-first, date-first |

A driver iterates the catalog and asserts the **generator invariants** on every shape:

| Invariant | Assertion |
| --- | --- |
| roundtrip | `deserialize(serialize(x))` deep-equals `x` for every schema shape |
| clone-isolation | `clone(x)` deep-equals `x`; no shared references at any depth (walk and compare identity) |
| compare-reflexive | `compare(x, x) === true`; `compare(clone(x), x) === true` |
| compare-discriminates | mutating any single property makes `compare` return false |
| hash-stable | `hash(x) === hash(clone(x))` |
| hash-discriminates | entities differing in one property hash differently |
| enrich-defaults | absent properties with defaults receive them; present values survive |
| enrich-idempotent | `enrich(enrich(x))` equals `enrich(x)` for non-identity properties |
| merge-total | merge into an empty destination reproduces the source |
| strip-removes | strip output contains no key, identity, function, or unmapped computed property |
| order-independent | every invariant holds for all property-order permutations of the same schema |
| compile-total | `compile()` either succeeds or throws a named error — `assertPropertyHandled` must never fire for a catalog shape |

Estimated volume: ~60 shapes × 12 invariants × 4 orders ≈ **2,900 executed cases**.

### 1.2 Property-based tests (fast-check)

Add `fast-check` and use it where inputs are unbounded:

- **Expression parser**: generate arbitrary filter ASTs (property/value/comparator/operator trees), render them to arrow-function source, parse, and assert the tree round-trips. Generate adversarial strings (quotes, operators, unicode, comments inside filters) and assert the parser either produces a correct tree or `NOT_PARSABLE` — never a wrong tree. Oracle: evaluate the parsed tree and the original closure against generated entities; results must match.
- **Data round-trips**: generate random entities per schema shape (extend `test-utils/dataGenerator`) instead of fixed fixtures.
- **Query oracle** (see 2.2) fed with generated data sets.

Each property runs 100–1,000 generated cases per CI run. Failures shrink to minimal reproductions and get pinned as regular regression tests.

### 1.3 Unit gaps to close directly

1. `TrampolinePipeline` / `WorkPipeline`: sync/async mixing, error propagation, deep chains (stack safety at 100k steps).
2. `ChangeTracker`: proxy set/get traps, nested dirty tracking, pause/unpause, tag lifecycle.
3. `QueryOptionsCollection`: routing table — one test per (option kind × unmapped/renamed/not-parsable) cell.
4. `MemoryDataCollection`: id generation (string, numeric, composite), `getByIds`, seed vs add.
5. The 6 untested generators listed in the baseline table.
6. Fix `broadcast.test.ts` and `TagCollection.contract.test.ts` or rewrite them against intended behavior (Phase 0).

## Layer 2 — Integration

Integration tests exercise datastore + plugin together, in-process.

### 2.1 Plugin contract kit (the architectural piece)

The plugin architecture needs a **shared behavioral contract**: one suite, written once in `test-utils`, that every `IDbPlugin` implementation must pass. Structure:

```ts
// test-utils/src/pluginContract.ts
export function describePluginContract(name: string, factory: () => IDbPlugin) {
    // ~150 behavioral tests, parameterized over the factory
}
```

Contract areas: add/save/query round-trip, updates and deltas, removals, identity generation, composite keys, all query options (filter, sort, skip, take, map, count, sum, min, max, distinct, group) alone and combined, renamed properties, nullable/optional shapes, dates, arrays, empty collections, concurrent saves, `destroy`, error results (never thrown exceptions across the plugin boundary).

Every plugin runs the same kit: memory, dexie (fake-indexeddb), browser-storage (jsdom localStorage), file-system (temp dirs), sqlite (better-sqlite3, in-memory), pouchdb (memory adapter), postgres/mysql (testcontainers — see Layer 3). A new plugin gets its first 150 tests by adding three lines.

### 2.2 Query oracle

For every query in a generated query corpus, run it twice: once through the plugin under test, once through a **reference implementation** (naive JS: deserialize everything, filter/sort/slice with plain closures). Assert identical results. This catches the class of bug where the plugin's translation disagrees with JS semantics — the renamed-property and string-sort bugs were both exactly this. Corpus: ~200 generated queries × plugins ≈ **1,400+ cases**.

### 2.3 Dataflow integration

- saveChanges pipelines: multi-collection stores, adds+updates+removes in one save, tags.
- Change tracking end-to-end: entity mutation → dirty detection → delta persist → merge-back → second mutation.
- Subscriptions and live queries: subscribe, mutate, assert callback data; cross-instance via BroadcastChannel; views (`derive`) recompute.
- Scoped collections (`scope()`) and views over shared documents.
- The optimistic paths added recently: key-equality fast path parity with full scan (same results with and without the fast path — assert by seeding both a keyed and an unkeyed query).

## Layer 3 — End-to-end

E2E proves the system against real storage engines and real runtimes.

| Target | Harness | Runs |
| --- | --- | --- |
| SQLite | better-sqlite3 file DB in temp dir | every CI run |
| PostgreSQL | testcontainers | nightly + release |
| MySQL | testcontainers | nightly + release |
| IndexedDB (dexie) | Playwright, real Chromium | nightly + release |
| localStorage/sessionStorage | Playwright | nightly + release |
| Cross-tab sync | Playwright, two pages, BroadcastChannel | nightly + release |
| PouchDB | memory adapter every run; leveldown nightly | mixed |
| React bindings | @testing-library/react + jsdom | every CI run |

Each E2E target runs: the plugin contract kit, a persistence-across-restart scenario (write, close, reopen, verify), and a small soak scenario (10k entities, mixed operations, verify final state against the oracle).

Prerequisite: fix the install story. `leveldown` breaks `npm install` for every contributor. Move native-dependency plugins behind `optionalDependencies` or a separate install step so the default workspace installs and tests cleanly.

## Layer 4 — Mutation testing

Add StrykerJS (`@stryker-mutator/core` + jest runner). Mutation testing is the check on the checks: it mutates the source (flips comparisons, deletes statements, swaps operators) and verifies the suite kills the mutants. The inverted-precedence bug was a mutation the old suite did not kill; the wrong test *asserted* the mutant.

Scope and thresholds, in order:

| Package/area | Mutation score gate |
| --- | --- |
| `core/src/expressions` | ≥ 90% |
| `core/src/codegen` + `SchemaDefinition.compile` | ≥ 85% |
| `core/src/plugins` (EphemeralDataPlugin, translators, QueryOptionsCollection) | ≥ 85% |
| `core/src/pipeline`, `collections` | ≥ 80% |
| `datastore/src` | ≥ 75% |

Mutation runs are expensive: run per-package, nightly, and on PRs that touch the scoped paths (incremental mode). Surviving mutants become tickets: either add the killing test or document why the mutant is equivalent.

## Performance regression tests

Recreate the missing `benchmark/` workspace from the harness built during the perf work (isolated processes, warmup, 30 samples, medians): insert, update, full scan, filtered query, point lookup by key. Store baseline medians in the repo. CI (nightly) fails when a scenario regresses > 15% against baseline; releases update the baseline deliberately. This locks in the 30% write and 3× point-read gains.

## Changes to current testing

1. **Phase 0 — green baseline**: fix or rewrite the 8 failing tests; fix jest open handles (BroadcastChannel must close on `destroy`; add global teardown) so `--forceExit` is not needed.
2. **Replace mock schemas with compiled schemas** where possible. `parser.test.ts` uses a hand-built `mockSchema` that let a wrong-precedence assertion survive; tests against `s.define(...).compile()` bind tests to real behavior.
3. **Delete or fix tests that assert bugs.** The audit found two (precedence, boolean-false coercion) — mutation testing will find the rest.
4. **Test placement convention**: unit tests stay beside source (`*.test.ts`); integration tests move to `__integration__/`; E2E lives in a new `e2e/` workspace; the contract kit lives in `test-utils`.
5. **One data generator.** Extend `test-utils/dataGenerator` to cover the full shape catalog; all layers consume it.
6. **CI tiers**: PR = unit + integration + sqlite E2E (~5 min); nightly = full E2E + mutation + property-based long runs + benchmarks; release = everything + testcontainers matrix.

## Volume estimate

| Source | Cases |
| --- | --- |
| Schema-shape matrix × invariants × orders | ~2,900 |
| Plugin contract kit × 7 plugins | ~1,050 |
| Query oracle corpus × plugins | ~1,400 |
| Property-based runs (100–1,000 per property, ~25 properties) | ~5,000 generated/run |
| Directed unit gap closure | ~400 |
| E2E scenarios | ~150 |
| Existing suite (kept) | ~540 |
| **Total executed per full run** | **~11,000+** |

## Phases

| Phase | Deliverable | Exit criteria |
| --- | --- | --- |
| 0 | Green baseline, install fix, teardown fix | 0 failing tests, `npm install && npx jest` clean |
| 1 | Shape catalog + generator invariants + data generator | ~3,000 matrix cases pass; the 6 untested generators covered |
| 2 | Plugin contract kit + query oracle | memory, dexie, file-system, sqlite pass the kit |
| 3 | Mutation testing on core | expressions ≥ 90%, codegen ≥ 85%; surviving-mutant backlog triaged |
| 4 | E2E workspace + testcontainers + Playwright | nightly matrix green |
| 5 | Property-based suites + benchmark regression gates | fuzz corpus pinned; perf baselines enforced |

## Open questions

1. Does the `Definition` type and array-of-objects recursion get fixed before Phase 1, or does the catalog mark those shapes as known-failing? Recommendation: mark known-failing with explicit `it.failing` tests so the suite documents the gap and flips loudly when fixed.
2. Testcontainers requires Docker in CI — confirm the CI environment allows it, otherwise fall back to service containers.
3. Mutation score gates on `react/` and `sync-server/` are out of scope here; revisit after Phase 3.
