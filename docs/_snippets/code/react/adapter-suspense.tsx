import { Suspense, use, useRef } from "react";
import { useDataStore } from "./DexieStore"; // Your app's datastore hook/context

type AppDataStore = ReturnType<typeof useDataStore>;
type ProductsPromise = ReturnType<AppDataStore["products"]["toArrayAsync"]>;

function ProductsListContent({ request }: { request: ProductsPromise }) {
  const products = use(request);

  return (
    <ul>
      {products.map(product => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}

export function SuspenseProductsList() {
  const store = useDataStore(); // Keep this instance stable (Context or useMemo).
  const requestRef = useRef<ProductsPromise | null>(null);

  // This component does not suspend, so the ref survives while the boundary
  // renders its fallback and retries ProductsListContent.
  requestRef.current ??= store.products.toArrayAsync();

  return (
    <Suspense fallback={<div>Loading products…</div>}>
      <ProductsListContent request={requestRef.current} />
    </Suspense>
  );
}
