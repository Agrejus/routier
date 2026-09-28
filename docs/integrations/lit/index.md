---
title: Lit
description: "Use Routier in Lit and other web components with LiveQueryController."
---

# Lit Integration

`@routier/lit` provides `LiveQueryController`, a Lit reactive controller that follows a Routier live query and re-renders its host when the result changes. It relies only on Lit's `ReactiveControllerHost` interface, so it also works in any web component that implements that interface.

## Installation

```bash
npm install @routier/lit
# peer dependency
npm install lit
```

## LiveQueryController

```ts
new LiveQueryController<T>(host, { query });
new LiveQueryController<T, TArgs>(host, { args: () => [...], query: (args) => query });
```

`controller.state` holds a discriminated union. Narrow on `status` before reading `data` or `error`:

| `status`    | Fields                          |
| ----------- | ------------------------------- |
| `"pending"` | `loading: true`                 |
| `"success"` | `data: T`, `isSuccess: true`    |
| `"error"`   | `error: Error`, `isError: true` |

- **Connect and disconnect.** The query runs when the host connects and stops when it disconnects. Reconnecting starts again from `pending`.
- **Args.** With `args`, the controller compares the returned values before every host update, using `Object.is` on each one. If any changed, it stops the previous query and runs `query` with the new values. Without `args`, the query never re-runs while connected.
- **Updates.** Every result calls `host.requestUpdate()`.

## Example

<<< @/_snippets/code/integrations/lit/product-list.ts

`store` and `Product` come from a shared module, the same one the [Vue page](/integrations/vue/) uses.
