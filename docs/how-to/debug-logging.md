---
title: Debug Logging
layout: default
parent: Data Operations
nav_order: 4
---

# Debug Logging

Routier plugins and the core library emit debug logs (e.g., `logger.debug`, `logger.warn`) for query lifecycle, sync operations, hydration, and errors. By default, these logs are only shown in development environments. This guide explains how to turn logging on and off.

## Quick Navigation

- [Default Behavior](#default-behavior)
- [Enabling Logging](#enabling-logging)
- [Disabling Logging](#disabling-logging)
- [Vite Applications](#vite-applications)
- [Related Topics](#related-topics)

## Default Behavior

Logging is enabled when any of these conditions are true:

| Environment | Condition |
|-------------|-----------|
| Node.js | `process.env.NODE_ENV` is `dev`, `development`, or `test` |
| Node.js | `process.env.DEBUG` is `routier` or `*` |
| Vite / bundlers with `import.meta.env` | `import.meta.env.DEV === true` or `import.meta.env.MODE` is dev/development/test |

When none of these apply, logging is disabled.

## Enabling Logging

### Option 1: Global override (all environments)

Set `globalThis.__ROUTIER_DEBUG__ = true` **before** any routier imports. This works in Node, browser, and Vite.


{% highlight ts linenos %}{% include code/from-docs/how-to/debug-logging/block-1.ts %}{% endhighlight %}


### Option 2: Node.js / bundlers with process.env

```bash
# Enable for development
NODE_ENV=development npm run dev

# Or explicitly enable debug logging
DEBUG=routier npm run dev

# Enable all debug (matches routier and other DEBUG users)
DEBUG=* npm run dev
```

### Option 3: Vite

Routier is built with rspack, which replaces `import.meta.env` with `undefined` in the bundle. In a Vite app, you must use the global override:


{% highlight tsx linenos %}{% include code/from-docs/how-to/debug-logging/block-3.tsx %}{% endhighlight %}


## Disabling Logging

Logging is off when:

- `NODE_ENV` is `production` (and `DEBUG` is not set)
- `import.meta.env.DEV` is `false` (and no override)
- `globalThis.__ROUTIER_DEBUG__` is not set or is `false`

To force logging off in development, set:


{% highlight ts linenos %}{% include code/from-docs/how-to/debug-logging/block-4.ts %}{% endhighlight %}


Note: Disabling is rarely needed; the default behavior already suppresses logs in production.

## Vite Applications

For Vite apps, the global override is required because:

1. Routier is pre-bundled with rspack, which replaces `import.meta.env` with `undefined`.
2. In the browser, `process` is typically undefined, so `process.env` checks do not run.

Add the override at the top of your entry file (before any routier imports):


{% highlight tsx linenos %}{% include code/from-docs/how-to/debug-logging/block-5.tsx %}{% endhighlight %}


See [React Best Practices - Debug Logging in Vite](/integrations/react/best-practices/#debug-logging-in-vite) for the same pattern in a React context.

## Related Topics

- [React Best Practices](/integrations/react/best-practices/) – Debug logging setup for Vite + React
- [Optimistic Replication](/guides/optimistic-replication/) – Uses debug logs for hydration and sync
- [Syncing](/guides/syncing/) – Uses debug logs for sync lifecycle
