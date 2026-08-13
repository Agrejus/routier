import { useQuery } from "@routier/react";
import { useDataStore } from "./hooks/useDataStore";

function ProductsList() {
  const dataStore = useDataStore(); // Must be memoized in useDataStore hook

  const products = useQuery(
    (callback) => dataStore.products.subscribe().toArray(callback),
    [dataStore]
  );

  if (products.status === "pending") return <div>Loading...</div>;
  if (products.status === "error") return <div>Error!</div>;

  return (
    <ul>
      {products.status === "success" &&
        products.data.map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
    </ul>
  );
}