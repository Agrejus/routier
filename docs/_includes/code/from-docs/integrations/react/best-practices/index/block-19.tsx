async function addProduct(product: ProductData) {
  // Add optimistically
  await dataStore.products.addAsync(product);
  await dataStore.saveChangesAsync();

  // Query automatically updates with new data
}

function ProductsWithAdd() {
  const products = useQuery(
    (cb) => dataStore.products.subscribe().toArray(cb),
    []
  );

  const handleAdd = async (product: ProductData) => {
    await addProduct(product);
  };

  return (
    <>
      <AddProductForm onSubmit={handleAdd} />
      {/* Render products */}
    </>
  );
}