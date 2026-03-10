const complexQuery = (params: { category: string; minPrice: number }) =>
  Queryable.compose(dataStore.products.schema)
    .where(([x, p]) => x.category === p.category, params)
    .where(([x, p]) => x.price >= p.minPrice, params)
    .sort((x) => x.price)
    .take(5);

const results = await dataStore.products
  .apply(complexQuery({ category: "electronics", minPrice: 100 }))
  .toArrayAsync();