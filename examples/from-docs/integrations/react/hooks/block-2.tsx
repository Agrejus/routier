import { useQuery } from "@routier/react";
import { useDataStore } from "../useDataStore";

export function ProductCount() {
  const dataStore = useDataStore();

  // Query a count
  const countResult = useQuery(
    (callback) => dataStore.products.subscribe().count(callback),
    []
  );

  if (countResult.status === "pending") return <div>Loading...</div>;
  if (countResult.status === "error") return <div>Error loading count</div>;

  return <div>Total products: {countResult.data}</div>;
}
