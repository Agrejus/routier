import { useQuery } from "@routier/react";
import { useDataStore } from "../useDataStore";

export function SingleProduct({ productId }: { productId: string }) {
  const dataStore = useDataStore();

  // Query a single item by ID
  const product = useQuery(
    (callback) =>
      dataStore.products
        .where((p) => p.id === productId)
        .subscribe()
        .first(callback),
    [productId] // Re-run when productId changes
  );

  if (product.status === "pending") return <div>Loading...</div>;
  if (product.status === "error") return <div>Product not found</div>;

  return (
    <div>
      <h1>{product.data?.name}</h1>
      <p>{product.data?.description}</p>
    </div>
  );
}
