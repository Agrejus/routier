import { createSignal } from "solid-js";
import { createLiveQuery } from "@routier/solid";
import { store, type Product } from "../../home/inventory";

export const pageSize = 6;

export function createProductPage() {
  const [page, setPage] = createSignal(1);

  const rows = createLiveQuery<Product[]>((onResult) =>
    store.products
      .sort((p) => p.name)
      .skip((page() - 1) * pageSize)
      .take(pageSize)
      .subscribe()
      .toArray(onResult),
  );

  const products = () => {
    const state = rows();
    return state.status === "success" ? state.data : [];
  };

  const error = () => {
    const state = rows();
    return state.status === "error" ? state.error.message : null;
  };

  return { page, setPage, products, error };
}
