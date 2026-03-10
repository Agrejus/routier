function useFilteredProducts(searchTerm: string) {
  const dataStore = useDataStore();

  const products = useQuery(
    (cb) =>
      dataStore.products
        .where((p) => p.name.includes(searchTerm))
        .subscribe()
        .toArray(cb),
    [searchTerm]
  );

  const count = useMemo(
    () => (products.status === "success" ? products.data?.length : 0),
    [products]
  );

  return { products, count };
}