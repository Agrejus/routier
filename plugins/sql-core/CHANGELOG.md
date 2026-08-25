# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.6.0 (2026-08-25)

### Features

* **result shape:** `entityResultColumns` describes the columns an entity SELECT projects — root
  properties under their storage names. It lives here rather than in core because "one column per
  nested subtree, named for its root" is a fact about flat tables; a store that nests natively has
  no such rule.
* **joins:** `buildJoinStatement` now returns the `columns` it projected, aliased per side. A
  description derived separately can disagree with the select list it describes, and the wrong
  order does not fail — it files every column's values under another column's name.
