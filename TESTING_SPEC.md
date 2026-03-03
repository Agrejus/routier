# Routier Testing Spec

This file is the canonical reference for writing tests in this repository.

## Purpose

- Ship production-ready behavior with high confidence.
- Prefer testing real interactions between modules over isolated implementation details.
- Catch regressions early by validating public contracts and edge cases.

## Testing Strategy (Integration-First)

Use this target distribution for new tests:

- **Integration tests: 65%** (primary investment)
- **Unit tests: 25%** (core logic only)
- **Contract/smoke tests: 10%** (cross-package and API stability)

If there is uncertainty, write an integration test first.

## Test Types

### Integration Tests (Preferred)

Integration tests validate interactions between components through public APIs.

Examples:

- `schema` compile + generated handlers + runtime behavior (`prepare`, `deserialize`, `compare`, `hash`)
- `datastore` query pipeline + change tracking + plugin interaction
- collection operations (`add/update/remove`) + persistence + subscriptions

Rules:

- Use real classes and public entry points.
- Mock only true boundaries (network, clock, random when needed).
- Assert behavior and outcomes, not internal private state.

### Unit Tests (Selective)

Unit tests are for tight, high-value logic with deterministic inputs.

Examples:

- pure parser/utility functions
- deterministic transformations
- small error-guard logic

Rules:

- Keep tests small and fast.
- Do not duplicate integration coverage.

### Contract/Smoke Tests

Use for package entrypoints and critical compatibility checks.

Examples:

- exported APIs compile and execute
- core plugin contracts remain stable
- minimal "can wire up" checks across packages

## Scope Priorities

### `core`

Prioritize integration scenarios around:

- schema compilation pipeline
- codegen handler chains (prepare/merge/clone/deserialize/serialize/set)
- schema modifiers and interactions (`optional`, `nullable`, `default`, `identity`, `key`, `from`, `tracked`, etc.)
- expression parser behavior through query APIs
- plugin contract surfaces in `core/src/plugins`

### `datastore`

Prioritize integration scenarios around:

- `DataStore` + collections + queryables
- `QueryableExecutor` behavior across filters/sorts/pagination/projection/aggregations
- change tracking (attach/detach, dirty tracking, rollback-like flows)
- `DataBridge` and plugin interaction behavior

## Schema Coverage Rules

For schema tests, current supported shape coverage must include:

- primitives: `string`, `number`, `boolean`, `date`
- object depth: **up to 2 levels deep**
- arrays: **array of objects**

Do not add tests for deeper object nesting or unsupported array patterns unless support is being added intentionally.

## Edge Case Checklist

Every relevant integration suite should include:

- null vs undefined behavior
- optional + default interaction
- nullable + deserialize/serialize interaction
- key/identity and ID comparison behavior
- field remapping via `from`
- computed/function property behavior where applicable
- invalid callback/input handling with clear error messages

## Test Design Rules

- Use Arrange-Act-Assert structure.
- Prefer one behavior per test.
- Name tests by behavior, not implementation.
- Avoid brittle assertions on generated internals.
- Avoid snapshot tests for dynamic/circular objects.
- Avoid relying on test execution order.

## Naming Convention

Use:

- `should <expected behavior> when <condition>`

Examples:

- `should deserialize date fields when payload contains ISO strings`
- `should keep attached entity dirty state when property changes twice`

## Bug Policy

- Do not modify tests to hide failures.
- If a test fails unexpectedly, treat it as a potential product bug.
- Keep the failing test and report:
  - reproduction path
  - expected vs actual behavior
  - suspected module(s)

## Release Gate (Testing)

Before release:

- Critical integration suites in `core` and `datastore` pass.
- New behavior includes at least one integration test.
- Edge case checklist is covered for changed areas.
- No skipped tests without a tracked follow-up item.

## PR Expectations

For testing-related changes in PRs:

- Explain why integration vs unit was chosen.
- List scenarios covered.
- List intentional gaps (if any).
- Include failing tests first when fixing bugs (red -> green).
