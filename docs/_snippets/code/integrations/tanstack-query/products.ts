import { liveQueryOptions } from "@routier/tanstack-query";
import { store, type Product } from "../../home/inventory";

export const lowStockQuery = (threshold: number) =>
  liveQueryOptions<Product[], ["products", "low-stock", number]>({
    queryKey: ["products", "low-stock", threshold],
    query: (onResult) =>
      store.products
        .where(([p, params]) => p.stock < params.threshold, { threshold })
        .sort((p) => p.stock)
        .subscribe()
        .toArray(onResult),
  });
