import { useQuery } from "@routier/react";
import { useDataStore } from "../useDataStore";

export function MultipleQueries() {
  const dataStore = useDataStore();

  // Multiple independent queries in one component
  const products = useQuery(
    (callback) => dataStore.products.subscribe().toArray(callback),
    [dataStore]
  );

  const categories = useQuery(
    (callback) => dataStore.categories.subscribe().toArray(callback),
    [dataStore]
  );

  const productCount = useQuery(
    (callback) => dataStore.products.subscribe().count(callback),
    [dataStore]
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
