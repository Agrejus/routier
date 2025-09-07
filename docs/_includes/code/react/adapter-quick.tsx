import { useQuery } from "@routier/react";
import { useMemo } from "react";
import { useDataStore } from "./DexieStore"; // Your app's datastore hook/context

export function ProductsList() {
  const dataStore = useDataStore();

  const products = useQuery(
    c => dataStore.products.subscribe().toArray(c),
    []
  );

  const items = useMemo(() => (products.status === "success" ? products.data : []), [products]);

  if (products.status === "loading") return <div>Loading…</div>;
  if (products.status === "error") return <div>Error loading products</div>;

  return (
    <ul>
      {items.map((p: any) => (
        <li key={p._id}>{p.name}</li>
      ))}
    </ul>
  );
}


