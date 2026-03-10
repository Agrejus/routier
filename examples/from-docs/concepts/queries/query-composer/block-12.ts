const baseQuery = (params: { category: string }) =>
  Queryable.compose(productSchema).where(
    ([x, p]) => x.category === p.category,
    params
  );

// Apply composer, then add more operations
const results = await dataStore.products
  .apply(baseQuery({ category: "electronics" }))
  .where((x) => x.inStock === true) // Additional filter
  .sort((x) => x.price)
  .take(10)
  .toArrayAsync();