import { computed, signal } from "@angular/core";
import { fromLiveQuery, injectLiveQuery } from "@routier/angular";
import { store, type Product } from "../../home/inventory";

export const pageSize = 6;

export function injectProductPage() {
  const page = signal(1);

  const rows = injectLiveQuery<Product[]>((onResult) =>
    store.products
      .sort((p) => p.name)
      .skip((page() - 1) * pageSize)
      .take(pageSize)
      .subscribe()
      .toArray(onResult),
  );

  const names = computed(() => {
    const state = rows();
    return state.status === "success" ? state.data.map((p) => p.name) : [];
  });

  return { page, rows, names };
}

export const total$ = fromLiveQuery<number>((onResult) => store.products.subscribe().count(onResult));
