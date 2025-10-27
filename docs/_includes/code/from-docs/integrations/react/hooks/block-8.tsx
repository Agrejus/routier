import { useQuery } from "@routier/react";
import { useDataStore } from "../useDataStore";

export function MultipleQueries() {
  const dataStore = useDataStore();

  // Multiple independent queries in one component
  const products = useQuery(
    (callback) => dataStore.products.subscribe().toArray(callback),
    []
  );

  const categories = useQuery(
    (callback) => dataStore.categories.subscribe().toArray(callback),
    []
  );

  const productCount = useQuery(
    (callback) => dataStore.products.subscribe().count(callback),
    []
  );

  if (products.status === "pending" || categories.status === "pending") {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <p>Products: {productCount.data}</p>
      <ul>
        {products.data?.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}
