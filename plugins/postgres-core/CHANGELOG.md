# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.3.0 (2026-08-25)

### Features

* **statements:** `SqlOperation.result` carries the columns a statement returns, in order, built
  beside the select list rather than parsed back out of the SQL. A description, not an
  instruction — a driver that pays to move rows across a worker boundary can encode them
  columnar, and every server-backed driver ignores it.
* **drivers:** `PostgresConnection.all` takes an optional third argument for that description.
  Additive: a two-parameter implementation still satisfies the interface.
