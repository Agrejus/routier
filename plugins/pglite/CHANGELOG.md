# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 0.3.0 (2026-08-25)

### Features

* **reads:** results may cross the worker boundary columnar, measured at 1.23x through the plugin
  with identical entities. PGlite's own proxy carries every result over a `BroadcastChannel`, which
  cannot transfer anything, so a large result was structured-cloned — 19-34% of a read.
* **worker:** routier now answers reads on its own channel beside PGlite's proxy rather than
  replacing it, which keeps PGlite's leader election intact. Only the leader's worker holds a
  database; a follower's answers "unavailable" and that tab uses the proxy, reaching the leader
  the ordinary way.
* **plugin:** new `codec` option — `false` sends every read through PGlite's proxy, which is what
  a follower tab does anyway.
