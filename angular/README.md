# @routier/angular

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Angular bindings for Routier. `injectLiveQuery` turns a live Routier query into a signal, and `fromLiveQuery` into an RxJS Observable. Requires Angular 19 or later.

## Install

```bash
npm install @routier/angular
# peer dependencies (provided by your app)
npm install @angular/core rxjs
```

## injectLiveQuery

```ts
function injectLiveQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void),
  options?: { injector?: Injector }
): Signal<LiveQueryState<T>>;
```

The state is a discriminated union on `status`:

| `status`    | Fields                          |
| ----------- | ------------------------------- |
| `"pending"` | `loading: true`                 |
| `"success"` | `data: T`, `isSuccess: true`    |
| `"error"`   | `error: Error`, `isError: true` |

- Call it in an injection context, or pass `{ injector }`.
- The query runs in an Angular `effect`. Signals it reads are dependencies: when one changes, the previous subscription stops and the query runs again from `pending`.
- The subscription stops when the injector that created it is destroyed.

## fromLiveQuery

```ts
function fromLiveQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void)
): Observable<LiveQueryState<T>>;
```

Emits `pending`, then every result. Each subscriber runs its own query, and unsubscribing stops it. A failed query arrives as an `error` state rather than an Observable error.

## Example

```ts
import { Component, signal } from "@angular/core";
import { injectLiveQuery } from "@routier/angular";
import { store, type Product } from "./store";

@Component({
  selector: "app-products",
  template: `
    @if (products().status === "success") {
      <p>{{ count() }} products on page {{ page() }}</p>
    }
    <button (click)="page.set(page() + 1)">Next</button>
  `,
})
export class ProductsComponent {
  readonly page = signal(1);
  readonly products = injectLiveQuery<Product[]>((onResult) =>
    store.products.skip((this.page() - 1) * 10).take(10).subscribe().toArray(onResult),
  );
  readonly count = () => {
    const state = this.products();
    return state.status === "success" ? state.data.length : 0;
  };
}
```

## Notes

- Angular is a peer dependency and is not bundled.
- The package builds to ESM and CJS and ships TypeScript declarations.

Full guide: https://routier.dev/integrations/angular/
