# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.5.0 (2026-08-25)

### Bug Fixes

* **wasm:** two stores writing at once could silently lose updates. The worker holds ONE connection
  per database and every `WasmConnection` was a handle to it, so a save's `BEGIN IMMEDIATE`,
  statements and `COMMIT` — separate messages — interleaved with another store's: the second
  `BEGIN` failed with "cannot start a transaction within a transaction", and statements were
  committed or rolled back with the wrong transaction. Turns are now serialised per database, the
  same shape `pgliteDriver` already used. Only the browser driver was affected, and only with
  concurrent writers; `node:sqlite` opens a real connection per operation and was always isolated.

### Features

* **wasm:** reads are roughly twice as fast. Column values are read through SQLite's raw WASM
  exports instead of `Stmt.get`, which spent three wrapped calls per value and routed every
  integer through `BigInt` (3.2x on extraction alone), and results may cross the worker boundary
  columnar (a further 1.13-1.27x on large reads).
* **wasm:** new `codec` option on `wasmDriver` — `false` sends results through the ordinary clone
  path. A page whose Content-Security-Policy forbids generated functions takes that path anyway.

## 0.0.1-alpha.1 (2025-09-18)

**Note:** Version bump only for package @routier/sqlite-plugin
