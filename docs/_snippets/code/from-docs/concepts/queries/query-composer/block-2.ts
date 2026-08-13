// Compose a query independently
const filterByCategoryAndPrice = (params: {
  category: string;
  minPrice: number;
}) =>
  Queryable.compose(dataStore.products.schema)
    .where(([x, p]) => x.category === p.category, params)
    .where(([x, p]) => x.price >= p.minPrice, params);

// Apply it later to a collection
const results = await dataStore.products
  .apply(filterByCategoryAndPrice({ category: "electronics", minPrice: 100 }))
  .toArrayAsync();