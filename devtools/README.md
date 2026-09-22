# @routier/devtools

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

An in-page drawer that shows what a Routier store holds: every collection and view with a live row
count, a paged table of rows, and the full value of any row. It updates as data changes, and works
the same in React, Vue, any other framework, or plain JavaScript.

## Install

```bash
npm install --save-dev @routier/devtools
```

## Use

```ts
import { mountRoutierDevtools } from "@routier/devtools";

const unmount = mountRoutierDevtools(store);
```

A **Routier** button appears in the corner of the page. Click it to open the drawer.

- Mount several stores and they share one drawer behind a store picker. Pass `{ name: "App" }` to
  label a store.
- Mounting the same store twice does nothing. Without a `document` (server, Worker) mounting does
  nothing.
- `unmount()` removes the store and every subscription devtools started.

## Production

In a production build (`process.env.NODE_ENV === "production"`) `mountRoutierDevtools` does nothing
and your bundler drops the drawer from the bundle.

To debug a live site, import `@routier/devtools/production`, which always mounts. **It shows every
row of every collection to anyone who can open the page.** Keep it behind a flag only your team can
turn on.

Values are shown unmasked, exactly as your app reads them.

## Documentation

See the [devtools guide](https://routier.dev/integrations/devtools/), which also covers
`dataStore.inspect()` for building your own tooling.
