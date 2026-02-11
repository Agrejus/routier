const buildSearchQuery = (searchParams: {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}) => {
  let query = Queryable.compose(productSchema);

  if (searchParams.category) {
    query = query.where(([x, p]) => x.category === p.category, searchParams);
  }

  if (searchParams.minPrice !== undefined) {
    query = query.where(([x, p]) => x.price >= p.minPrice, searchParams);
  }

  if (searchParams.maxPrice !== undefined) {
    query = query.where(([x, p]) => x.price <= p.maxPrice, searchParams);
  }

  if (searchParams.inStock !== undefined) {
    query = query.where(([x, p]) => x.inStock === p.inStock, searchParams);
  }

  return query.sort((x) => x.name);
};

const results = await dataStore.products
  .apply(
    buildSearchQuery({
      category: "electronics",
      minPrice: 100,
      inStock: true,
    })
  )
  .toArrayAsync();