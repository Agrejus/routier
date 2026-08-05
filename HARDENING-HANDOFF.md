# Replication Plugin Hardening — Handoff

**Branch:** `v0.2.2` · **Package:** `plugins/replication` (`@routier/replication-plugin`)
**Status:** Tiers 1–4 implemented and green (**191/191 tests, 9 suites**), plus a public sync API
and request pacing (§8), and 4 cross-package e2e tests in `e2e/src/replicationUpdateWire.test.ts`. Mutation testing is configured and run for three of seven source files; the rest is scoped
follow-up (§7).
**Last verified:** `npx tsc --noEmit` clean, `npm run lint` clean,
`ROUTIER_LOG_LEVEL=silent npx jest` 191/191 in `plugins/replication`; chaos soak 3× 200 seeds
green; mutation `httpUtils.ts` **99.01%**, `UnsyncedQueue.ts` **83.96%**, `auth.ts` **88.89%**.

> **This file was recreated on 2026-08-04** after the original disappeared from the working tree
> (untracked, so unrecoverable from git; cause unknown). The content below was re-authored from
> the same session that wrote the previous version, so it should be complete — but if you
> remember a note that is missing, that is why.

This document is the single source of truth for the hardening effort so any model/person can
pick it up. Read top to bottom before writing code.

---

## 1. What this effort is

The replication package provides offline-first sync plugins that all implement the same
`IDbPlugin` interface (`query`, `bulkPersist`, `destroy`, all callback-based via `done(result)`):

| Component | File | Role |
|---|---|---|
| `HttpDbPlugin` | `src/HttpDbPlugin.ts` | Plain HTTP backend: GET per collection with serialized query params, POST `{ adds, updates, removes }` |
| `HttpSwrDbPlugin` | `src/HttpSwrDbPlugin.ts` | Stale-while-revalidate cache over a local store + HTTP, with a durable offline write queue |
| `UnsyncedQueue` | `src/UnsyncedQueue.ts` | Durable queue of local changes not yet confirmed by the server (reserved `_routier_unsynced` collection) |
| `PluginSyncEngine` | `src/PluginSyncEngine.ts` | Generic composition: source plugin + ordered query fallbacks + mirrored writes |
| `OptimisticUpdatesDbPlugin` | `src/OptimisticUpdatesDbPlugin.ts` | Memory read-cache over a source plugin; hydrates lazily, acks from memory, mirrors via PluginSyncEngine |
| `httpUtils` | `src/httpUtils.ts` | Shared: `RequestTracker` (timeout/abort fetch), `KeyedMutex`, `backoffDelayMs`, `HttpStatusError`, status classification |
| `auth.ts` | `src/auth.ts` | `AuthErrorEvent`, `AuthErrorHandler` (may resolve `true` — re-auth succeeded, retry once) |
| `queryParamHelpers.ts` | `src/queryParamHelpers.ts` | Serializes a query (filter/sort/skip/take) into GET params. Untouched by this effort. |

Everything below is in this branch's working tree, **not yet committed**.

### Phase A — bug fixes (done)
1. `postWithRetry` loop bounds (`maxAttempts=1` sent **zero** POSTs; default 10 sent 9).
2. Double `done()` on persist (optimistic ack then an error `done()`), plus duplicate result mutation.
3. Queue only tracked adds/updates and **replayed everything as adds**; removes were never queued → a failed remove was resurrected by the next revalidate.
4. Revalidate clobbered pending local changes (only removes were shielded; now all kinds are).
5. SWR staleness cache was module-global (shared across instances) and keyed by schema only. Now instance-scoped, keyed by `schemaId|serialized-query-params`, with inclusive `isStale` so `maxAgeMs: 0` = always stale.
6. `PluginSyncEngine` reported the errors-array index as `pluginIndex` in swallow mode.
7. Wire-format mismatch: SWR sent updates as `EntityUpdateInfo`, HttpDbPlugin sent plain entities. Both send plain entities now.
8. `HttpDbPlugin` used `console.*` instead of the shared `logger`.
9. `OptimisticUpdatesDbPlugin` hydration used a 10 ms polling loop and permanently bricked a collection after one failed hydration.

### Phase B — hardening tiers 1–3 (done)

**Tier 1: durability + network**
- Queue writes are promise-returning; `bulkPersistAsync` **awaits the enqueue before acking** (a queue-write failure fails the persist — success without a durable obligation would be a lie).
- Permanent vs transient classification (`isPermanentStatus`): 4xx except 401/403/408/429 is permanent. Transient retries forever (capped backoff); permanent **dead-letters**.
- Poison isolation: a batch rejected permanently is retried unit-by-unit; accepted units flush, rejected units dead-letter (reported via `onSyncDeadLetter`), transient ones stay queued.
- All fetches run through `RequestTracker` with `AbortController` timeouts (`requestTimeoutMs`, default 30 s); `destroy()` aborts in-flight requests on both plugins.
- `PluginSyncEngine.guardedCall`: per-call timeout (`pluginCallTimeoutMs`, default 60 s, 0 disables) + once-guard against a double `done()`.
- Headers re-fetched **per retry attempt**.
- Backoff = equal jitter (`backoffDelayMs`), honors `Retry-After`.

**Tier 2: protocol**
- Idempotency keys: every queued change gets an `opId`. POST bodies carry `meta: { opIds: { adds[], updates[], removes[] } }` — parallel arrays, **additive**; servers may ignore `meta`.
- POST-echo reconciliation: `translatePersistResponse?: (schema, responseBody) => unknown[] | null`. Echoed entities upsert into the SWR store (never remove) under the collection mutex, then notify subscribers. **Not applied on the background flush** (no `CompiledSchema` there — see §7d).
- Conflict hook: `onConflict?: ({ collectionName, entities, error })`. 409 is permanent → informational on the direct path; the flush isolates and dead-letters it.
- Re-auth handshake: `onAuthError` typed as `AuthErrorHandler`; resolving `true` earns exactly one retry with fresh headers. `HttpDbPlugin.query` owns query-path auth notification.

**Tier 3: structural**
- `KeyedMutex` per collection serializes ALL SWR-store mutations (`persistToSwrStore` locks every collection in the event, sorted — deadlock-free). **Not re-entrant** — never lock inside code already holding the same key (`applyRevalidatePersist` deliberately does not lock).
- Compare-and-delete dequeue by `revision`.
- Flush coalescing per entity (`getUnsyncedEntitiesForFlush`), superseded rows riding along in `unit.rows`.
- Hydration promise map in `OptimisticUpdatesDbPlugin`; a failed hydration removes itself so the next query retries.
- `online` listener triggers an immediate flush; removed in `destroy()`.
- Background backoff resets to 0 after a flush that moved data with no failures.

### Phase C — Tier 4 (verification) and the eight bugs it found

Tier 4 is done: a shared test kit, dedicated hardening tests, a seeded chaos harness, real-HTTP
e2e, public exports, and a scoped Stryker config. **Writing the verification found eight defects
that Tiers 1–3 had left behind.** Each is fixed and has a named regression test.

1. **`HttpDbPlugin.handleQuery` could never call `done()`.** With `queryRetryMaxAttempts: 1`, a
   401 whose `onAuthError` reported success did `continue`, the loop condition then failed, and
   the function returned having settled nothing — the caller's promise hung forever and the SWR
   cache-miss path never fell back to the store. Fixed by the re-auth ceiling below plus a final
   unreachable-by-design `done()` after the loop. *(Found by: a re-auth test hanging.)*
2. **The re-auth retry spent a retry from the budget.** Promised as unconditional, it silently
   did nothing at `maxAttempts: 1`. Both `handleQuery` and `postWithRetry` now raise
   `attemptsAllowed` by one on a successful re-auth instead of consuming an attempt.
3. **A confirmed change resurrected rows.** Queue rows are keyed by (collection, **kind**, ids),
   so one entity can hold an add, an update and a remove row. Confirming the remove dequeued only
   the remove row; the next flush replayed the still-queued add and the deleted row came back.
   Fixed with an enqueue sequence (`seq`): confirming a change also retires the entity's other
   rows enqueued *at or below* that seq, and leaves newer ones queued. *(Found by: chaos.)*
4. **Coalescing sent one change's opId with another change's bytes.** An add coalesced with a
   later update flushed the update's entity under the *add row's* opId; a server that had already
   applied that opId (lost ack) deduped the replay and silently discarded the newer entity. The
   opId now always comes from the newest row. *(Found by: chaos, seed 12.)*
5. **The flush path dequeued without compare-and-delete.** `removeByRowIds` deleted by id only,
   so a local edit landing between the flush's read and the POST's confirmation was dropped — a
   lost acked write. Replaced by `UnsyncedQueue.removeRows`, which re-checks each row's revision.
6. **Queue bookkeeping silently did nothing on a durable store.** `persistToStore` wrote
   dead-letter status and attempt counters by re-adding rows with the same id, which works only
   because `MemoryDataCollection.add` is an upsert. A durable store — the configuration the docs
   recommend, so unsynced writes survive a refresh — is insert-only on add: Dexie's `bulkAdd`
   throws `ConstraintError`. So with a Dexie-backed queue a permanently-rejected change was
   **never marked dead and retried forever**, `onSyncDeadLetter` fired on every flush, and
   attempt counters never moved. Two `.catch(() => …)` handlers swallowed the write failure, and
   the flush counted a dead letter it had failed to record. Replacements now go out as
   `changes.updates` (every plugin upserts on update; Dexie via `bulkPut`), the swallowed failures
   log, and a failed dead-letter write counts as `failed` — the change really is still queued.
   Pinned by a stub store with IndexedDB's semantics, since MemoryPlugin cannot catch this.
   *(Found by: the browser demo showing `dead 1` beside `1 pending`.)*
7. **An empty filtered result was treated as a cold cache.** `!swrResponse.data.isEmpty` decided
   cache-miss, so a filter that legitimately matches nothing — "show me overdue items", none
   overdue — went to the network on *every* read regardless of `maxAgeMs`. Measured: three reads of
   an empty view cost four GETs inside a 60 s freshness window, i.e. an empty view polls the server
   forever. Freshness now decides: `!hasData && isStale(cacheKey)`. Negative caching is not
   "empty forever" — a stale empty view is still re-checked, and rows appearing on the server are
   picked up. *(Found by: the stress page in `examples/sync-engine-dexie/browser/complex.ts`.)*
8. **A negative `Retry-After` meant "retry immediately".** `Number('-5')` failed the `>= 0` guard
   and fell through to `Date.parse('-5')`, which JS parses as a year, yielding a 0 ms delay. The
   numeric branch is now explicit: malformed → `null` → computed backoff.
   *(Found by: mutation testing.)*

Also in Phase C: coalescing picks the winner by `seq` rather than fixed kind precedence (a
pending add still forces `kind: 'add'`, because the server has never seen the entity), and
`auth.ts`'s duplicate message-string classification collapsed into one `authStatusOf` that
prefers `HttpStatusError.status`.

---

## 2. Server wire contract

- `GET {getUrl(collection)}?filter=&sort=&skip=&take=` → JSON array of entities (or the shape `translateRemoteResponse` consumes).
- `POST {getUrl(collection)}` body:
  ```json
  {
    "adds": [entity, ...],
    "updates": [{ "<key>": ..., "<changedField>": ... }, ...],
    "removes": [entity, ...],
    "meta": { "opIds": { "adds": ["uuid"], "updates": [], "removes": [] } }
  }
  ```

  **Updates are partial and MUST be merged, not replaced** (changed 2026-08-04). An update carries
  the key fields plus only the fields that changed, so a server that does `row = body` blanks
  every column the client did not send. The demo caught this the moment the trim landed: the row
  came back with `name: undefined`. Merge by key — `{ ...existing, ...patch }`.

  Adds and removes still carry whole entities: an add has no prior state to patch, and a remove
  is addressed by key. An update falls back to the whole entity when the change tracker reports
  no delta (core's documented "write everything" convention), so a merging server is correct in
  both cases and a replacing server is correct in neither.
  `meta` is additive/ignorable. A server that stores processed opIds can dedupe replays.
  **An opId identifies the bytes sent with it**, not a queue row — see bug 4.
- Optional POST response body → `translatePersistResponse` for echo reconciliation.
- Status semantics the client relies on: 401/403 = auth (notify + optional single re-auth retry); 408/429/5xx/network/timeout = transient (retry with backoff, stays queued); other 4xx (incl. 409) = permanent (dead-letter after isolation; 409 also fires `onConflict`).

Three reference implementations exist in-tree: the model server in `src/chaos.test.ts`, the
`node:http` server in `src/httpServer.e2e.test.ts`, and the demo API in
`examples/sync-engine-dexie/browser/serve.mjs`.

## 3. Queue storage format (back-compat matters)

Collection `_routier_unsynced`, row id = `` `${collection}\u0000${kind}\u0000${recordIdsJson}` ``
(NUL delimiter — **keep it as the `\u0000` escape in source**; tooling has repeatedly turned it
into a literal NUL byte, and once into a plain space, which silently breaks id matching. Check
with `grep -P '\x00'` after any edit near it).

Columns: `id`, `collectionName`, `recordIds` (JSON of `schema.getIds(entity)`), `changeKind?`
(`add|update|remove`, missing = `add`), `entityJson`, `revision?`, `opId?`, `status?`
(`pending|dead`), `attempts?`, `seq?` (enqueue order — bug 3). All new columns optional for
back-compat; a row with no `seq` counts as oldest, a row with no `status` counts as pending. Dead
rows are excluded from flush, from `getUnsyncedCollections`, and from revalidate shielding.

`seq` comes from a module-level counter seeded with `Date.now()`, so a queue reloaded from storage
sorts before anything the new process enqueues.

**Row rewrites go out as `changes.updates`, never as adds** (bug 6). `MemoryDataCollection.add` is
an upsert, but a durable store is insert-only on add; only `update` upserts everywhere.

---

## 4. Test suites and infrastructure

All under `plugins/replication/src`:

| Suite | Tests | What it covers |
|---|---|---|
| `__tests__/httpTestKit.ts` | — | Shared kit (not a suite): abort-aware fetch mock, event builders, queue mirror schema, `writeQueueRows`, `waitFor` |
| `hardening.test.ts` | 51 | Tier 1–3 behaviours + the new sync API: dead-letter, poison isolation, 409, compare-and-delete (bugs 3/4/5), re-auth, timeouts/aborts, sync-engine guards, backoff/Retry-After, echo reconciliation, `online`, coalescing, `KeyedMutex`, `autoSync`/`syncNow`/`pendingCount`/`deadLetters`/`retryDeadLetters` |
| `UnsyncedQueue.test.ts` | 33 | The durability core and `auth.ts`: stamping, scoping, coalescing order, legacy rows, dead-lettering, every store-failure path, and an **insert-only store** (bug 6) |
| `chaos.test.ts` | 25 | Seeded convergence under a hostile network |
| `httpServer.e2e.test.ts` | 6 | Real HTTP over `node:http`: round-trip, echo, **server restart**, replay dedupe, socket-accepted-never-answered timeout, no-resurrection |
| `HttpSwrDbPlugin.integration.test.ts` | 14 | Real MemoryPlugins + programmable fetch (predates the kit; has its own local mock) |
| `HttpSwrDbPlugin.test.ts` | 7 | `persistToStore` classification |
| `HttpDbPlugin.test.ts` | 7 | Query/persist paths |
| `OptimisticUpdatesDbPlugin.test.ts` | 5 | Hydration, ack, mirroring |
| `PluginSyncEngine.test.ts` | 7 | Routing, mirror failure modes |

**The chaos harness** is the centrepiece. A model server behind the fetch mock takes real writes
while a seeded PRNG injects: request lost before apply, ack lost after apply, throttling with
`Retry-After`, and latency. After ~40 random ops it heals the network, drains the queue, and
asserts (1) the server holds exactly the acked writes, (2) a revalidate brings the SWR store in
line with the server, (3) nothing dead-lettered. An `afterAll` asserts every fault mode actually
fired and that replays were deduped — a run where no fault triggered would pass every invariant
while testing nothing.

- Default 25 seeds × 40 ops ≈ 12 s. Soak: `CHAOS_SEEDS=200 CHAOS_OPS=60 npx jest chaos`.
- The driver is deliberately **sequential**: each op waits for the plugin to go idle, and reads
  wait for the revalidate GET to be issued. A stale cache hit schedules its revalidate on a timer,
  so "the read resolved" does not mean "the fetch started" — skipping that wait made the suite
  flaky at ~1 seed in 150. Suspect the driver's sequencing before the plugin.

**Test-infra notes:**
- Set `ROUTIER_LOG_LEVEL=silent` when running jest here; the repo's `test.setup.js` sets `NODE_ENV=development`, which puts the logger at `debug` and buries results.
- `installFetchMock()` honors `init.signal`; handlers return `{ status, body?, headers?, delayMs?, hang? }`, and an abort rejects with the aborter's reason — which is how the timeout and destroy messages get asserted.
- Node has no `globalThis.addEventListener`, so `online` tests install an `EventTarget` stand-in and restore it afterwards.
- Suites use `autoSync: false` rather than reaching in to stop the background loop.

## 5. How to verify (from `plugins/replication`)

```bash
npx tsc --noEmit                        # must be clean
npm run lint                            # oxlint; 0 warnings
ROUTIER_LOG_LEVEL=silent npx jest       # 191/191 across 9 suites
CHAOS_SEEDS=200 ROUTIER_LOG_LEVEL=silent npx jest chaos   # soak; ~80 s
```

From the repo root:

```bash
npm run mutate:replication                                       # whole package (hours — §7)
npx stryker run stryker/replication.mjs --mutate 'plugins/replication/src/httpUtils.ts'
npx tsx --tsconfig tsconfig.test.json examples/sync-engine-dexie/index.ts   # Node example
node examples/sync-engine-dexie/browser/serve.mjs                          # browser demo
```

**Environment gotchas:**
- `npm run build` (rspack) fails on this machine — missing `@rspack/binding-darwin-*`. `tsc --noEmit` + jest are the verification tools; don't chase it.
- Repo-wide `tsc` shows many pre-existing errors in `examples/` and other in-flight packages. Judge only `plugins/replication` (and packages you touch) by their own tsc.
- This branch also contains unrelated completed work: the query-language parser expansion in `core/src/expressions/` + SQL translator updates, with 865 core tests green. Don't revert those.

## 6. Key invariants to preserve

1. **Exactly one `done()` per plugin event** — and *at least* one. Every loop that can exit without settling needs a terminal `done()` (bug 1).
2. **No acked write is ever silently lost.** Enqueue is awaited before ack; transient failures retry forever; only permanent rejections dead-letter, and never silently.
3. **Local unsynced changes are authoritative over revalidate** until confirmed or dead-lettered.
4. **Store mutations for a collection are serialized** through `storeMutex` (non-reentrant).
5. **Dequeue is compare-and-delete by revision** on *both* paths — direct (`removeMany`) and flush (`removeRows`).
6. **A confirmed change retires the older changes it supersedes, and only those** (`seq`) — bug 3.
7. **An opId describes the bytes sent with it** — bug 4.
8. **Queue row rewrites use `updates`, not `adds`** — only `update` upserts on every plugin (bug 6).
9. **`maxAgeMs: 0` means always stale** (inclusive comparison).
10. **An update sends keys + changed fields; an empty delta means the whole entity.** Keys alone
    would be a well-formed request that silently drops the edit.
11. **Partial update payloads merge in the queue.** Rows are keyed by (collection, kind, ids), so
    a second update replaces the first row — without merging the field sets, the earlier edit
    never reaches the server.
12. **Flushes are single-flight.** Three triggers (timer, `online`, `syncNow`) can coincide; two
    concurrent flushes re-send the same rows, which is the app flooding its own server.
13. **Every outbound call goes through the pacer.** Reads share by cache key, writes serialize by
    collection. A new call site that reaches the network directly is a hole in this.

---

## 7. Remaining work

**7a. Finish the mutation sweep.** `stryker/replication.mjs` + `stryker/jest.replication.js` +
`stryker/replication.setup.js` work (`npm run mutate:replication`, gate 80). The setup file caps
chaos at 3 seeds and silences the logger. Measured:

| Scope | Mutants | Before → after | Notes |
|---|---|---|---|
| `httpUtils.ts` | 104 | 85.05% → **99.01%** | 1 survivor, equivalent-only |
| `UnsyncedQueue.ts` | 269 | 63.68% → **83.96%** | 30 survivors, classified in the backlog |
| `auth.ts` | 35 | 27.78% → **88.89%** | 2 survivors, annotated inline |
| `HttpSwrDbPlugin.ts`, `HttpDbPlugin.ts`, `PluginSyncEngine.ts`, `OptimisticUpdatesDbPlugin.ts` | — | not yet run | `HttpSwrDbPlugin.ts` alone is ~1 300 lines |

Budget ~3 min per 100 mutants. Run per file and record each score. Convention for survivors: kill
with a targeted test, or annotate `// Stryker disable next-line <Mutator>` **with a written
justification** (see the two in `httpUtils.ts`). No config-side exclusion lists.

**7b. The survivor analysis lives in `docs/mutation-backlog.md`** (the "Area:
`plugins/replication`" section): 18 of the remaining 32 are log-message/payload mutants, ~8 are
provably equivalent guards, 4 depend on a store that rejects unknown row ids, and 2 are the
documented `auth.ts` redundancy. Read it before writing more tests for this area.

**7c. Raise the gate.** 80 was chosen before any score existed. Once the package has a number, set
`break` just under it (expressions sits at 90).

**7d. `translatePersistResponse` on the flush path.** Still unapplied there: the flush has queue
rows, not a `CompiledSchema`. Either stash the schema id on the row and resolve it from a
registry, or accept the limitation and document it.

**7e. Docs.** `docs/` and `examples/from-docs/guides/http-swr-with-optimistic/` describe these
plugins. Undocumented outside this file: the exported option/callback types, the `meta.opIds` wire
block, `onSyncDeadLetter`/`onConflict`/`translatePersistResponse`, and the whole §8 sync API.
`examples/sync-engine-dexie/` (Node + browser) is the closest thing to documentation today.

**7g. Two core defects were found by the stress page and are now fixed** — `specs/known-defects.md`
#25 (mutating a pending addition threw out of `saveChangesAsync` *after* the write landed) and #26
(a `proxy()` collection's query results carried an enumerable `__tracking__`). Both were in
`datastore`/core, not here. #25 is fixed by `IAdditions.reindex()` called from `prepareAdditions`;
#26 by using `Object.defineProperty` on the proxy's lazy tracking install. Eight new tests, and the
whole repo is green at 5,889.

**7f. Nothing is committed.** Phases A, B and C are uncommitted working tree on `v0.2.2`, mixed in
with the unrelated parser/SQL work. Split before committing.

Small note: the two `.catch((): void => undefined)` annotations that remain in `HttpSwrDbPlugin`
exist because tsc emitted TS7011 on bare `() => undefined` — leave them.

---

## 8. The sync API (added 2026-08-04)

Replay was always automatic but entirely private — no way to trigger it, observe it, or turn it
off. Now:

**Automatic, unchanged by default.** Unsynced changes retry on a backing-off timer (1 s → 60 s,
resetting after a productive flush) and immediately on the browser's `online` event.

**Overrides** on `HttpSwrDbPluginOptions`:

```ts
autoSync?: false | { delayMs?: number; maxDelayMs?: number; onOnline?: boolean }
onSync?: (outcome: SyncOutcome) => void   // after every flush, automatic or manual
```

`autoSync: false` stops all automatic replay but **not** queueing — changes are still recorded
durably before every ack. `delayMs` falls back to `bulkPersistRetryBaseDelayMs` for back-compat:
those used to be one number, conflating "how patiently one request retries" with "how often the
queue drains". New code should set them separately.

**Public methods** on `HttpSwrDbPlugin`:

```ts
syncNow(): Promise<SyncOutcome>                                    // flush now
pendingCount(): Promise<number>                                    // for a UI badge
deadLetters(): Promise<UnsyncedQueueRow[]>                         // what the queue gave up on
retryDeadLetters(): Promise<{ revived: number; outcome: SyncOutcome }>
```

`retryDeadLetters` is the only new behaviour (`UnsyncedQueue.revive`): dead-lettering is
deliberately one-way, so reviving is always explicit — something outside the queue must have
changed for a retry to make sense.

Exported from `src/index.ts`: `AutoSyncOptions`, `SyncOutcome`, `UnsyncedQueueRow`, alongside the
existing option/callback types, `HttpStatusError` and the status predicates.

### Request pacing (added 2026-08-04)

Everything that leaves the process is now paced. `RequestPacer` in `httpUtils` provides the two
shapes this needs, deliberately as separate methods:

- **`share(key, work)`** — identical concurrent calls become one. For reads, where the key *is*
  the request.
- **`serialize(key, work)`** — calls for one key never overlap and never start closer together
  than `minIntervalMs`. For writes, which each carry their own payload and cannot be merged.

**Pacing lives in `HttpDbPlugin`, the transport**, because that is the only place HTTP leaves the
process. `HttpSwrDbPlugin` *composes* it (it does not inherit from it — worth knowing, the two are
easy to assume related), and it used to reach around it: a second `RequestTracker` and its own raw
`fetch` for every POST, unpaced. Every write therefore bypassed everything the transport
guaranteed. That duplication is gone — SWR now calls `httpPlugin.postJson(...)`, owns no tracker,
and does not abort anything itself.

| Path | Where | Pacing |
|---|---|---|
| GET (any caller, including standalone use) | `HttpDbPlugin.getShared` | `share` by URL |
| POST (both plugins) | `HttpDbPlugin.postJson` | `serialize` by collection |
| Cache-miss fetch **and store write** | `HttpSwrDbPlugin.missPacer` | `share` by cache key |
| Revalidate fetch **and store write** | `HttpSwrDbPlugin.missPacer` | `share` by cache key |
| Flush | `HttpSwrDbPlugin.requestFlush` | single-flight + `autoSync.minIntervalMs` (default 250) |

Two layers of read dedup, each earning its place: the transport dedupes the *request* for anybody;
SWR dedupes the *work* (fetch plus store write) so five components on a cold collection do not each
write it to the store. **This was a bug before**: revalidate deduplicated but cache-miss did not, so
first paint with five components on one query opened five connections.

- **Single-flight flush.** `requestFlush` is the only way a flush starts. A caller arriving
  mid-flush is given a shared *follow-up* rather than the running flush — it may have just enqueued
  a change the running flush has already read past, and reporting success for that would be a lie.
- **`minRequestIntervalMs`** (default 100) lives on `HttpPluginOptions`, so it applies to
  `HttpDbPlugin` used directly and is inherited by `HttpSwrDbPluginOptions`. It is the floor
  between two requests for the same URL (reads) or collection (writes).
- **`postOnPersist: false`** hands write delivery to the paced flush instead of POSTing per save.
  One request per collection per flush, however many saves went into it. Measured in the browser
  demo: **10 rapid saves cost 10 POSTs by default and 1 POST with this on.** The costs are up to
  `autoSync.delayMs` of latency and no echo reconciliation (§7d). Default stays `true` so existing
  behaviour and `translatePersistResponse` are unchanged.

Two implementation notes that cost a debug cycle each, worth knowing before touching this:

- **Cleanup must be chained into the promise the caller awaits**, not attached as a side branch.
  A side branch runs a microtask later, so `await pacer.share(k, w)` followed immediately by
  another `share(k, w)` was handed the call it had just consumed. Same for the pending counter.
- **A shared read cannot hand every caller the same result object.** An `ITranslatedValue` is
  consumed by reading it, so the first caller got the rows and the rest got nothing. The shared
  work now fetches *and stores*, and each caller reads its own answer out of the store — which also
  applies each caller's own filter.
- **`pendingCount()` counts calls waiting at the gate**, because "no socket is open" stopped
  meaning "nothing is on its way out". The chaos driver's idle check reads
  `httpPlugin.pendingRequestCount()` for exactly this reason.
- **A shared GET returns the response TEXT, and each caller parses its own copy.** `JsonTranslator`
  deserializes in place (`field.property.setValue(data[i], …)`) and sorts in place, so two callers
  translating one parsed body corrupt each other's results. One extra `JSON.parse` per caller is
  cheap next to a duplicate round trip; sharing the object graph is simply wrong.

Measured in the browser demo, ten rapid saves: **10 POSTs by default** (now spaced ~100 ms apart
rather than fired at once) and **1 POST carrying 10 adds** with `postOnPersist: false`. Pacing bounds
the *rate*; coalescing reduces the *count*.

`PluginSyncEngine` has **no** equivalent and is not getting one: it mirrors best-effort by design.
If a write must survive an outage, that is what `HttpSwrDbPlugin` is for. The browser demo
switches between the two stacks so the difference is visible.
