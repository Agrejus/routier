import { useQuery } from "@routier/react";
import { useDataStore } from "../useDataStore"; // Your app's context

export function ProductsList() {
  const dataStore = useDataStore();

  // Subscribe to live query results
  const products = useQuery(
    (callback) => dataStore.products.subscribe().toArray(callback),
    [dataStore]
  );

  // Handle loading state
  if (products.status === "pending") {
    return <div>Loading...</div>;
  }

  // Handle error state
  if (products.status === "error") {
    return <div>Error: {products.error?.message}</div>;
  }

  // Render data
  return (
    <ul>
      {products.data?.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
