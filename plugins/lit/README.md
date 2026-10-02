# @routier/lit

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

A Lit reactive controller for Routier. `LiveQueryController` follows a live Routier query and re-renders its host when the result changes.

## Install

```bash
npm install @routier/lit
# peer dependencies (provided by your app)
npm install lit
```

## LiveQueryController

```ts
new LiveQueryController<T>(host, { query });
new LiveQueryController<T, TArgs>(host, { args: () => [...], query: (args) => query });
```

`controller.state` holds the result. The state is a discriminated union on `status`:

| `status`    | Fields                          |
| ----------- | ------------------------------- |
| `"pending"` | `loading: true`                 |
| `"success"` | `data: T`, `isSuccess: true`    |
| `"error"`   | `error: Error`, `isError: true` |

- The query runs when the host connects and stops when it disconnects.
- With `args`, the values are compared with `Object.is` before each host update. If any changed, the previous query stops and `query` runs with the new values.
- Every result calls `host.requestUpdate()`.

## Example

```ts
import { LitElement, html } from "lit";
import { LiveQueryController } from "@routier/lit";
import { store, type Product } from "./store";

class ProductList extends LitElement {
  static properties = { category: { type: String } };
  category = "tools";

  private products = new LiveQueryController<Product[], readonly [string]>(this, {
    args: () => [this.category] as const,
    query: ([category]) => (onResult) =>
      store.products.where(([p, params]) => p.category === params.category, { category }).subscribe().toArray(onResult),
  });

  render() {
    const state = this.products.state;
    return state.status === "success"
      ? html`<ul>${state.data.map((p) => html`<li>${p.name}</li>`)}</ul>`
      : html`<p>Loading…</p>`;
  }
}

customElements.define("product-list", ProductList);
```

## Notes

- Lit is a peer dependency and is not bundled.
- The package builds to ESM and CJS and ships TypeScript declarations.

Full guide: https://routier.dev/integrations/lit/
