# Monorepo Testing Plan

This plan is aligned with `TESTING_SPEC.md` and is intended to be the execution reference for making the repository production-ready.

## Scope

Packages in scope:

- `core`
- `datastore`
- `react`
- `plugins/*`
- `test-utils`

Out of scope by default unless requested:

- `docs`
- `examples`

## Guiding Strategy

Integration-first test portfolio target:

- Integration tests: ~65%
- Unit tests: ~25%
- Contract/smoke tests: ~10%

Policy:

- Failures are treated as potential product bugs.
- Do not weaken tests to pass.
- Unit tests focus on core deterministic logic.
- Integration tests verify real interaction paths between modules.
- Any discovered bug must be confirmed with a human before implementation changes are finalized.
- For exception-related failures, confirm expected behavior with a human: should this path throw a specific/domain error, or is an uncaught exception acceptable?

## Current Coverage Snapshot

Approximate current file/test distribution:

- `core`: 194 TS files, 18 tests
- `datastore`: 48 TS files, 2 tests
- `react`: 1 TS file, 0 tests
- `test-utils`: 3 TS files, 0 tests
- `plugins/replication`: 10 TS files, 1 test
- `plugins/mysql`: 4 TS files, 0 tests
- `plugins/postgresql`: 4 TS files, 0 tests
- `plugins/browser-storage`: 3 TS files, 0 tests
- `plugins/memory`: 37 TS files, 15 tests
- `plugins/pouchdb`: 20 TS files, 6 tests
- `plugins/sqlite`: 10 TS files, 3 tests
- `plugins/dexie`: 9 TS files, 2 tests
- `plugins/file-system`: 21 TS files, 1 test

## Release Gate Criteria

A package is release-ready when:

- Public API paths are covered.
- Edge-case checklist is covered for changed areas.
- Critical integration suites pass.
- No skipped critical tests.
- New behavior ships with at least one integration test.

## Cross-Cutting Edge-Case Checklist

Every relevant suite should include:

- `null` vs `undefined` behavior
- optional + default interactions
- nullable + serialize/deserialize interactions
- key/identity and ID comparison behavior
- mapping/remap via `from`
- computed/function behavior where applicable
- invalid callback/input handling with explicit errors

## Schema Coverage Envelope (Current Product Scope)

For schema tests:

- primitives: `string`, `number`, `boolean`, `date`
- object depth: up to 2 levels
- arrays: array of objects

Do not add deeper object depth or unsupported array patterns unless support is intentionally expanded.

## Phased Execution Plan

### Phase A: Core + Datastore (Highest Priority)

#### A1. Core integration expansion

Focus areas:

- schema compilation pipeline
- codegen handler chains (`prepare`, `merge`, `set`, `clone`, `deserialize`, `serialize`, `compare`, `hash`)
- schema modifier interactions
- expression parser behavior through real query flows
- plugin contract surfaces in `core/src/plugins`

Deliverables:

- capability-focused integration suites for schema behavior
- regression tests for each bug uncovered
- selective unit tests for parser/util pure logic only

#### A2. Datastore integration expansion

Focus areas:

- `DataStore` lifecycle (`previewChanges`, `hasChanges`, `saveChanges`)
- `CollectionBase` CRUD + attachment semantics
- `QueryableExecutor` behavior for filter/sort/pagination/map/aggregates
- `DataBridge` and plugin interaction boundaries
- change tracking lifecycle

Deliverables:

- scenario-driven integration suites covering full query/persist paths
- targeted unit tests for deterministic utility modules only

### Phase B: Plugin Interoperability and Replication

#### B1. Plugin conformance matrix

Build a shared fixture suite and run against:

- memory
- sqlite
- pouchdb
- dexie
- file-system
- mysql
- postgresql
- browser-storage

Conformance checks:

- CRUD
- query operation parity
- bulk persist semantics
- error mapping consistency
- destroy/lifecycle behavior

#### B2. Replication integration depth

Focus areas in replication plugin stack:

- optimistic local-first persist path
- unsynced queue behavior
- retry/backoff behavior
- auth error signaling
- revalidate merge classification

Deliverables:

- integration tests with deterministic failure injection
- regression tests for edge paths

### Phase C: Stability Net + Release Hardening

Focus areas:

- contract/smoke coverage of package exports and wiring
- flaky/open-handle elimination
- CI gating and deterministic execution

Deliverables:

- required CI jobs for critical integration suites
- package-level release checklist completion
- documented residual risk list (if any)

## Repo-by-Repo Test Plan

### Core

Integration:

- schema compile/run
- modifier interactions
- codegen runtime paths
- expression parsing via real query APIs
- plugin contracts

Unit:

- deterministic utility and parser helpers only

### Datastore

Integration:

- full DataStore and collection workflows
- query execution matrix
- change tracking and attachment semantics
- plugin bridge boundaries

Unit:

- deterministic builders/matchers/payload utilities

### Plugins/Replication

Integration:

- optimistic write + async sync
- retry/auth/revalidate flows
- queue persistence/recovery behavior

Unit:

- minimal utility coverage only

### Memory, SQLite, PouchDB, Dexie

Integration:

- adapter conformance and parity
- query/persist behavior consistency

### MySQL, PostgreSQL, File-System, Browser-Storage

Integration:

- core adapter startup + CRUD + query + bulk paths
- boundary/error behavior

### React

Integration:

- hooks + live query updates
- subscription cleanup
- optimistic UI consistency with datastore events

### Test-Utils

Unit/Smoke:

- fixture/data generator determinism
- helper correctness and API stability

## Test Architecture and Folder Conventions

Recommended structure per package:

- `src/__tests__/integration/...`
- `src/__tests__/unit/...`
- `src/__tests__/contract/...`

Naming convention:

- `should <expected behavior> when <condition>`

Design conventions:

- Arrange-Act-Assert
- one behavior per test
- avoid brittle internal assertions
- avoid snapshots for dynamic/circular objects

## CI Execution Model

Required jobs:

1. fast unit + smoke (all packages)
2. core + datastore integration
3. plugin conformance matrix
4. replication long-running integration

Release branch policy:

- all required jobs green
- no skipped critical tests
- no unresolved failing regressions

## Implementation Order and Milestones

### Milestone 1

- complete Phase A1 (`core`)
- publish uncovered bug list with repro tests

### Milestone 2

- complete Phase A2 (`datastore`)
- validate core+datastore integration gate

### Milestone 3

- complete Phase B (plugin conformance + replication)

### Milestone 4

- complete Phase C and release hardening

## Tracking and Reporting

For each milestone:

- list new tests added by package
- list uncovered bugs and status
- list remaining risk areas
- confirm release gate criteria status
- for each discovered bug, include a human-confirmation note with:
  - expected behavior decision
  - whether a specific error type/message is required
  - final resolution status
