# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.6.0 (2026-08-25)

### Features

* **transfer:** new `@routier/core/transfer` subpath — a columnar codec for moving query results
  across an in-process worker boundary. Values cross as typed arrays whose buffers are transferred
  rather than copied, and the decoder is a generated function emitting final-shape rows.
  Engine-agnostic: encodings name a value shape, so a date is accepted as a `Date`, an epoch
  number or text, and a nested value as JSON text or as a live object.
* **plugins:** `ResultColumn` and `mappedResultColumns` — a description of what a statement
  returns, produced by a plugin's builder. A description, not an instruction; `buildTransferPlan`
  is one consumer of it and is not privileged.

## 0.0.1-alpha.1 (2025-09-18)

**Note:** Version bump only for package @routier/core
