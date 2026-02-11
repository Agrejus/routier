const createAdvancedFilter = (params: {
  category: string;
  minPrice: number;
  maxPrice: number;
  inStock: boolean;
}) =>
  Queryable.compose(productSchema)
    .where(([x, p]) => x.category === p.category, params)
    .where(([x, p]) => x.price >= p.minPrice && x.price <= p.maxPrice, params)
    .where(([x, p]) => x.inStock === p.inStock, params)
    .sort((x) => x.price)
    .take(10);

const results = await dataStore.products
  .apply(
    createAdvancedFilter({
      category: "electronics",
      minPrice: 100,
      maxPrice: 500,
      inStock: true,
    })
  )
  .toArrayAsync();