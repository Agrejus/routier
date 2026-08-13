import { useQuery } from "@routier/react";
import { useDataStore } from "./DexieStore"; // Your app's datastore hook/context

export function ProductsList() {
  const dataStore = useDataStore();

  const products = useQuery(
    callback => dataStore.products.subscribe().toArray(callback),
    [dataStore],
  );

  if (products.status === "pending") return <div>Loading…</div>;
  if (products.status === "error") return <div>Error loading products</div>;

  return (
    <ul>
      {products.data.map(product => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
