import { useQuery } from "@routier/react";
import { useDataStore } from "./DexieStore"; // Your app's datastore hook/context

export function ProductsList() {
  const dataStore = useDataStore();

  const products = useQuery<Product[]>(
    (c) => dataStore.products.subscribe().toArray(c),
    [dataStore]
  );

  if (products.status === "pending") return <div>Loading…</div>;
  if (products.status === "error") return <div>Error loading products</div>;

  return (
    <ul>
      {products.data.map((p: any) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
