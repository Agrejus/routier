// Define once, use anywhere
const createProductFilter = (params: { category: string; inStock: boolean }) =>
  Queryable.compose(productSchema)
    .where(([x, p]) => x.category === p.category, params)
    .where(([x, p]) => x.inStock === p.inStock, params)
    .sort((x) => x.price);

// Use in multiple places
const electronics = await dataStore.products
  .apply(createProductFilter({ category: "electronics", inStock: true }))
  .toArrayAsync();

const accessories = await dataStore.products
  .apply(createProductFilter({ category: "accessories", inStock: true }))
  .toArrayAsync();