---
title: Debug Logging
---

# Debug Logging

Routier plugins and the core library emit logs (`logger.debug`, `logger.warn`, `logger.error` and friends) for query lifecycle, sync operations, hydration, and errors. Logging is **off unless you ask for it**, apart from in a development environment. This guide explains how to control it.

## Quick Navigation

- [Levels](#levels)
- [Default Behavior](#default-behavior)
- [Enabling Logging](#enabling-logging)
- [Disabling Logging](#disabling-logging)
- [Changing the level at runtime](#changing-the-level-at-runtime)
- [Vite Applications](#vite-applications)
- [Related Topics](#related-topics)

## Levels

Each level includes everything above it in this table. `silent` discards everything.

| Level | Includes |
|-------|----------|
| `silent` | nothing |
| `error` | `logger.error` |
| `warn` | + `logger.warn` |
| `info` | + `logger.info`, `logger.log` |
| `debug` | + `logger.debug`, `logger.table` |

## Default Behavior

The level is resolved once, when Routier is first imported, from the first of these that applies:

| Precedence | Source | Result |
|-----|--------|--------|
| 1 | `globalThis.__ROUTIER_LOG_LEVEL__` | that level |
| 2 | `globalThis.__ROUTIER_DEBUG__ === true` / `=== false` | `debug` / `silent` |
| 3 | `process.env.ROUTIER_LOG_LEVEL` | that level |
| 4 | `process.env.DEBUG` is `routier` or `*` | `debug` |
| 5 | `process.env.NODE_ENV` is `dev` or `development` | `debug` |
| 6 | nothing above applies | `silent` |

An unrecognised level name is ignored rather than throwing, and resolution continues down the table — a typo in configuration will not take an application down.

::: warning `NODE_ENV=test` does not enable logging
It used to. That meant every test suite running against Routier logged whether it wanted to or not, and the cost is not small: test runners capture console output by snapshotting a stack trace per call, so a suite driving a few thousand saves through a plugin that logs per query spent roughly half its wall clock on logging it never asked for. Set `ROUTIER_LOG_LEVEL=debug` when a test needs the output.
:::

## Enabling Logging

### Option 1: Global override (all environments)

Set `globalThis.__ROUTIER_DEBUG__ = true` **before** any routier imports. This works in Node, browser, and Vite.


<<< @/_snippets/code/from-docs/how-to/debug-logging/block-1.ts


### Option 2: Node.js / bundlers with process.env

```bash
# Pick a level explicitly — silent, error, warn, info, debug
ROUTIER_LOG_LEVEL=debug npm run dev

# Keep only problems, in production
ROUTIER_LOG_LEVEL=warn npm start

# Development implies debug
NODE_ENV=development npm run dev

# Or use the conventional DEBUG variable
DEBUG=routier npm run dev
DEBUG=* npm run dev
```

### Option 3: Vite

Routier is built with rspack, which replaces `import.meta.env` with `undefined` in the bundle, so Routier cannot read your app's `import.meta.env` — it would see its own build environment. In a Vite app, read `import.meta.env` yourself and set the global:


<<< @/_snippets/code/from-docs/how-to/debug-logging/block-3.tsx


## Disabling Logging

Logging is off by default. It is explicitly off when:

- nothing in the precedence table above applies (so: any environment other than development)
- `globalThis.__ROUTIER_DEBUG__ === false`
- `globalThis.__ROUTIER_LOG_LEVEL__` or `ROUTIER_LOG_LEVEL` is `silent`

To force logging off even in a development environment, set:


<<< @/_snippets/code/from-docs/how-to/debug-logging/block-4.ts


This takes precedence over `NODE_ENV` and `DEBUG`, so it also silences a process started with `DEBUG=*`.

To keep errors but drop the rest, choose a level instead of switching off entirely:


<<< @/_snippets/code/from-docs/how-to/debug-logging/block-2.ts


## Changing the level at runtime

The precedence table is read once, at import, which is what keeps a suppressed log call cheap (about 3ns, against 70ns for one that is emitted). When verbosity is decided after startup — a debug toggle in a settings panel, or a test that wants to assert on output — use the API:


<<< @/_snippets/code/from-docs/how-to/debug-logging/block-6.ts


`setLogLevel` throws on an unknown level, unlike the environment sources, because a bad literal at a call site is a programming error rather than a configuration mistake.

If you change an environment variable after Routier has been imported, call `resetLogLevel()` to re-read it.

### Guarding an expensive payload

A suppressed call still evaluates its own arguments. That does not matter for an ordinary object — it costs a fraction of a nanosecond next to the call itself — but it does when building the payload is real work, such as serializing a large collection:


<<< @/_snippets/code/from-docs/how-to/debug-logging/block-3.ts


## Vite Applications

For Vite apps, the global override is required because:

1. Routier is pre-bundled with rspack, which replaces `import.meta.env` with `undefined`.
2. In the browser, `process` is typically undefined, so `process.env` checks do not run.

Add the override at the top of your entry file (before any routier imports):


<<< @/_snippets/code/from-docs/how-to/debug-logging/block-5.tsx


See [React Best Practices - Debug Logging in Vite](/integrations/react/best-practices/#debug-logging-in-vite) for the same pattern in a React context.

## Related Topics

- [React Best Practices](/integrations/react/best-practices/) – Debug logging setup for Vite + React
- [Optimistic Replication](/guides/optimistic-replication) – Uses debug logs for hydration and sync
- [Syncing](/guides/syncing) – Uses debug logs for sync lifecycle
