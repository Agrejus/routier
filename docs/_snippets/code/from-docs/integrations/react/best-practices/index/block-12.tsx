// hooks/useProducts.ts
export function useProducts(searchTerm: string) {
  const dataStore = useDataStore();

  return useQuery(
    (cb) =>
      dataStore.products
        .where((p) => p.name.includes(searchTerm))
        .subscribe()
        .toArray(cb),
    [searchTerm]
  );
}

// components/ProductsList.tsx
export function ProductsList({ searchTerm }: { searchTerm: string }) {
  const products = useProducts(searchTerm);

  if (products.status === "pending") return <Loading />;
  if (products.status === "error")
    return <ErrorDisplay error={products.error} />;

  return (
    <ul>
      {products.data?.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}