function RefetchableProducts() {
  const [key, setKey] = useState(0);

  const products = useQuery(
    (cb) => dataStore.products.subscribe().toArray(cb),
    [key] // Re-run when key changes
  );

  const refetch = () => setKey((prev) => prev + 1);

  return (
    <>
      <button onClick={refetch}>Refresh</button>
      {/* Render products */}
    </>
  );
}