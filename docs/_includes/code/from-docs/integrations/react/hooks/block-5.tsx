import { useQuery } from "@routier/react";
import { useDataStore } from "../useDataStore";
import { useMemo } from "react";

export function SortedProducts() {
  const dataStore = useDataStore();

  // Sort products by name
  const products = useQuery(
    (callback) =>
      dataStore.products
        .subscribe()
        .sort((p) => p.name)
        .toArray(callback),
    [dataStore]
  );

  if (products.status === "pending") return <div>Loading...</div>;
  if (products.status === "error")
    return <div>Error: {products.error.message}</div>;

  return (
    <ul>
      {products.status === "success" &&
        products.data.map((product) => (
          <li key={product.id}>
            {product.name} - ${product.price}
          </li>
        ))}
    </ul>
  );
}
