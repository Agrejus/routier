const products = useQuery(
  c => dataStore.products.subscribe().toArray(c),
  [dataStore]
);

if (products.status === "loading") return <div>Loading...</div>;
if (products.status === "error") return <div>Error: {products.error.message}</div>;
return <div>{products.data.map(...)}</div>;