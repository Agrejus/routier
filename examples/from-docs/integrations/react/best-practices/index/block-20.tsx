function ProductStats() {
  const dataStore = useDataStore();

  const products = useQuery(
    (cb) => dataStore.products.subscribe().toArray(cb),
    []
  );

  const stats = useMemo(() => {
    if (products.status !== "success") return null;

    return {
      total: products.data!.length,
      totalValue: products.data!.reduce((sum, p) => sum + p.price, 0),
      averagePrice:
        products.data!.reduce((sum, p) => sum + p.price, 0) /
        products.data!.length,
    };
  }, [products]);

  if (products.status === "pending") return <Loading />;
  if (!stats) return null;

  return (
    <div>
      <p>Total Products: {stats.total}</p>
      <p>Total Value: ${stats.totalValue}</p>
      <p>Average Price: ${stats.averagePrice}</p>
    </div>
  );
}