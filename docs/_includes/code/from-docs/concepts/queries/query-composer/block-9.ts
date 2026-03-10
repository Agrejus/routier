const createPaginatedQuery = (params: {
  category: string;
  page: number;
  pageSize: number;
}) =>
  Queryable.compose(dataStore.products.schema)
    .where(([x, p]) => x.category === p.category, params)
    .skip(params.page * params.pageSize)
    .take(params.pageSize)
    .sort((x) => x.name);

const page1 = await dataStore.products
  .apply(
    createPaginatedQuery({ category: "electronics", page: 0, pageSize: 10 })
  )
  .toArrayAsync();