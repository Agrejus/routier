import { derived, writable } from "svelte/store";
import { liveQuery, type LiveQueryState } from "@routier/svelte";
import { store, type Product } from "../../home/inventory";

export const pageSize = 6;
export const page = writable(1);

export const rows = derived<typeof page, LiveQueryState<Product[]>>(page, ($page, set) =>
  liveQuery<Product[]>((onResult) =>
    store.products
      .sort((p) => p.name)
      .skip(($page - 1) * pageSize)
      .take(pageSize)
      .subscribe()
      .toArray(onResult),
  ).subscribe(set),
);

export const total = liveQuery<number>((onResult) => store.products.subscribe().count(onResult));
