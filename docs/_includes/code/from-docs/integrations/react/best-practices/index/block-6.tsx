const products = useQuery(
  (cb) => dataStore.products.subscribe().toArray(cb),
  []
);

if (products.status === "pending") {
  return <LoadingSpinner />;
}

if (products.status === "error") {
  return <ErrorMessage error={products.error} />;
}

return <ProductsList products={products.data} />;