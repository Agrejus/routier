import { useQuery } from "@routier/react";
import { useDataStore } from "../useDataStore";
import { useState } from "react";

export function FilteredProducts() {
  const dataStore = useDataStore();
  const [searchTerm, setSearchTerm] = useState("");

  // Re-run query when search term changes
  const products = useQuery(
    (callback) =>
      dataStore.products
        .where((p) => p.name.includes(searchTerm))
        .subscribe()
        .toArray(callback),
    [searchTerm] // Re-run when searchTerm changes
  );

  if (products.status === "pending") return <div>Loading...</div>;
  if (products.status === "error") return <div>Error</div>;

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search products..."
      />
      <ul>
        {products.data?.map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </div>
  );
}
