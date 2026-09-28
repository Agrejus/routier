---
title: Angular
description: "Use Routier in Angular with injectLiveQuery (a signal) or fromLiveQuery (an Observable)."
---

# Angular Integration

`@routier/angular` gives Angular two ways to follow a Routier live query:

- **`injectLiveQuery`** returns a signal, and re-queries when signals it reads change.
- **`fromLiveQuery`** returns an RxJS Observable, for the `async` pipe, `toSignal()`, or an existing RxJS pipeline.

## Installation

```bash
npm install @routier/angular
# peer dependencies, already in an Angular app
npm install @angular/core rxjs
```

Requires Angular 19 or later.

## injectLiveQuery

```ts
function injectLiveQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void),
  options?: { injector?: Injector },
): Signal<LiveQueryState<T>>;
```

The signal holds a discriminated union. Narrow on `status` before reading `data` or `error`:

| `status`    | Fields                          |
| ----------- | ------------------------------- |
| `"pending"` | `loading: true`                 |
| `"success"` | `data: T`, `isSuccess: true`    |
| `"error"`   | `error: Error`, `isError: true` |

- **Injection context.** Call it in a constructor, a field initializer, or a factory, like `inject()`. Elsewhere, pass `{ injector }`.
- **Tracking.** The query runs in an Angular `effect`, so any signal it reads becomes a dependency. When one changes, the previous subscription stops, the state returns to `pending`, and the query runs again.
- **Cleanup.** The subscription stops when the component, directive, or service that created it is destroyed.

## fromLiveQuery

```ts
function fromLiveQuery<T>(
  query: (callback: (result: ResultType<T>) => void) => void | (() => void),
): Observable<LiveQueryState<T>>;
```

Each subscriber runs its own query. The Observable emits `pending` first, then every result. A failed query arrives as an `error` state, not as an Observable error, so the stream stays open. Unsubscribing stops the query.

## Example

<<< @/_snippets/code/integrations/angular/products.ts

```ts
import { Component } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { injectProductPage, total$ } from "./products";

@Component({
  selector: "app-product-grid",
  imports: [AsyncPipe],
  template: `
    @switch (rows().status) {
      @case ("error") { <p>Could not load products.</p> }
      @case ("success") {
        <ul>@for (name of names(); track name) { <li>{{ name }}</li> }</ul>
      }
    }
    @if (total$ | async; as total) {
      @if (total.status === "success") { <p>{{ total.data }} products</p> }
    }
    <button [disabled]="page() === 1" (click)="page.set(page() - 1)">‹</button>
    <button (click)="page.set(page() + 1)">›</button>
  `,
})
export class ProductGridComponent {
  private readonly products = injectProductPage();
  readonly page = this.products.page;
  readonly rows = this.products.rows;
  readonly names = this.products.names;
  readonly total$ = total$;
}
```

`store` and `Product` come from a shared module, the same one the [Vue page](/integrations/vue/) uses. In an app, provide the `DataStore` from a service with `providedIn: "root"` so every component shares one instance.

## Server-side rendering

Live queries belong in the browser. With Angular SSR, create the store and its queries only on the client, for example behind `afterNextRender` or an `isPlatformBrowser` check.
